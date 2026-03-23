"use client";

import { usePomodoroContext } from "@/lib/contexts/PomodoroContext";
import { formatTimer } from "@/lib/utils";
import { Play, Pause, Square, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PomodoroPhase } from "@/lib/hooks/usePomodoro";

const PHASE_LABELS: Record<PomodoroPhase, string> = {
  idle: "Ready",
  focus: "Focus",
  short_break: "Break",
  long_break: "Long Break",
};

const RING_COLOR: Record<PomodoroPhase, string> = {
  idle:        "#374151",
  focus:       "#818cf8",
  short_break: "#34d399",
  long_break:  "#60a5fa",
};

const PHASE_TEXT_CLASS: Record<PomodoroPhase, string> = {
  idle:        "text-muted-foreground",
  focus:       "text-indigo-400",
  short_break: "text-emerald-400",
  long_break:  "text-blue-400",
};

const SIZE = 128;
const R = 54;
const CIRCUM = 2 * Math.PI * R;
const CX = SIZE / 2;
const CY = SIZE / 2;

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
    config,
  } = usePomodoroContext();

  const color = RING_COLOR[phase];

  return (
    <div className="bg-surface-2 border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Deep Work Timer</h3>
        <div className="flex gap-1">
          {Array.from({ length: config.sessionsBeforeLongBreak }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                i < sessionsCompleted % config.sessionsBeforeLongBreak
                  ? "bg-brand-500"
                  : "bg-surface-4"
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Ring — same style as Focus page TimerRing */}
        <div
          className="relative shrink-0 flex items-center justify-center"
          style={{ width: SIZE, height: SIZE }}
        >
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            style={{ transform: "rotate(-90deg) scale(-1, 1)", transformOrigin: "center" }}
          >
            {/* Track */}
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#1f2937" strokeWidth={8} />
            {/* Progress arc */}
            <circle
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={color}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={CIRCUM}
              strokeDashoffset={CIRCUM * progress}
              style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.6s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span className={cn("text-xs font-semibold uppercase tracking-widest", PHASE_TEXT_CLASS[phase])}>
              {PHASE_LABELS[phase]}
            </span>
            <span className="text-xl font-bold font-mono text-foreground tabular-nums">
              {formatTimer(secondsLeft)}
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
              <span className="text-xs text-muted-foreground">{config.focusMinutes} min focus</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted-foreground">{config.shortBreakMinutes} min break</span>
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
