import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CanvasClient, CanvasApiError, derivePriority } from "@/lib/canvas/client";
import { getCourseColor } from "@/lib/utils";
import type { SyncResult } from "@/types";

export async function POST() {
  const supabase = await createClient();

  // Authenticate
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("[Sync] Auth error:", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Sync] Starting for user:", user.id);

  // Fetch user's Canvas credentials from profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("canvas_base_url, canvas_api_token_encrypted")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("[Sync] Profile fetch error:", profileError);
    return NextResponse.json({ error: `Database error: ${profileError.message}` }, { status: 500 });
  }

  if (!profile) {
    console.error("[Sync] No profile row found for user:", user.id);
    return NextResponse.json({ error: "Profile not found — try signing out and back in." }, { status: 404 });
  }

  console.log("[Sync] Profile found. canvas_base_url:", profile.canvas_base_url, "token set:", !!profile.canvas_api_token_encrypted);

  if (!profile.canvas_base_url || !profile.canvas_api_token_encrypted) {
    return NextResponse.json(
      { error: "Canvas credentials not saved yet. Go to Settings, enter your Canvas URL + token, and click Save." },
      { status: 400 }
    );
  }

  const canvas = new CanvasClient(
    profile.canvas_base_url,
    profile.canvas_api_token_encrypted
  );

  let coursesAdded = 0;
  let coursesUpdated = 0;
  let assignmentsAdded = 0;
  let assignmentsUpdated = 0;

  try {
    // ── 1. Validate token ──────────────────────────────────────────────────────
    console.log("[Sync] Validating Canvas token against:", profile.canvas_base_url);
    const me = await canvas.validateToken();
    console.log("[Sync] Token valid. Canvas user:", me.name);

    // ── 2. Sync Courses ────────────────────────────────────────────────────────
    const canvasCourses = await canvas.getCourses();
    console.log("[Sync] Fetched", canvasCourses.length, "courses");

    const { data: existingCourses } = await supabase
      .from("courses")
      .select("id, canvas_course_id, color")
      .eq("user_id", user.id);

    const existingCourseMap = new Map(
      (existingCourses ?? []).map((c) => [c.canvas_course_id, c])
    );

    const courseIdMap = new Map<number, string>();

    for (let i = 0; i < canvasCourses.length; i++) {
      const c = canvasCourses[i];
      const existing = existingCourseMap.get(c.id);

      if (existing) {
        await supabase
          .from("courses")
          .update({ name: c.name, course_code: c.course_code })
          .eq("id", existing.id);
        courseIdMap.set(c.id, existing.id);
        coursesUpdated++;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from("courses")
          .insert({
            user_id: user.id,
            canvas_course_id: c.id,
            name: c.name,
            course_code: c.course_code,
            color: getCourseColor(i),
          })
          .select("id")
          .single();

        if (insertErr) {
          console.error("[Sync] Course insert error:", insertErr);
        } else if (inserted) {
          courseIdMap.set(c.id, inserted.id);
          coursesAdded++;
        }
      }
    }

    console.log("[Sync] Courses — added:", coursesAdded, "updated:", coursesUpdated);

    // ── 3. Sync Assignments ────────────────────────────────────────────────────
    const allAssignments = await canvas.getAllAssignments(canvasCourses);
    console.log("[Sync] Fetched", allAssignments.length, "assignments");

    const { data: existingAssignments } = await supabase
      .from("assignments")
      .select("id, canvas_assignment_id, is_completed, due_at")
      .eq("user_id", user.id)
      .not("canvas_assignment_id", "is", null);

    const existingAssignmentMap = new Map(
      (existingAssignments ?? []).map((a) => [a.canvas_assignment_id, a])
    );

    for (const a of allAssignments) {
      if (!a.name) continue;

      const existing = existingAssignmentMap.get(a.id);
      const courseDbId = courseIdMap.get(a.course_id);
      const priority = derivePriority(a.due_at ?? undefined);

      const submittedOnCanvas =
        a.submission?.workflow_state === "submitted" ||
        a.submission?.workflow_state === "graded";

      if (existing) {
        const dueChanged = existing.due_at !== (a.due_at ?? null);
        const completionChanged = submittedOnCanvas && !existing.is_completed;
        if (dueChanged || completionChanged) {
          const updatePayload: Record<string, unknown> = {
            due_at: a.due_at,
            priority,
            title: a.name,
            description: a.description,
            points_possible: a.points_possible,
            canvas_html_url: a.html_url,
          };
          if (completionChanged) {
            updatePayload.is_completed = true;
            updatePayload.completed_at = new Date().toISOString();
          }
          await supabase
            .from("assignments")
            .update(updatePayload)
            .eq("id", existing.id);
          assignmentsUpdated++;
        }
      } else {
        const { error: aErr } = await supabase.from("assignments").insert({
          user_id: user.id,
          course_id: courseDbId ?? null,
          canvas_assignment_id: a.id,
          canvas_course_id: a.course_id,
          title: a.name,
          description: a.description ?? null,
          due_at: a.due_at ?? null,
          points_possible: a.points_possible ?? null,
          priority,
          is_completed: submittedOnCanvas,
          completed_at: submittedOnCanvas ? new Date().toISOString() : null,
          canvas_html_url: a.html_url,
          is_synced_from_canvas: true,
        });
        if (aErr) {
          console.error("[Sync] Assignment insert error:", aErr.message, "—", a.name);
        } else {
          assignmentsAdded++;
        }
      }
    }

    console.log("[Sync] Assignments — added:", assignmentsAdded, "updated:", assignmentsUpdated);

    // ── 4. Update last_synced_at ───────────────────────────────────────────────
    await supabase
      .from("profiles")
      .update({ canvas_last_synced_at: new Date().toISOString() })
      .eq("id", user.id);

    await supabase.from("canvas_sync_logs").insert({
      user_id: user.id,
      courses_synced: canvasCourses.length,
      assignments_synced: assignmentsAdded,
      assignments_updated: assignmentsUpdated,
      status: "success",
    });

    const result: SyncResult = {
      coursesAdded,
      coursesUpdated,
      assignmentsAdded,
      assignmentsUpdated,
      syncedAt: new Date().toISOString(),
    };

    return NextResponse.json({ data: result });
  } catch (err) {
    let message = "Sync failed";

    if (err instanceof CanvasApiError) {
      message = `Canvas API returned ${err.status}: ${err.message}`;
      console.error("[Sync] CanvasApiError:", err.status, err.body);
    } else if (err instanceof Error) {
      message = err.message;
      console.error("[Sync] Error:", err.message, err.stack);
    } else {
      console.error("[Sync] Unknown error:", err);
    }

    await supabase.from("canvas_sync_logs").insert({
      user_id: user.id,
      courses_synced: 0,
      assignments_synced: 0,
      assignments_updated: 0,
      status: "failed",
      error_message: message,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
