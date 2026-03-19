"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Plus, Trash2, AlertCircle, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PomodoroTimer } from "@/components/dashboard/PomodoroTimer";
import { DailyScore } from "@/components/dashboard/DailyScore";
import { SyncButton } from "@/components/canvas/SyncButton";
import {
  cn,
  todayISO,
  calculateCompletionScore,
  PRIORITY_CONFIG,
  formatDueDate,
  isOverdue,
  isDueWithin24Hours,
} from "@/lib/utils";
import type { Task, Assignment, DailyReflection } from "@/types";

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todayAssignments, setTodayAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<"academic" | "personal">("personal");
  const [newTaskDifficulty, setNewTaskDifficulty] = useState<"low" | "medium" | "high">("medium");
  const [addingTask, setAddingTask] = useState(false);
  const [profile, setProfile] = useState<{ canvas_last_synced_at?: string } | null>(null);
  const [studyMinutes, setStudyMinutes] = useState(0);
  const [weekTasksCompleted, setWeekTasksCompleted] = useState(0);
  const [weekTasksTotal, setWeekTasksTotal] = useState(0);
  const [yesterdayReflection, setYesterdayReflection] = useState<DailyReflection | null>(null);

  const supabase = createClient();
  const today = todayISO();

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Compute Mon–Sun of the current week
    const now = new Date();
    const dowOffset = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dowOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekStart = monday.toISOString().split("T")[0];
    const weekEnd = sunday.toISOString().split("T")[0];

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const [tasksRes, assignmentsRes, profileRes, pomodoroRes, weekTasksRes, reflRes] =
      await Promise.all([
        fetch(`/api/tasks?date=${today}`),
        fetch("/api/assignments"),
        supabase.from("profiles").select("canvas_last_synced_at").eq("id", user.id).single(),
        supabase
          .from("pomodoro_sessions")
          .select("duration_minutes")
          .eq("user_id", user.id)
          .gte("started_at", new Date().toISOString().split("T")[0]),
        supabase
          .from("tasks")
          .select("status")
          .eq("user_id", user.id)
          .eq("is_habit", false)
          .gte("scheduled_date", weekStart)
          .lte("scheduled_date", weekEnd),
        fetch(`/api/reflection?date=${yesterdayStr}`),
      ]);

    if (!tasksRes.ok || !assignmentsRes.ok) {
      const errJson = !tasksRes.ok
        ? await tasksRes.json().catch(() => ({}))
        : await assignmentsRes.json().catch(() => ({}));
      setApiError(errJson.error ?? "Failed to load data");
      setLoading(false);
      return;
    }

    const tasksJson = await tasksRes.json();
    const assignmentsJson = await assignmentsRes.json();

    setApiError(null);
    setTasks(tasksJson.data ?? []);

    // Filter to today's assignments (due today or overdue)
    const allAssignments: Assignment[] = assignmentsJson.data ?? [];
    const todayItems = allAssignments.filter((a) => {
      if (a.is_completed) return false;
      if (!a.due_at) return false;
      const due = new Date(a.due_at);
      const now = new Date();
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      return due <= endOfToday; // overdue + today
    });
    setTodayAssignments(todayItems);
    setProfile(profileRes.data);

    const minutes = (pomodoroRes.data ?? []).reduce(
      (sum, s) => sum + (s.duration_minutes ?? 0),
      0
    );
    setStudyMinutes(minutes);

    const weekTasks = weekTasksRes.data ?? [];
    setWeekTasksTotal(weekTasks.length);
    setWeekTasksCompleted(weekTasks.filter((t) => t.status === "completed").length);

    const reflJson = await reflRes.json().catch(() => ({}));
    setYesterdayReflection(reflJson.data ?? null);

    setLoading(false);
  }, [supabase, today]);

  const refreshStudyMinutes = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("pomodoro_sessions")
      .select("duration_minutes")
      .eq("user_id", user.id)
      .gte("started_at", new Date().toISOString().split("T")[0]);
    const minutes = (data ?? []).reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
    setStudyMinutes(minutes);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll study minutes every 30 seconds so it stays live without a page refresh
  useEffect(() => {
    const interval = setInterval(refreshStudyMinutes, 30_000);
    return () => clearInterval(interval);
  }, [refreshStudyMinutes]);

  const completedTasks = tasks.filter((t) => t.status === "completed");
  const pendingTasks = tasks.filter((t) => t.status !== "completed");
  const academicTasks = pendingTasks.filter((t) => t.category === "academic");
  const personalTasks = pendingTasks.filter((t) => t.category === "personal");

  const score = calculateCompletionScore(
    completedTasks.length,
    tasks.length,
    todayAssignments.filter((a) => a.is_completed).length,
    todayAssignments.length
  );

  const handleToggleTask = async (task: Task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  };

  const handleToggleAssignment = async (a: Assignment) => {
    const next = !a.is_completed;
    setTodayAssignments((prev) =>
      prev.map((x) => (x.id === a.id ? { ...x, is_completed: next } : x))
    );
    await fetch(`/api/assignments/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_completed: next }),
    });
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTaskTitle.trim(),
        category: newTaskCategory,
        scheduled_date: today,
        priority: newTaskDifficulty,
      }),
    });

    const json = await res.json();
    if (json.data) {
      setTasks((prev) => [...prev, json.data]);
      setNewTaskTitle("");
    }
    setAddingTask(false);
  };

  const handleDeleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
          <h1 className="text-2xl font-bold text-foreground mt-0.5">Today</h1>
        </div>
        <SyncButton
          lastSyncedAt={profile?.canvas_last_synced_at}
          onSyncComplete={load}
        />
      </div>

      {/* DB / API error banner */}
      {apiError && (
        <div className="flex items-start gap-3 p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Could not load your data</p>
            <p className="text-red-400/70 mt-0.5">{apiError}</p>
            {apiError.includes("does not exist") && (
              <p className="mt-2 text-red-300/80">
                Database tables are missing. Run{" "}
                <code className="font-mono bg-red-950/50 px-1 rounded">supabase/schema.sql</code>{" "}
                in your Supabase SQL Editor, then refresh.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Top grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DailyScore
          score={score}
          tasksCompleted={completedTasks.length}
          tasksTotal={tasks.length}
          weekTasksCompleted={weekTasksCompleted}
          weekTasksTotal={weekTasksTotal}
          studyMinutes={studyMinutes}
        />
        <PomodoroTimer />
      </div>

      {/* Due today from Canvas */}
      {todayAssignments.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Due Today
            <span className="text-xs bg-red-950/50 text-red-400 border border-red-900/50 px-1.5 py-0.5 rounded-full">
              {todayAssignments.filter((a) => !a.is_completed).length} remaining
            </span>
          </h2>
          <div className="space-y-2">
            {todayAssignments.map((a) => {
              const overdue = isOverdue(a.due_at) && !a.is_completed;
              const urgent = isDueWithin24Hours(a.due_at) && !a.is_completed;
              return (
                <div
                  key={a.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all",
                    a.is_completed
                      ? "bg-surface-1 border-border/50 opacity-60"
                      : overdue
                      ? "bg-red-950/20 border-red-900/40"
                      : urgent
                      ? "bg-amber-950/10 border-amber-900/30"
                      : "bg-surface-2 border-border"
                  )}
                >
                  <button
                    onClick={() => handleToggleAssignment(a)}
                    className={cn(
                      "w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-all",
                      a.is_completed
                        ? "bg-brand-600 border-brand-600"
                        : "border-border hover:border-brand-500"
                    )}
                  >
                    {a.is_completed && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", a.is_completed && "line-through text-muted-foreground")}>
                      {a.title}
                    </p>
                    <p className={cn("text-xs mt-0.5", overdue ? "text-red-400" : "text-muted-foreground")}>
                      {a.course?.course_code && (
                        <span className="mr-2 font-medium" style={{ color: a.course.color }}>
                          {a.course.course_code}
                        </span>
                      )}
                      {formatDueDate(a.due_at)}
                      {overdue && " — OVERDUE"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tasks */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Tasks
        </h2>

        {/* Add task form */}
        <form onSubmit={handleAddTask} className="flex gap-2 mb-4">
          <select
            value={newTaskCategory}
            onChange={(e) => setNewTaskCategory(e.target.value as "academic" | "personal")}
            className="bg-surface-3 border border-border rounded-lg px-2 py-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="personal">Personal</option>
            <option value="academic">Academic</option>
          </select>
          <select
            value={newTaskDifficulty}
            onChange={(e) => setNewTaskDifficulty(e.target.value as "low" | "medium" | "high")}
            className="bg-surface-3 border border-border rounded-lg px-2 py-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="low">Easy</option>
            <option value="medium">Medium</option>
            <option value="high">Hard</option>
          </select>
          <input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Add a task..."
            className="flex-1 bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
          />
          <button
            type="submit"
            disabled={addingTask || !newTaskTitle.trim()}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </form>

        {/* Academic tasks */}
        {academicTasks.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-brand-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
              Academic
            </p>
            <div className="space-y-1.5">
              {academicTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onToggle={handleToggleTask}
                  onDelete={handleDeleteTask}
                />
              ))}
            </div>
          </div>
        )}

        {/* Personal tasks */}
        {personalTasks.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
              Personal
            </p>
            <div className="space-y-1.5">
              {personalTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onToggle={handleToggleTask}
                  onDelete={handleDeleteTask}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed tasks */}
        {completedTasks.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">
              Completed ({completedTasks.length})
            </p>
            <div className="space-y-1.5">
              {completedTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onToggle={handleToggleTask}
                  onDelete={handleDeleteTask}
                />
              ))}
            </div>
          </div>
        )}

        {tasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground/60 text-sm">
            No tasks for today. Add one above or sync Canvas.
          </div>
        )}
      </section>

      {/* Yesterday's Reflection */}
      {yesterdayReflection && (
        <section className="animate-fade-in">
          <div className="bg-surface-2 border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-brand-600/10 flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5 text-brand-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground leading-none">Yesterday&apos;s Reflection</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{yesterdayReflection.date}</p>
              </div>
              <div className="ml-auto text-lg" title={`Mood: ${yesterdayReflection.mood}/5`}>
                {["😞","😕","😐","😊","😄"][yesterdayReflection.mood - 1]}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {yesterdayReflection.wins && (
                <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg px-3 py-2.5">
                  <p className="text-xs font-medium text-emerald-400 mb-1">Wins</p>
                  <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{yesterdayReflection.wins}</p>
                </div>
              )}
              {yesterdayReflection.mistakes && (
                <div className="bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2.5">
                  <p className="text-xs font-medium text-red-400 mb-1">Mistakes</p>
                  <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{yesterdayReflection.mistakes}</p>
                </div>
              )}
              {yesterdayReflection.improvements && (
                <div className="bg-brand-600/10 border border-brand-600/20 rounded-lg px-3 py-2.5">
                  <p className="text-xs font-medium text-brand-400 mb-1">Improvements</p>
                  <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{yesterdayReflection.improvements}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const done = task.status === "completed";
  const p = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all",
        done
          ? "bg-surface-1 border-border/30 opacity-60"
          : "bg-surface-2 border-border hover:border-border/80"
      )}
    >
      <button
        onClick={() => onToggle(task)}
        className={cn(
          "w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-all",
          done ? "bg-brand-600 border-brand-600" : "border-border hover:border-brand-500"
        )}
      >
        {done && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <span
        className={cn(
          "flex-1 text-sm",
          done ? "line-through text-muted-foreground" : "text-foreground"
        )}
      >
        {task.title}
      </span>

      {!done && (
        <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium shrink-0", p.badgeClass)}>
          {p.label}
        </span>
      )}

      <button
        onClick={() => onDelete(task.id)}
        className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
