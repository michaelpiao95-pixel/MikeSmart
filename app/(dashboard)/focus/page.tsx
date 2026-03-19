"use client";

import { useState, useEffect, useCallback } from "react";
import { usePomodoro, DEFAULT_CONFIG } from "@/lib/hooks/usePomodoro";
import { useStreaks } from "@/lib/hooks/useStreak";
import { formatTimer, todayISO } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Play, Pause, Square, SkipForward, Flame, Target, Moon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DailyReflection } from "@/types";

export default function FocusPage() {
  const { phase, secondsLeft, isRunning, sessionsCompleted, progress, start, pause, resume, stop, skip } =
    usePomodoro(DEFAULT_CONFIG, (minutes) => setTotalStudyMinutes((prev) => prev + minutes));
  const { getStreak } = useStreaks();
  const [focusMode, setFocusMode] = useState(false);
  const [reflection, setReflection] = useState<Partial<DailyReflection>>({
    wins: "", mistakes: "", improvements: "", mood: 3,
  });
  const [reflectionSaved, setReflectionSaved] = useState(false);
  const [totalStudyMinutes, setTotalStudyMinutes] = useState(0);
  const supabase = createClient();
  const taskStreak = getStreak("task_completion");
  const reflectionStreak = getStreak("daily_reflection");

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = todayISO();
    const [reflRes, pomRes] = await Promise.all([
      fetch(`/api/reflection?date=${today}`),
      supabase.from("pomodoro_sessions")
        .select("duration_minutes")
        .eq("user_id", user.id)
        .gte("started_at", today)
        .eq("completed", true),
    ]);

    const reflJson = await reflRes.json();
    if (reflJson.data) {
      setReflection(reflJson.data);
      setReflectionSaved(true);
    }

    const minutes = (pomRes.data ?? []).reduce((s, p) => s + p.duration_minutes, 0);
    setTotalStudyMinutes(minutes);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveReflection = async () => {
    const res = await fetch("/api/reflection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...reflection, date: todayISO() }),
    });
    if (res.ok) setReflectionSaved(true);
  };

  const circumference = 2 * Math.PI * 80;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const phaseColor = {
    idle: "text-muted-foreground",
    focus: "text-brand-400",
    short_break: "text-emerald-400",
    long_break: "text-blue-400",
  }[phase];

  const ringColor = {
    idle: "stroke-surface-4",
    focus: "stroke-brand-500",
    short_break: "stroke-emerald-500",
    long_break: "stroke-blue-500",
  }[phase];

  // Focus Mode — minimal UI
  if (focusMode) {
    return (
      <div className="fixed inset-0 bg-surface-0 flex flex-col items-center justify-center">
        <button
          onClick={() => setFocusMode(false)}
          className="absolute top-4 right-4 text-xs text-muted-foreground hover:text-foreground"
        >
          Exit Focus Mode
        </button>

        <div className="text-6xl font-bold font-mono tabular-nums text-foreground mb-2">
          {formatTimer(secondsLeft)}
        </div>
        <div className={cn("text-sm mb-10", phaseColor)}>
          {phase === "idle" ? "Ready" : phase === "focus" ? "Deep Work" : phase === "short_break" ? "Break" : "Long Break"}
        </div>

        <div className="flex items-center gap-3">
          {phase === "idle" ? (
            <button onClick={() => start("focus")} className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl font-semibold transition-all">
              Start
            </button>
          ) : isRunning ? (
            <button onClick={pause} className="bg-surface-3 hover:bg-surface-4 border border-border text-foreground px-6 py-3 rounded-xl font-semibold transition-all">
              Pause
            </button>
          ) : (
            <button onClick={resume} className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl font-semibold transition-all">
              Resume
            </button>
          )}
          {phase !== "idle" && (
            <button onClick={stop} className="bg-surface-3 hover:bg-surface-4 border border-border text-muted-foreground px-4 py-3 rounded-xl transition-all">
              <Square className="w-4 h-4 fill-current" />
            </button>
          )}
        </div>

        <div className="mt-8 text-xs text-muted-foreground">
          {sessionsCompleted} sessions completed today
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Focus</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Deep work, streaks, and daily reflection.
          </p>
        </div>
        <button
          onClick={() => setFocusMode(true)}
          className="flex items-center gap-2 bg-brand-600/10 hover:bg-brand-600/20 border border-brand-600/30 text-brand-400 px-4 py-2 rounded-lg text-sm font-medium transition-all"
        >
          <Moon className="w-4 h-4" />
          Enter Focus Mode
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Timer */}
        <div className="bg-surface-2 border border-border rounded-xl p-6 flex flex-col items-center">
          <div className="text-4xl font-bold font-mono tabular-nums text-foreground mb-1 mt-6">
            {formatTimer(secondsLeft)}
          </div>
          <div className={cn("text-sm mb-8 font-medium", phaseColor)}>
            {phase === "idle" ? "Ready to focus" : phase === "focus" ? "Deep Work" : phase === "short_break" ? "Short Break" : "Long Break"}
          </div>

          <div className="flex items-center gap-2">
            {phase === "idle" ? (
              <button onClick={() => start("focus")} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all">
                <Play className="w-4 h-4 fill-current" /> Start Focus
              </button>
            ) : isRunning ? (
              <button onClick={pause} className="flex items-center gap-2 bg-surface-3 hover:bg-surface-4 border border-border text-foreground px-4 py-2.5 rounded-lg text-sm font-semibold transition-all">
                <Pause className="w-4 h-4 fill-current" /> Pause
              </button>
            ) : (
              <button onClick={resume} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all">
                <Play className="w-4 h-4 fill-current" /> Resume
              </button>
            )}
            {phase !== "idle" && (
              <>
                <button onClick={skip} className="p-2.5 rounded-lg bg-surface-3 hover:bg-surface-4 border border-border text-muted-foreground hover:text-foreground transition-all" title="Skip">
                  <SkipForward className="w-4 h-4" />
                </button>
                <button onClick={stop} className="p-2.5 rounded-lg bg-surface-3 hover:bg-surface-4 border border-border text-muted-foreground hover:text-foreground transition-all" title="Stop">
                  <Square className="w-4 h-4 fill-current" />
                </button>
              </>
            )}
          </div>

          <div className="mt-6 flex gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-foreground tabular-nums">{sessionsCompleted}</p>
              <p className="text-xs text-muted-foreground">sessions today</p>
            </div>
            <div className="w-px bg-border" />
            <div>
              <p className="text-lg font-bold text-foreground tabular-nums">
                {totalStudyMinutes >= 60
                  ? `${Math.floor(totalStudyMinutes / 60)}h ${totalStudyMinutes % 60}m`
                  : `${totalStudyMinutes}m`}
              </p>
              <p className="text-xs text-muted-foreground">study time</p>
            </div>
          </div>
        </div>

        {/* Streaks */}
        <div className="space-y-4">
          <div className="bg-surface-2 border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              Streaks
            </h3>
            <div className="space-y-3">
              <StreakRow
                label="Task Completion"
                current={taskStreak?.current_streak ?? 0}
                longest={taskStreak?.longest_streak ?? 0}
                color="amber"
              />
              <StreakRow
                label="Daily Reflection"
                current={reflectionStreak?.current_streak ?? 0}
                longest={reflectionStreak?.longest_streak ?? 0}
                color="blue"
              />
            </div>
          </div>

          {/* Session dots */}
          <div className="bg-surface-2 border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-brand-400" />
              Session Progress
            </h3>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all",
                    i < sessionsCompleted
                      ? "bg-brand-600 text-white"
                      : "bg-surface-3 text-muted-foreground"
                  )}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {4 - (sessionsCompleted % 4)} sessions until long break
            </p>
          </div>
        </div>
      </div>

      {/* Daily Reflection */}
      <div className="bg-surface-2 border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">
            Daily Reflection
          </h3>
          {reflectionSaved && (
            <span className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/30 px-2 py-0.5 rounded-full">
              Saved
            </span>
          )}
        </div>

        {/* Mood */}
        <div className="mb-4">
          <label className="text-xs text-muted-foreground mb-2 block">Mood today</label>
          <div className="flex gap-2">
            {[
              { value: 1, emoji: "😞" },
              { value: 2, emoji: "😕" },
              { value: 3, emoji: "😐" },
              { value: 4, emoji: "😊" },
              { value: 5, emoji: "😄" },
            ].map(({ value, emoji }) => (
              <button
                key={value}
                onClick={() => setReflection((r) => ({ ...r, mood: value }))}
                className={cn(
                  "w-10 h-10 rounded-lg text-lg transition-all",
                  reflection.mood === value
                    ? "bg-brand-600/20 border border-brand-600/50 scale-110"
                    : "bg-surface-3 hover:bg-surface-4"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {[
            { key: "wins", label: "Wins", placeholder: "What went well today?", color: "emerald" },
            { key: "mistakes", label: "Mistakes", placeholder: "What didn't go well?", color: "red" },
            { key: "improvements", label: "Improvements", placeholder: "What will you do better?", color: "brand" },
          ].map(({ key, label, placeholder, color }) => (
            <div key={key}>
              <label className={cn("text-xs font-medium mb-1.5 block", {
                "text-emerald-400": color === "emerald",
                "text-red-400": color === "red",
                "text-brand-400": color === "brand",
              })}>
                {label}
              </label>
              <textarea
                value={(reflection as Record<string, string>)[key] ?? ""}
                onChange={(e) => setReflection((r) => ({ ...r, [key]: e.target.value }))}
                rows={3}
                placeholder={placeholder}
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={saveReflection}
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
          >
            Save Reflection
          </button>
        </div>
      </div>
    </div>
  );
}

function StreakRow({
  label,
  current,
  longest,
  color,
}: {
  label: string;
  current: number;
  longest: number;
  color: "amber" | "blue";
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("text-2xl font-bold tabular-nums", color === "amber" ? "text-amber-400" : "text-blue-400")}>
        {current}
      </div>
      <div className="flex-1">
        <p className="text-sm text-foreground font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">Best: {longest} days</p>
      </div>
      {current >= 7 && <span className="text-xl">🔥</span>}
    </div>
  );
}
