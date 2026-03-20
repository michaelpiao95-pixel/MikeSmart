import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const days = parseInt(searchParams.get("days") ?? "7", 10);

  const since = new Date();
  since.setDate(since.getDate() - days + 1);
  since.setHours(0, 0, 0, 0);
  const sinceISO = since.toISOString();
  const sinceDate = sinceISO.split("T")[0];

  const [pomodoroResult, tasksResult] = await Promise.all([
    supabase
      .from("pomodoro_sessions")
      .select("started_at, duration_minutes")
      .eq("user_id", user.id)
      .gte("started_at", sinceISO),

    supabase
      .from("tasks")
      .select("status, scheduled_date")
      .eq("user_id", user.id)
      .gte("scheduled_date", sinceDate)
      .not("scheduled_date", "is", null),
  ]);

  // Study minutes per day
  const studyByDay = new Map<string, number>();
  for (const s of pomodoroResult.data ?? []) {
    const date = s.started_at.split("T")[0];
    studyByDay.set(date, (studyByDay.get(date) ?? 0) + s.duration_minutes);
  }

  // Tasks total + completed per day (by scheduled_date)
  const tasksByDay = new Map<string, { total: number; completed: number }>();
  for (const t of tasksResult.data ?? []) {
    const date = t.scheduled_date as string;
    if (!tasksByDay.has(date)) tasksByDay.set(date, { total: 0, completed: 0 });
    const entry = tasksByDay.get(date)!;
    entry.total++;
    if (t.status === "completed") entry.completed++;
  }

  // Build full date range with 0-fill for missing days
  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const date = d.toISOString().split("T")[0];
    const minutes = studyByDay.get(date) ?? 0;
    const tasks = tasksByDay.get(date);
    return {
      date,
      studyHours: +(minutes / 60).toFixed(2),
      taskPct: tasks && tasks.total > 0
        ? Math.round((tasks.completed / tasks.total) * 100)
        : null,
    };
  });

  const totalMinutes = [...studyByDay.values()].reduce((a, b) => a + b, 0);

  return NextResponse.json({
    data: {
      daily,
      summary: {
        totalStudyHours: +(totalMinutes / 60).toFixed(1),
      },
    },
  });
}
