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

const LS_KEY = "pomodoro_state_v2";

interface StoredState {
  phase: PomodoroPhase;
  endTime: number | null;
  secondsLeft: number;
  isRunning: boolean;
  sessionsCompleted: number;
  date?: string; // YYYY-MM-DD — used to reset count daily
}

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

export function usePomodoro(
  config: PomodoroConfig = DEFAULT_CONFIG,
  onMinutesSaved?: (minutes: number) => void,
  onTransition?: (from: PomodoroPhase, to: PomodoroPhase) => void
) {
  const configRef = useRef(config);
  configRef.current = config;

  const getPhaseSeconds = useCallback((p: PomodoroPhase) => {
    const cfg = configRef.current;
    if (p === "focus") return cfg.focusMinutes * 60;
    if (p === "short_break") return cfg.shortBreakMinutes * 60;
    if (p === "long_break") return cfg.longBreakMinutes * 60;
    return cfg.focusMinutes * 60;
  }, []);

  // State — mirrored in refs to avoid stale closures in callbacks/intervals
  const [phase, setPhaseState] = useState<PomodoroPhase>("idle");
  const [secondsLeft, setSecondsLeftState] = useState(config.focusMinutes * 60);
  const [isRunning, setIsRunningState] = useState(false);
  const [sessionsCompleted, setSessionsState] = useState(0);

  const phaseRef = useRef<PomodoroPhase>("idle");
  const secondsLeftRef = useRef(config.focusMinutes * 60);
  const isRunningRef = useRef(false);
  const sessionsRef = useRef(0);

  const setPhase = useCallback((p: PomodoroPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const setSecondsLeft = useCallback((s: number) => {
    secondsLeftRef.current = s;
    setSecondsLeftState(s);
  }, []);
  const setIsRunning = useCallback((r: boolean) => {
    isRunningRef.current = r;
    setIsRunningState(r);
  }, []);
  const setSessions = useCallback((n: number) => {
    sessionsRef.current = n;
    setSessionsState(n);
  }, []);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const endTimeRef = useRef<number | null>(null);
  const sessionStartedAtRef = useRef<Date | null>(null);
  const savedMinutesRef = useRef(0);
  const onMinutesSavedRef = useRef(onMinutesSaved);
  onMinutesSavedRef.current = onMinutesSaved;
  const onTransitionRef = useRef(onTransition);
  onTransitionRef.current = onTransition;

  // Stable supabase client — createClient() must not run on every render
  const supabase = useRef(createClient()).current;

  const writeLS = useCallback(
    (overrides?: Partial<StoredState>) => {
      try {
        const state: StoredState = {
          phase: phaseRef.current,
          endTime: endTimeRef.current,
          secondsLeft: secondsLeftRef.current,
          isRunning: isRunningRef.current,
          sessionsCompleted: sessionsRef.current,
          date: todayDate(),
          ...overrides,
        };
        localStorage.setItem(LS_KEY, JSON.stringify(state));
      } catch {}
    },
    []
  );

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const stored: StoredState = JSON.parse(raw);

      // Always restore today's session count; reset to 0 if it's a new day
      const storedSessions = stored.date === todayDate() ? stored.sessionsCompleted : 0;

      if (stored.phase === "idle" || stored.date !== todayDate()) {
        // Just restore the session count for today, leave timer idle
        setSessions(storedSessions);
        return;
      }

      if (stored.isRunning && stored.endTime) {
        const remaining = Math.round((stored.endTime - Date.now()) / 1000);
        if (remaining > 0) {
          endTimeRef.current = stored.endTime;
          setPhase(stored.phase);
          setSecondsLeft(remaining);
          setSessions(storedSessions);
          setIsRunning(true);
          if (stored.phase === "focus") {
            // Approximate start time from remaining seconds
            const cfg = configRef.current;
            const elapsed = cfg.focusMinutes * 60 - remaining;
            sessionStartedAtRef.current = new Date(Date.now() - elapsed * 1000);
          }
          return;
        }
        // Timer expired while away — show next phase ready but not running
        const cfg = configRef.current;
        const newSessions =
          stored.phase === "focus" ? storedSessions + 1 : storedSessions;
        const nextPhase: PomodoroPhase =
          stored.phase === "focus"
            ? newSessions % cfg.sessionsBeforeLongBreak === 0
              ? "long_break"
              : "short_break"
            : "focus";
        setPhase(nextPhase);
        setSecondsLeft(getPhaseSeconds(nextPhase));
        setSessions(newSessions);
        return;
      }

      // Was paused — restore paused state
      setPhase(stored.phase);
      setSecondsLeft(stored.secondsLeft);
      setSessions(storedSessions);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Auto-transition to next phase (called when current phase timer hits 0)
  const transitionToNext = useCallback(async () => {
    const cfg = configRef.current;
    const fromPhase = phaseRef.current;

    if (fromPhase === "focus") {
      await saveIncremental(true, cfg.focusMinutes);

      const newSessions = sessionsRef.current + 1;
      const nextPhase: PomodoroPhase =
        newSessions % cfg.sessionsBeforeLongBreak === 0 ? "long_break" : "short_break";
      const nextSeconds =
        nextPhase === "long_break" ? cfg.longBreakMinutes * 60 : cfg.shortBreakMinutes * 60;

      setSessions(newSessions);
      setPhase(nextPhase);
      setSecondsLeft(nextSeconds);

      const newEndTime = Date.now() + nextSeconds * 1000;
      endTimeRef.current = newEndTime;
      sessionStartedAtRef.current = null;
      savedMinutesRef.current = 0;

      setIsRunning(true);
      onTransitionRef.current?.(fromPhase, nextPhase);
      writeLS({ phase: nextPhase, endTime: newEndTime, secondsLeft: nextSeconds, isRunning: true, sessionsCompleted: newSessions });
    } else {
      // Break → Focus
      const nextPhase: PomodoroPhase = "focus";
      const nextSeconds = cfg.focusMinutes * 60;

      setPhase(nextPhase);
      setSecondsLeft(nextSeconds);

      const newEndTime = Date.now() + nextSeconds * 1000;
      endTimeRef.current = newEndTime;
      sessionStartedAtRef.current = new Date();
      savedMinutesRef.current = 0;

      setIsRunning(true);
      onTransitionRef.current?.(fromPhase, nextPhase);
      writeLS({ phase: nextPhase, endTime: newEndTime, secondsLeft: nextSeconds, isRunning: true, sessionsCompleted: sessionsRef.current });
    }
  }, [saveIncremental, setPhase, setSecondsLeft, setIsRunning, setSessions, writeLS]);

  const start = useCallback(
    (targetPhase: PomodoroPhase = "focus") => {
      const seconds = getPhaseSeconds(targetPhase);
      const newEndTime = Date.now() + seconds * 1000;

      endTimeRef.current = newEndTime;
      setPhase(targetPhase);
      setSecondsLeft(seconds);

      if (targetPhase === "focus") {
        sessionStartedAtRef.current = new Date();
        savedMinutesRef.current = 0;
      }

      setIsRunning(true);
      writeLS({ phase: targetPhase, endTime: newEndTime, secondsLeft: seconds, isRunning: true });
    },
    [getPhaseSeconds, setPhase, setSecondsLeft, setIsRunning, writeLS]
  );

  const pause = useCallback(async () => {
    setIsRunning(false);
    endTimeRef.current = null;
    await saveIncremental(false);
    writeLS({ endTime: null, isRunning: false });
  }, [saveIncremental, setIsRunning, writeLS]);

  const resume = useCallback(() => {
    const newEndTime = Date.now() + secondsLeftRef.current * 1000;
    endTimeRef.current = newEndTime;
    setIsRunning(true);
    writeLS({ endTime: newEndTime, isRunning: true });
  }, [setIsRunning, writeLS]);

  const stop = useCallback(async () => {
    setIsRunning(false);
    endTimeRef.current = null;
    await saveIncremental(false);
    setPhase("idle");
    setSecondsLeft(configRef.current.focusMinutes * 60);
    sessionStartedAtRef.current = null;
    savedMinutesRef.current = 0;
    // Keep sessions count in localStorage (with idle phase) so it survives restarts
    writeLS({ phase: "idle", endTime: null, isRunning: false, secondsLeft: configRef.current.focusMinutes * 60 });
  }, [saveIncremental, setPhase, setSecondsLeft, setIsRunning, writeLS]);

  const skip = useCallback(async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    endTimeRef.current = null;
    await transitionToNext();
  }, [transitionToNext, setIsRunning]);

  const resetSessions = useCallback(() => {
    setSessions(0);
    writeLS({ sessionsCompleted: 0 });
  }, [setSessions, writeLS]);

  // When idle, keep secondsLeft in sync with focusMinutes config changes
  useEffect(() => {
    if (phaseRef.current === "idle") {
      setSecondsLeft(config.focusMinutes * 60);
    }
  }, [config.focusMinutes, setSecondsLeft]);

  // Tick — Date.now()-based so it stays accurate when tab is backgrounded
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      if (!endTimeRef.current) return;
      const remaining = Math.round((endTimeRef.current - Date.now()) / 1000);

      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setSecondsLeft(0);
        setIsRunning(false);
        transitionToNext();
      } else {
        setSecondsLeft(remaining);
      }
    }, 250);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, transitionToNext, setSecondsLeft, setIsRunning]);

  // progress: 0 = start (full ring), 1 = end (empty ring)
  const progress =
    phase === "idle" ? 0 : 1 - secondsLeft / getPhaseSeconds(phase);

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
    resetSessions,
  };
}
