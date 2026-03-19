import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CanvasClient, CanvasApiError } from "@/lib/canvas/client";

/**
 * Lightweight completion-only sync.
 * Uses the same include[]=submission approach as the full sync (proven to work),
 * but only updates is_completed — skips inserting new assignments or touching courses.
 */
export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("canvas_base_url, canvas_api_token_encrypted")
    .eq("id", user.id)
    .single();

  if (!profile?.canvas_base_url || !profile?.canvas_api_token_encrypted) {
    return NextResponse.json({ completed: [], count: 0 });
  }

  // Get all incomplete Canvas-synced assignments from DB
  const { data: incomplete } = await supabase
    .from("assignments")
    .select("id, canvas_assignment_id, canvas_course_id")
    .eq("user_id", user.id)
    .eq("is_completed", false)
    .eq("is_synced_from_canvas", true)
    .not("canvas_assignment_id", "is", null)
    .not("canvas_course_id", "is", null);

  if (!incomplete?.length) {
    return NextResponse.json({ completed: [], count: 0 });
  }

  const canvas = new CanvasClient(
    profile.canvas_base_url,
    profile.canvas_api_token_encrypted
  );

  // canvas_assignment_id → db row id
  const assignmentMap = new Map<number, string>(
    incomplete.map((a) => [Number(a.canvas_assignment_id), a.id as string])
  );

  // Unique course IDs to query
  const courseIds = [...new Set(incomplete.map((a) => Number(a.canvas_course_id)))];

  const nowCompletedDbIds: string[] = [];

  try {
    await Promise.all(
      courseIds.map(async (courseId) => {
        // Same endpoint + params as the main sync — definitely works
        const assignments = await canvas.getAssignmentsForCourse(courseId);

        for (const a of assignments) {
          const submitted =
            a.submission?.workflow_state === "submitted" ||
            a.submission?.workflow_state === "graded";

          if (!submitted) continue;

          const dbId = assignmentMap.get(a.id);
          if (!dbId) continue;

          const { error } = await supabase
            .from("assignments")
            .update({
              is_completed: true,
              completed_at: new Date().toISOString(),
            })
            .eq("id", dbId);

          if (!error) nowCompletedDbIds.push(dbId);
        }
      })
    );
  } catch (err) {
    if (err instanceof CanvasApiError) {
      console.error("[sync-completions] Canvas API error:", err.status, err.body);
      return NextResponse.json({ completed: [], count: 0 });
    }
    console.error("[sync-completions] Unexpected error:", err);
    return NextResponse.json({ completed: [], count: 0 });
  }

  return NextResponse.json({
    completed: nowCompletedDbIds,
    count: nowCompletedDbIds.length,
  });
}
