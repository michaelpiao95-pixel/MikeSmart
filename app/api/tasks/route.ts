import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? todayISO();
  const includeHabits = searchParams.get("include_habits") !== "false";

  // Get tasks for a specific date + habits for any day
  let query = supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id);

  if (includeHabits) {
    query = query.or(`scheduled_date.eq.${date},is_habit.eq.true`);
  } else {
    query = query.eq("scheduled_date", date);
  }

  const { data, error: dbError } = await query.order("sort_order", { ascending: true });

  if (dbError) {
    console.error("[tasks GET] DB error:", dbError);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Filter habits by day of week
  const dayOfWeek = new Date(date).getDay();
  const filtered = (data ?? []).filter((task) => {
    if (!task.is_habit) return true;
    if (!task.habit_days || task.habit_days.length === 0) return true;
    return task.habit_days.includes(dayOfWeek);
  });

  return NextResponse.json({ data: filtered });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const { data, error: dbError } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: body.title,
      description: body.description ?? null,
      category: body.category ?? "personal",
      priority: body.priority ?? "medium",
      due_date: body.due_date ?? null,
      scheduled_date: body.scheduled_date ?? todayISO(),
      scheduled_start: body.scheduled_start ?? null,
      scheduled_end: body.scheduled_end ?? null,
      is_habit: body.is_habit ?? false,
      habit_days: body.habit_days ?? [],
      sort_order: body.sort_order ?? 0,
      status: "pending",
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
