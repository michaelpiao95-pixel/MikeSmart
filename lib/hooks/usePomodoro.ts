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
  dayTimestamp?: number; // ms timestamp of local midnight — resets sessions when day changes
  date?: string; // legacy, ignored
  sessionId?: string | null; // DB row id of the in-progress focus session — survives remounts so saves update instead of re-insert
  savedMinutes?: number; // minutes already persisted for that row — survives remounts so delta stays incremental
  phaseTotal?: number; // total seconds of the current phase at its start — config edits mid-phase must not shift elapsed math
}

function localMidnightMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
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
  // Duration of the current phase, frozen at phase start — the single source for
  // elapsed/progress math so config changes mid-phase only affect future phases
  const phaseTotalRef = useRef(config.focusMinutes * 60);
  const transitioningRef = useRef(false);
  const sessionStartedAtRef = useRef<Date | null>(null);
  const lastMidnightRef = useRef<number>(localMidnightMs());
  const savedMinutesRef = useRef(0);
  const lastIncrementalSaveRef = useRef(0);
  const currentSessionIdRef = useRef<string | null>(null);
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
          dayTimestamp: localMidnightMs(),
          sessionId: currentSessionIdRef.current,
          savedMinutes: savedMinutesRef.current,
          phaseTotal: phaseTotalRef.current,
          ...overrides,
        };
        localStorage.setItem(LS_KEY, JSON.stringify(state));
      } catch {}
    },
    []
  );

  // Restore from localStorage on mount, then sync session count from DB
  useEffect(() => {
    const init = async () => {
      // 1. Restore timer state from localStorage
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const stored: StoredState = JSON.parse(raw);
          const isNewDay = (stored.dayTimestamp ?? 0) < localMidnightMs();

          if (!isNewDay && stored.phase !== "idle") {
            if (stored.isRunning && stored.endTime) {
              const remaining = Math.round((stored.endTime - Date.now()) / 1000);
              if (remaining > 0) {
                endTimeRef.current = stored.endTime;
                setPhase(stored.phase);
                setSecondsLeft(remaining);
                setIsRunning(true);
                phaseTotalRef.current = stored.phaseTotal ?? getPhaseSeconds(stored.phase);
                if (stored.phase === "focus") {
                  // Re-attach to the in-flight DB row so the next saveIncremental
                  // updates it instead of inserting a duplicate, and delta stays
                  // incremental instead of re-counting the whole session
                  currentSessionIdRef.current = stored.sessionId ?? null;
                  savedMinutesRef.current = stored.savedMinutes ?? 0;
                  const elapsed = phaseTotalRef.current - remaining;
                  sessionStartedAtRef.current = new Date(Date.now() - elapsed * 1000);
                }
              } else {
                // Timer expired while away
                const cfg = configRef.current;
                const nextPhase: PomodoroPhase =
                  stored.phase === "focus"
                    ? (stored.sessionsCompleted + 1) % cfg.sessionsBeforeLongBreak === 0
                      ? "long_break"
                      : "short_break"
                    : "focus";
                const nextSeconds = getPhaseSeconds(nextPhase);
                const overshoot = Math.round((Date.now() - stored.endTime) / 1000);
                setPhase(nextPhase);
                phaseTotalRef.current = nextSeconds;
                if (nextPhase !== "focus" && overshoot < nextSeconds) {
                  // The break began while we were away — auto-run its remainder so
                  // the user isn't forced to press resume. Focus phases are never
                  // auto-started unattended: that would fabricate study time.
                  const breakRemaining = nextSeconds - overshoot;
                  endTimeRef.current = Date.now() + breakRemaining * 1000;
                  setSecondsLeft(breakRemaining);
                  setSessions(stored.sessionsCompleted + 1);
                  setIsRunning(true);
                  writeLS();
                } else {
                  setSecondsLeft(nextSeconds);
                }
              }
            } else {
              // Paused
              setPhase(stored.phase);
              setSecondsLeft(stored.secondsLeft);
              phaseTotalRef.current = stored.phaseTotal ?? getPhaseSeconds(stored.phase);
              if (stored.phase === "focus") {
                // Re-attach paused focus sessions too — without this, saves after
                // resume silently no-op (sessionStartedAt is null) and time is lost
                currentSessionIdRef.current = stored.sessionId ?? null;
                savedMinutesRef.current = stored.savedMinutes ?? 0;
                const elapsed = phaseTotalRef.current - stored.secondsLeft;
                sessionStartedAtRef.current = new Date(Date.now() - elapsed * 1000);
              }
            }
          }
        }
      } catch {}

      // 2. Always get session count from DB — this is the ground truth for today.
      // Count distinct started_at values so old duplicate incremental-save records
      // (which share the same started_at) each count as one session.
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const midnight = new Date();
          midnight.setHours(0, 0, 0, 0);
          const { data } = await supabase
            .from("pomodoro_sessions")
            .select("started_at")
            .eq("user_id", user.id)
            .gte("started_at", midnight.toISOString());
          const unique = new Set((data ?? []).map((s) => s.started_at));
          setSessions(unique.size);
        }
      } catch {}
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-reset sessions at local midnight if app stays open
  useEffect(() => {
    const check = async () => {
      if (localMidnightMs() <= (lastMidnightRef.current ?? 0)) return;
      // A new day has started — re-query DB for fresh count
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const midnight = new Date();
          midnight.setHours(0, 0, 0, 0);
          lastMidnightRef.current = midnight.getTime();
          const { data } = await supabase
            .from("pomodoro_sessions")
            .select("started_at")
            .eq("user_id", user.id)
            .gte("started_at", midnight.toISOString());
          const unique = new Set((data ?? []).map((s) => s.started_at));
          setSessions(unique.size);
          writeLS({ sessionsCompleted: unique.size });
        }
      } catch {}
    };
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [setSessions, writeLS, supabase]);

  const saveIncremental = useCallback(
    async (completed: boolean, overrideElapsed?: number) => {
      if (phaseRef.current !== "focus" || !sessionStartedAtRef.current) return 0;
      // Use timer countdown (not wall clock) so pause time is excluded; measure
      // against the phase's frozen total so config edits mid-phase can't inflate it
      const totalElapsed =
        overrideElapsed ??
        Math.floor((phaseTotalRef.current - secondsLeftRef.current) / 60);
      if (totalElapsed < 1) return 0;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return 0;

      if (currentSessionIdRef.current) {
        // Update the existing record with cumulative elapsed time
        await supabase
          .from("pomodoro_sessions")
          .update({
            duration_minutes: totalElapsed,
            completed,
            ended_at: new Date().toISOString(),
          })
          .eq("id", currentSessionIdRef.current);
      } else {
        // First save — insert a new record
        const { data } = await supabase
          .from("pomodoro_sessions")
          .insert({
            user_id: user.id,
            duration_minutes: totalElapsed,
            completed,
            started_at: sessionStartedAtRef.current.toISOString(),
            ended_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (data) currentSessionIdRef.current = data.id;
      }

      const delta = totalElapsed - savedMinutesRef.current;
      savedMinutesRef.current = totalElapsed;
      // Persist sessionId/savedMinutes now — a refresh between incremental saves
      // must not resurrect stale values and double-count this session
      writeLS();
      if (delta > 0) onMinutesSavedRef.current?.(delta);
      return delta > 0 ? delta : 0;
    },
    [supabase, writeLS]
  );

  // Auto-transition to next phase (called when current phase timer hits 0)
  const transitionToNext = useCallback(async () => {
    const cfg = configRef.current;
    const fromPhase = phaseRef.current;

    if (fromPhase === "focus") {
      await saveIncremental(true);

      const newSessions = sessionsRef.current + 1;
      const nextPhase: PomodoroPhase =
        newSessions % cfg.sessionsBeforeLongBreak === 0 ? "long_break" : "short_break";
      const nextSeconds =
        nextPhase === "long_break" ? cfg.longBreakMinutes * 60 : cfg.shortBreakMinutes * 60;

      setSessions(newSessions);
      setPhase(nextPhase);
      setSecondsLeft(nextSeconds);
      phaseTotalRef.current = nextSeconds;

      const newEndTime = Date.now() + nextSeconds * 1000;
      endTimeRef.current = newEndTime;
      sessionStartedAtRef.current = null;
      savedMinutesRef.current = 0;
      currentSessionIdRef.current = null;

      setIsRunning(true);
      onTransitionRef.current?.(fromPhase, nextPhase);
      writeLS({ phase: nextPhase, endTime: newEndTime, secondsLeft: nextSeconds, isRunning: true, sessionsCompleted: newSessions });
    } else {
      // Break → Focus
      const nextPhase: PomodoroPhase = "focus";
      const nextSeconds = cfg.focusMinutes * 60;

      setPhase(nextPhase);
      setSecondsLeft(nextSeconds);
      phaseTotalRef.current = nextSeconds;

      const newEndTime = Date.now() + nextSeconds * 1000;
      endTimeRef.current = newEndTime;
      sessionStartedAtRef.current = new Date();
      savedMinutesRef.current = 0;
      currentSessionIdRef.current = null;

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
      phaseTotalRef.current = seconds;

      if (targetPhase === "focus") {
        sessionStartedAtRef.current = new Date();
        savedMinutesRef.current = 0;
        currentSessionIdRef.current = null;
        lastIncrementalSaveRef.current = Date.now();
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
    currentSessionIdRef.current = null;
    // Keep sessions count in localStorage (with idle phase) so it survives restarts
    writeLS({ phase: "idle", endTime: null, isRunning: false, secondsLeft: configRef.current.focusMinutes * 60 });
  }, [saveIncremental, setPhase, setSecondsLeft, setIsRunning, writeLS]);

  const skip = useCallback(async () => {
    if (phaseRef.current === "idle" || transitioningRef.current) return;
    transitioningRef.current = true;
    try {
      // transitionToNext swaps phase/endTime in place; if the timer was paused,
      // its setIsRunning(true) restarts the interval via the tick effect
      await transitionToNext();
    } finally {
      transitioningRef.current = false;
    }
  }, [transitionToNext]);

  const resetSessions = useCallback(() => {
    setSessions(0);
    writeLS({ sessionsCompleted: 0 });
  }, [setSessions, writeLS]);

  // When idle, keep secondsLeft in sync with focusMinutes config changes
  useEffect(() => {
    if (phaseRef.current === "idle") {
      setSecondsLeft(config.focusMinutes * 60);
      phaseTotalRef.current = config.focusMinutes * 60;
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
        // Keep the interval alive across the transition — transitionToNext swaps
        // phase/endTime in place, so the next tick continues seamlessly. The old
        // stop→flushSync→restart dance could leave a live-looking timer with a
        // dead interval when the isRunning false→true flip coalesced.
        if (!transitioningRef.current) {
          transitioningRef.current = true;
          setSecondsLeft(0);
          transitionToNext().finally(() => {
            transitioningRef.current = false;
          });
        }
      } else {
        setSecondsLeft(remaining);
        // Save incrementally every 60 seconds while focus is running
        if (phaseRef.current === "focus" && sessionStartedAtRef.current) {
          const now = Date.now();
          if (now - lastIncrementalSaveRef.current >= 60000) {
            lastIncrementalSaveRef.current = now;
            saveIncremental(false);
          }
        }
      }
    }, 250);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, transitionToNext, setSecondsLeft, setIsRunning]);

  // progress: 0 = start (full ring), 1 = end (empty ring) — measured against the
  // phase's frozen total so config edits mid-phase don't jump the ring
  const progress =
    phase === "idle" ? 0 : 1 - secondsLeft / phaseTotalRef.current;

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
    // Minutes already saved to DB for the current focus session (ref value, fresh each render)
    get currentSessionSavedMinutes() { return savedMinutesRef.current; },
    // Total seconds of the current phase, frozen at phase start
    get phaseTotalSeconds() { return phaseTotalRef.current; },
  };
}
