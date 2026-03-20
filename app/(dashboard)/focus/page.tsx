"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePomodoro, type PomodoroConfig, DEFAULT_CONFIG, type PomodoroPhase } from "@/lib/hooks/usePomodoro";
import { useStreaks } from "@/lib/hooks/useStreak";
import { formatTimer, todayISO } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Play, Pause, Square, SkipForward, Flame, Target, Moon, Settings2, ChevronUp, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DailyReflection } from "@/types";

const RING_R = 90;
const RING_CIRCUM = 2 * Math.PI * RING_R;

function CountdownRing({ number, progress, animating, size = 220 }: {
  number: number;
  progress: number;
  animating: boolean;
  size?: number;
}) {
  const r = (size / 220) * RING_R;
  const circum = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg) scale(-1, 1)", transformOrigin: "center" }}
      >
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1f2937" strokeWidth={size === 220 ? 10 : 8} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="#818cf8"
          strokeWidth={size === 220 ? 10 : 8}
          strokeLinecap="round"
          strokeDasharray={circum}
          strokeDashoffset={circum * progress}
          style={{ transition: animating ? "stroke-dashoffset 1s linear" : "none" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          key={number}
          className="font-mono font-bold text-foreground animate-fade-in tabular-nums"
          style={{ fontSize: size === 220 ? "4.5rem" : "3rem" }}
        >
          {number}
        </span>
      </div>
    </div>
  );
}

// Ring stroke color per phase (SVG needs actual color values)
const RING_COLOR: Record<PomodoroPhase, string> = {
  idle:        "#374151",
  focus:       "#818cf8",
  short_break: "#34d399",
  long_break:  "#60a5fa",
};

const PHASE_LABEL: Record<PomodoroPhase, string> = {
  idle:        "Ready",
  focus:       "Focus",
  short_break: "Break",
  long_break:  "Long Break",
};

const PHASE_TEXT_CLASS: Record<PomodoroPhase, string> = {
  idle:        "text-muted-foreground",
  focus:       "text-indigo-400",
  short_break: "text-emerald-400",
  long_break:  "text-blue-400",
};

function playChime() {
  try {
    const ctx = new AudioContext();
    // Major chord arpeggio: C5 → E5 → G5
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.18, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.1);
      osc.start(t0);
      osc.stop(t0 + 1.1);
    });
  } catch {}
}

interface TimerRingProps {
  phase: PomodoroPhase;
  secondsLeft: number;
  progress: number; // 0–1
  glowing: boolean;
  size?: number;
}

function TimerRing({ phase, secondsLeft, progress, glowing, size = 220 }: TimerRingProps) {
  const r = (size / 220) * RING_R;
  const circum = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;
  const color = RING_COLOR[phase];

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Glow layer */}
      {glowing && phase !== "idle" && (
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-20 pointer-events-none"
          style={{ background: color }}
        />
      )}

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg) scale(-1, 1)", transformOrigin: "center" }}
      >
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="#1f2937"
          strokeWidth={size === 220 ? 10 : 8}
        />
        {/* Progress arc */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={size === 220 ? 10 : 8}
          strokeLinecap="round"
          strokeDasharray={circum}
          strokeDashoffset={circum * progress}
          style={{
            transition: "stroke-dashoffset 0.25s linear, stroke 0.6s ease",
          }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <span
          key={phase}
          className={cn(
            "text-xs font-semibold uppercase tracking-widest animate-fade-in",
            PHASE_TEXT_CLASS[phase]
          )}
        >
          {PHASE_LABEL[phase]}
        </span>
        <span
          className="font-mono tabular-nums font-bold text-foreground"
          style={{ fontSize: size === 220 ? "2.5rem" : "1.5rem" }}
        >
          {formatTimer(secondsLeft)}
        </span>
      </div>
    </div>
  );
}

const CONFIG_LS_KEY = "pomodoro_config_v1";

