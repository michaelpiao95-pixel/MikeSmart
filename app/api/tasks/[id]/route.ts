import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if ("status" in body) {
    updates.status = body.status;
    if (body.status === "completed") {
      updates.completed_at = new Date().toISOString();
    } else {
      updates.completed_at = null;
    }
  }
  if ("title" in body) updates.title = body.title;
  if ("priority" in body) updates.priority = body.priority;
  if ("scheduled_start" in body) updates.scheduled_start = body.scheduled_start;
  if ("scheduled_end" in body) updates.scheduled_end = body.scheduled_end;
  if ("sort_order" in body) updates.sort_order = body.sort_order;
  if ("category" in body) updates.category = body.category;
  if ("is_habit" in body) updates.is_habit = body.is_habit;
  if ("habit_days" in body) updates.habit_days = body.habit_days;

  const { data, error: dbError } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Update streak if completing a task
  if (body.status === "completed") {
    await updateTaskStreak(supabase, user.id);
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error: dbError } = await supabase
    .from("tasks")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Deleted" });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function updateTaskStreak(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  userId: string
) {
  const today = new Date().toISOString().split("T")[0];

  // Only award streak if ALL tasks scheduled for today are completed
  const { data: todayTasks } = await supabase
    .from("tasks")
    .select("status")
    .eq("user_id", userId)
    .eq("scheduled_date", today);

  if (!todayTasks || todayTasks.length === 0) return;
  if (!todayTasks.every((t) => t.status === "completed")) return;

  const { data: streak } = await supabase
    .from("streaks")
    .select("*")
    .eq("user_id", userId)
    .eq("streak_type", "task_completion")
    .maybeSingle();

  const lastDate = streak?.last_activity_date;
  if (lastDate === today) return; // already counted today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const isConsecutive = lastDate === yesterdayStr;
  const newStreak = isConsecutive ? (streak?.current_streak ?? 0) + 1 : 1;

  if (streak) {
    await supabase
      .from("streaks")
      .update({
        current_streak: newStreak,
        longest_streak: Math.max(newStreak, streak.longest_streak),
        last_activity_date: today,
      })
      .eq("id", streak.id);
  } else {
    await supabase
      .from("streaks")
      .insert({
        user_id: userId,
        streak_type: "task_completion",
        current_streak: 1,
        longest_streak: 1,
        last_activity_date: today,
      });
  }
}
