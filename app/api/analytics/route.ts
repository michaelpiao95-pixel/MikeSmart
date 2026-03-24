import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Returns the UTC timestamp of local-midnight `daysAgo` days back.
// tzOffset = new Date().getTimezoneOffset() from client (positive = behind UTC, e.g. EDT = 240)
function localDayStart(tzOffset: number, daysAgo = 0): Date {
  const now = new Date();
  const localNow = new Date(now.getTime() - tzOffset * 60000);
  localNow.setUTCHours(0, 0, 0, 0);
  if (daysAgo > 0) localNow.setUTCDate(localNow.getUTCDate() - daysAgo);
  return new Date(localNow.getTime() + tzOffset * 60000);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") ?? "7", 10);
  const tzOffset = parseInt(searchParams.get("tzOffset") ?? "0", 10);

  const since = localDayStart(tzOffset, days - 1);
  const sinceISO = since.toISOString();
  // Local date string for tasks (scheduled_date is a local date)
  const sinceDate = new Date(since.getTime() - tzOffset * 60000).toISOString().split("T")[0];

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

  // Bucket sessions by local date
  const studyByDay = new Map<string, number>();
  for (const s of pomodoroResult.data ?? []) {
    const localDate = new Date(new Date(s.started_at).getTime() - tzOffset * 60000)
      .toISOString().split("T")[0];
    studyByDay.set(localDate, (studyByDay.get(localDate) ?? 0) + s.duration_minutes);
  }

  // Tasks per day (scheduled_date is already local)
  const tasksByDay = new Map<string, { total: number; completed: number }>();
  for (const t of tasksResult.data ?? []) {
    const date = t.scheduled_date as string;
    if (!tasksByDay.has(date)) tasksByDay.set(date, { total: 0, completed: 0 });
    const entry = tasksByDay.get(date)!;
    entry.total++;
    if (t.status === "completed") entry.completed++;
  }

  // Build date range using local dates
  const daily = Array.from({ length: days }, (_, i) => {
    const dayUTC = new Date(since.getTime() + i * 86400000);
    const date = new Date(dayUTC.getTime() - tzOffset * 60000).toISOString().split("T")[0];
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
      summary: { totalStudyHours: +(totalMinutes / 60).toFixed(1) },
    },
  });
}
