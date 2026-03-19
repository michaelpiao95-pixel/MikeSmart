"use client";

import { usePomodoro, DEFAULT_CONFIG, type PomodoroPhase } from "@/lib/hooks/usePomodoro";
import { formatTimer } from "@/lib/utils";
import { Play, Pause, Square, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";

const PHASE_LABELS: Record<PomodoroPhase, string> = {
  idle: "Ready",
  focus: "Deep Work",
  short_break: "Short Break",
  long_break: "Long Break",
};

const PHASE_COLORS: Record<PomodoroPhase, string> = {
  idle: "text-muted-foreground",
  focus: "text-brand-400",
  short_break: "text-emerald-400",
  long_break: "text-blue-400",
};

const PHASE_BG: Record<PomodoroPhase, string> = {
  idle: "",
  focus: "stroke-brand-500",
  short_break: "stroke-emerald-500",
  long_break: "stroke-blue-500",
};

export function PomodoroTimer() {
  const {
    phase,
    secondsLeft,
    isRunning,
    sessionsCompleted,
    progress,
    start,
    pause,
    resume,
    stop,
    skip,
  } = usePomodoro(DEFAULT_CONFIG);

  const circumference = 2 * Math.PI * 54; // r=54
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="bg-surface-2 border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Deep Work Timer</h3>
        <div className="flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                i < sessionsCompleted % 4
                  ? "bg-brand-500"
                  : "bg-surface-4"
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Ring timer */}
        <div className="relative shrink-0">
          <svg width="128" height="128" className="-rotate-90">
            {/* Track */}
            <circle
              cx="64"
              cy="64"
              r="54"
              fill="none"
              className="stroke-surface-4"
              strokeWidth="6"
            />
            {/* Progress */}
            <circle
              cx="64"
              cy="64"
              r="54"
              fill="none"
              className={cn("transition-all duration-1000", PHASE_BG[phase])}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={phase === "idle" ? circumference : strokeDashoffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold font-mono text-foreground tabular-nums">
              {formatTimer(secondsLeft)}
            </span>
            <span className={cn("text-xs font-medium mt-0.5", PHASE_COLORS[phase])}>
              {PHASE_LABELS[phase]}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-4">
            {phase === "idle" ? (
              <button
                onClick={() => start("focus")}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Focus
              </button>
            ) : (
              <>
                {isRunning ? (
                  <button
                    onClick={pause}
                    className="flex items-center gap-2 bg-surface-3 hover:bg-surface-4 border border-border text-foreground text-sm font-medium px-3 py-2 rounded-lg transition-all"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={resume}
                    className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Resume
                  </button>
                )}
                <button
                  onClick={skip}
                  className="p-2 rounded-lg bg-surface-3 hover:bg-surface-4 border border-border text-muted-foreground hover:text-foreground transition-all"
                  title="Skip"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={stop}
                  className="p-2 rounded-lg bg-surface-3 hover:bg-surface-4 border border-border text-muted-foreground hover:text-foreground transition-all"
                  title="Stop"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              </>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-brand-500" />
              <span className="text-xs text-muted-foreground">25 min focus</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted-foreground">5 min break</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Sessions today:{" "}
              <span className="text-foreground font-medium">{sessionsCompleted}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
