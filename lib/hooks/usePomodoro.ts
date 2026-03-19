"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type PomodoroPhase = "focus" | "short_break" | "long_break" | "idle";

export interface PomodoroConfig {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
}

export const DEFAULT_CONFIG: PomodoroConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

export function usePomodoro(
  config: PomodoroConfig = DEFAULT_CONFIG,
  onMinutesSaved?: (minutes: number) => void
) {
  const [phase, setPhase] = useState<PomodoroPhase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(config.focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Use refs for values needed in callbacks to avoid stale closures
  const sessionStartedAtRef = useRef<Date | null>(null);
  const savedMinutesRef = useRef(0); // minutes already persisted for current session
  const phaseRef = useRef<PomodoroPhase>("idle");
  const onMinutesSavedRef = useRef(onMinutesSaved);
  onMinutesSavedRef.current = onMinutesSaved;

  const supabase = createClient();

  const getPhaseSeconds = useCallback(
    (p: PomodoroPhase) => {
      if (p === "focus") return config.focusMinutes * 60;
      if (p === "short_break") return config.shortBreakMinutes * 60;
      if (p === "long_break") return config.longBreakMinutes * 60;
      return config.focusMinutes * 60;
    },
    [config]
  );

  /**
   * Save unsaved focus minutes to DB incrementally.
   * Uses savedMinutesRef to track what's already been written — no double counting.
   * overrideElapsed: force a specific total elapsed (used when timer hits 0 exactly).
   */
  const saveIncremental = useCallback(
    async (completed: boolean, overrideElapsed?: number) => {
      if (phaseRef.current !== "focus" || !sessionStartedAtRef.current) return 0;

      const totalElapsed =
        overrideElapsed ??
        Math.floor((Date.now() - sessionStartedAtRef.current.getTime()) / 60000);
      const toSave = totalElapsed - savedMinutesRef.current;
      if (toSave < 1) return 0;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return 0;

      await supabase.from("pomodoro_sessions").insert({
        user_id: user.id,
        duration_minutes: toSave,
        completed,
        started_at: sessionStartedAtRef.current.toISOString(),
        ended_at: new Date().toISOString(),
      });

      savedMinutesRef.current += toSave;
      onMinutesSavedRef.current?.(toSave);
      return toSave;
    },
    [supabase]
  );

  const start = useCallback(
    (targetPhase: PomodoroPhase = "focus") => {
      setPhase(targetPhase);
      phaseRef.current = targetPhase;
      setSecondsLeft(getPhaseSeconds(targetPhase));
      setIsRunning(true);
      sessionStartedAtRef.current = new Date();
      savedMinutesRef.current = 0;
    },
    [getPhaseSeconds]
  );

  // Pause: save elapsed minutes so far, then pause
  const pause = useCallback(async () => {
    setIsRunning(false);
    await saveIncremental(false);
  }, [saveIncremental]);

  const resume = useCallback(() => setIsRunning(true), []);

  // Stop: save any remaining unsaved minutes, then reset
  const stop = useCallback(async () => {
    setIsRunning(false);
    await saveIncremental(false);
    setPhase("idle");
    phaseRef.current = "idle";
    setSecondsLeft(config.focusMinutes * 60);
    sessionStartedAtRef.current = null;
    savedMinutesRef.current = 0;
  }, [saveIncremental, config.focusMinutes]);

  const skip = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    if (phaseRef.current === "focus") {
      setSessionsCompleted((c) => {
        const nc = c + 1;
        const nextPhase =
          nc % config.sessionsBeforeLongBreak === 0 ? "long_break" : "short_break";
        setPhase(nextPhase);
        phaseRef.current = nextPhase;
        setSecondsLeft(getPhaseSeconds(nextPhase));
        return nc;
      });
    } else {
      setPhase("focus");
      phaseRef.current = "focus";
      setSecondsLeft(getPhaseSeconds("focus"));
    }
  }, [config.sessionsBeforeLongBreak, getPhaseSeconds]);

  // Tick
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          if (phaseRef.current === "focus") {
            // Save the remaining unsaved minutes (override elapsed = full session length)
            saveIncremental(true, config.focusMinutes);
            setSessionsCompleted((c) => {
              const nc = c + 1;
              const nextPhase =
                nc % config.sessionsBeforeLongBreak === 0 ? "long_break" : "short_break";
              setPhase(nextPhase);
              phaseRef.current = nextPhase;
              setSecondsLeft(getPhaseSeconds(nextPhase));
              return nc;
            });
            setIsRunning(false);
          } else {
            setPhase("focus");
            phaseRef.current = "focus";
            setSecondsLeft(getPhaseSeconds("focus"));
            setIsRunning(false);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [
    isRunning,
    config.focusMinutes,
    config.sessionsBeforeLongBreak,
    getPhaseSeconds,
    saveIncremental,
  ]);

  const progress =
    phase === "idle"
      ? 0
      : ((getPhaseSeconds(phase) - secondsLeft) / getPhaseSeconds(phase)) * 100;

  return {
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
  };
}