function loadConfig(): PomodoroConfig {
  try {
    const raw = localStorage.getItem(CONFIG_LS_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_CONFIG;
}

export default function FocusPage() {
  const [glowing, setGlowing] = useState(false);
  const glowTimeout = useRef<NodeJS.Timeout | null>(null);
  const [config, setConfig] = useState<PomodoroConfig>(DEFAULT_CONFIG);
  const [showSettings, setShowSettings] = useState(false);

  // Load config from localStorage once on mount
  useEffect(() => { setConfig(loadConfig()); }, []);

  const updateConfig = (updates: Partial<PomodoroConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      try { localStorage.setItem(CONFIG_LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // 3-2-1 countdown before starting/resuming
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cdProgress, setCdProgress] = useState(0);
  const [cdAnimating, setCdAnimating] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const runCountdown = useCallback((action: () => void) => {
    pendingActionRef.current = action;
    setCountdown(3);
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      setCdProgress(0);
      setCdAnimating(false);
      pendingActionRef.current?.();
      pendingActionRef.current = null;
      return;
    }
    // Reset ring, then animate it depleting over 1 second
    setCdAnimating(false);
    setCdProgress(0);
    const t1 = setTimeout(() => {
      setCdAnimating(true);
      setCdProgress(1);
    }, 30);
    const t2 = setTimeout(() => {
      setCountdown((c) => (c !== null ? c - 1 : null));
    }, 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [countdown]);

  const handleTransition = useCallback((_from: PomodoroPhase, _to: PomodoroPhase) => {
    playChime();
    setGlowing(true);
    if (glowTimeout.current) clearTimeout(glowTimeout.current);
    glowTimeout.current = setTimeout(() => setGlowing(false), 700);
  }, []);

  const { phase, secondsLeft, isRunning, sessionsCompleted, progress, start, pause, resume, stop, skip } =
    usePomodoro(config, (minutes) => setTotalStudyMinutes((prev) => prev + minutes), handleTransition);

  const { getStreak, refresh: refreshStreaks } = useStreaks();
  const [focusMode, setFocusMode] = useState(false);
  const [reflection, setReflection] = useState<Partial<DailyReflection>>({
    wins: "", mistakes: "", improvements: "", mood: 3,
  });
  const [reflectionSaved, setReflectionSaved] = useState(false);
  const [totalStudyMinutes, setTotalStudyMinutes] = useState(0);
  const supabase = createClient();
  const taskStreak = getStreak("task_completion");
  const reflectionStreak = getStreak("daily_reflection");

  // Update tab title
  useEffect(() => {
    if (phase === "idle") {
      document.title = "MikeSmart";
      return;
    }
    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const ss = String(secondsLeft % 60).padStart(2, "0");
    document.title = `${mm}:${ss} · ${PHASE_LABEL[phase]}`;
  }, [phase, secondsLeft]);

  // Reset title on unmount
  useEffect(() => () => { document.title = "MikeSmart"; }, []);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = todayISO();
    const [reflRes, pomRes] = await Promise.all([
      fetch(`/api/reflection?date=${today}`),
      supabase.from("pomodoro_sessions")
        .select("duration_minutes")
        .eq("user_id", user.id)
        .gte("started_at", today),
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
    if (res.ok) {
      setReflectionSaved(true);
      refreshStreaks();
    }
  };

  // Focus Mode — minimal fullscreen UI
  if (focusMode) {
    return (
      <div className="fixed inset-0 bg-surface-0 flex flex-col items-center justify-center gap-8">
        <button
          onClick={() => setFocusMode(false)}
          className="absolute top-4 right-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Exit Focus Mode
        </button>

        {countdown !== null ? (
            <CountdownRing number={countdown} progress={cdProgress} animating={cdAnimating} size={300} />
          ) : (
            <TimerRing phase={phase} secondsLeft={secondsLeft} progress={progress} glowing={glowing} size={300} />
          )}

        <div className="flex items-center gap-3">
          {phase === "idle" ? (
            <button
              onClick={() => runCountdown(() => start("focus"))}
              disabled={countdown !== null}
              className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-3 rounded-xl font-semibold transition-all disabled:opacity-50"
            >
              Start
            </button>
          ) : isRunning ? (
            <button
              onClick={pause}
              className="bg-surface-3 hover:bg-surface-4 border border-border text-foreground px-8 py-3 rounded-xl font-semibold transition-all"
            >
              <Pause className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => runCountdown(resume)}
              disabled={countdown !== null}
              className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-3 rounded-xl font-semibold transition-all disabled:opacity-50"
            >
              <Play className="w-5 h-5 fill-current" />
            </button>
          )}
          {phase !== "idle" && (
            <button
              onClick={stop}
              className="bg-surface-3 hover:bg-surface-4 border border-border text-muted-foreground p-3 rounded-xl transition-all"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{sessionsCompleted} sessions today</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
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
          Focus Mode
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Timer card */}
        <div className="bg-surface-2 border border-border rounded-xl p-6 flex flex-col items-center gap-5">
          {countdown !== null ? (
            <CountdownRing number={countdown} progress={cdProgress} animating={cdAnimating} />
          ) : (
            <TimerRing phase={phase} secondsLeft={secondsLeft} progress={progress} glowing={glowing} />
          )}

          {/* Controls */}
          <div className="flex items-center gap-2">
            {phase === "idle" ? (
              <button
                onClick={() => runCountdown(() => start("focus"))}
                disabled={countdown !== null}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Focus
              </button>
            ) : isRunning ? (
              <button
                onClick={pause}
                className="flex items-center gap-2 bg-surface-3 hover:bg-surface-4 border border-border text-foreground px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
              >
                <Pause className="w-4 h-4 fill-current" />
                Pause
              </button>
            ) : (
              <button
                onClick={() => runCountdown(resume)}
                disabled={countdown !== null}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                Resume
              </button>
            )}
            {phase !== "idle" && (
              <>
                <button
                  onClick={skip}
                  className="p-2.5 rounded-lg bg-surface-3 hover:bg-surface-4 border border-border text-muted-foreground hover:text-foreground transition-all"
                  title="Skip"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <button
                  onClick={stop}
                  className="p-2.5 rounded-lg bg-surface-3 hover:bg-surface-4 border border-border text-muted-foreground hover:text-foreground transition-all"
                  title="Stop"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              </>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-6 text-center pt-1 border-t border-border w-full justify-center">
            <div>
              <p className="text-xl font-bold text-foreground tabular-nums">{sessionsCompleted}</p>
              <p className="text-xs text-muted-foreground">sessions today</p>
            </div>
            <div className="w-px bg-border" />
            <div>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {totalStudyMinutes >= 60
                  ? `${Math.floor(totalStudyMinutes / 60)}h ${totalStudyMinutes % 60}m`
                  : `${totalStudyMinutes}m`}
              </p>
              <p className="text-xs text-muted-foreground">study time</p>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Streaks */}
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

          {/* Session dots + settings */}
          <div className="bg-surface-2 border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-brand-400" />
                Session Progress
              </h3>
              <button
                onClick={() => setShowSettings((s) => !s)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Timer settings"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>

            {/* Settings panel */}
            {showSettings && (
              <div className="mb-4 p-3 bg-surface-3 rounded-lg space-y-2 text-xs">
                {[
                  { label: "Focus", key: "focusMinutes" as const, min: 1, max: 90 },
                  { label: "Short break", key: "shortBreakMinutes" as const, min: 1, max: 30 },
                  { label: "Long break", key: "longBreakMinutes" as const, min: 1, max: 60 },
                  { label: "Sessions before long break", key: "sessionsBeforeLongBreak" as const, min: 1, max: 20 },
                ].map(({ label, key, min, max }) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground flex-1">{label}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateConfig({ [key]: Math.max(min, config[key] - 1) })}
                        disabled={phase !== "idle"}
                        className="w-6 h-6 rounded bg-surface-4 hover:bg-surface-0 disabled:opacity-40 flex items-center justify-center transition-colors"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center tabular-nums font-semibold text-foreground">
                        {config[key]}
                      </span>
                      <button
                        onClick={() => updateConfig({ [key]: Math.min(max, config[key] + 1) })}
                        disabled={phase !== "idle"}
                        className="w-6 h-6 rounded bg-surface-4 hover:bg-surface-0 disabled:opacity-40 flex items-center justify-center transition-colors"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      {key !== "sessionsBeforeLongBreak" && (
                        <span className="text-muted-foreground w-5">m</span>
                      )}
                    </div>
                  </div>
                ))}
                {phase !== "idle" && (
                  <p className="text-muted-foreground/60 text-center pt-1">Stop the timer to change settings</p>
                )}
              </div>
            )}

            {/* Dots — all sessions today, grouped by cycle */}
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: Math.max(sessionsCompleted, config.sessionsBeforeLongBreak) }).map((_, i) => {
                const isLongBreakBoundary = i > 0 && i % config.sessionsBeforeLongBreak === 0;
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    {isLongBreakBoundary && (
                      <div className="w-px h-6 bg-blue-500/40 mx-0.5" title="Long break" />
                    )}
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium transition-all",
                        i < sessionsCompleted
                          ? "bg-brand-600 text-white"
                          : "bg-surface-3 text-muted-foreground"
                      )}
                    >
                      {i + 1}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {config.sessionsBeforeLongBreak - (sessionsCompleted % config.sessionsBeforeLongBreak)} sessions until long break
            </p>
          </div>
        </div>
      </div>

      {/* Daily Reflection */}
      <div className="bg-surface-2 border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Daily Reflection</h3>
          {reflectionSaved && (
            <span className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/30 px-2 py-0.5 rounded-full">
              Saved
            </span>
          )}
        </div>

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
