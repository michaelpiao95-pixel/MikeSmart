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
  const days = parseInt(searchParams.get("days") ?? "30", 10);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString();

  // Parallel fetches
  const [tasksResult, pomodoroResult, reflectionsResult, assignmentsResult] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("status, completed_at, scheduled_date, created_at")
        .eq("user_id", user.id)
        .gte("created_at", sinceISO),

      supabase
        .from("pomodoro_sessions")
        .select("started_at, duration_minutes, completed")
        .eq("user_id", user.id)
        .gte("started_at", sinceISO),

      supabase
        .from("daily_reflections")
        .select("date, completion_score, mood")
        .eq("user_id", user.id)
        .gte("date", sinceISO.split("T")[0])
        .order("date", { ascending: true }),

      supabase
        .from("assignments")
        .select("is_completed, completed_at, due_at")
        .eq("user_id", user.id)
        .gte("created_at", sinceISO),
    ]);

  // Build daily stats map
  const dailyMap = new Map<
    string,
    {
      date: string;
      tasksCompleted: number;
      studyMinutes: number;
      pomodoroSessions: number;
      completionScore: number;
    }
  >();

  // Process pomodoro sessions
  for (const s of pomodoroResult.data ?? []) {
    const date = s.started_at.split("T")[0];
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        date,
        tasksCompleted: 0,
        studyMinutes: 0,
        pomodoroSessions: 0,
        completionScore: 0,
      });
    }
    const entry = dailyMap.get(date)!;
    if (s.completed) {
      entry.studyMinutes += s.duration_minutes;
      entry.pomodoroSessions += 1;
    }
  }

  // Process task completions
  for (const t of tasksResult.data ?? []) {
    if (t.status === "completed" && t.completed_at) {
      const date = t.completed_at.split("T")[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          tasksCompleted: 0,
          studyMinutes: 0,
          pomodoroSessions: 0,
          completionScore: 0,
        });
      }
      dailyMap.get(date)!.tasksCompleted += 1;
    }
  }

  // Overlay reflection scores
  for (const r of reflectionsResult.data ?? []) {
    if (dailyMap.has(r.date)) {
      dailyMap.get(r.date)!.completionScore = r.completion_score;
    }
  }

  const dailyStats = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Summary stats
  const totalStudyMinutes = (pomodoroResult.data ?? [])
    .filter((s) => s.completed)
    .reduce((sum, s) => sum + s.duration_minutes, 0);

  const totalTasksCompleted = (tasksResult.data ?? []).filter(
    (t) => t.status === "completed"
  ).length;

  const totalAssignmentsCompleted = (assignmentsResult.data ?? []).filter(
    (a) => a.is_completed
  ).length;

  const avgCompletionScore =
    (reflectionsResult.data ?? []).length > 0
      ? Math.round(
          (reflectionsResult.data ?? []).reduce(
            (sum, r) => sum + r.completion_score,
            0
          ) / (reflectionsResult.data ?? []).length
        )
      : 0;

  return NextResponse.json({
    data: {
      dailyStats,
      summary: {
        totalStudyMinutes,
        totalStudyHours: Math.round(totalStudyMinutes / 60),
        totalTasksCompleted,
        totalAssignmentsCompleted,
        avgCompletionScore,
        totalPomodoros: (pomodoroResult.data ?? []).filter((s) => s.completed).length,
      },
      reflections: reflectionsResult.data ?? [],
    },
  });
}
