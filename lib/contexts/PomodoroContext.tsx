"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { usePomodoro, DEFAULT_CONFIG, type PomodoroConfig, type PomodoroPhase } from "@/lib/hooks/usePomodoro";

const CONFIG_LS_KEY = "pomodoro_config_v1";

function loadConfig(): PomodoroConfig {
  try {
    const raw = localStorage.getItem(CONFIG_LS_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_CONFIG;
}

interface PomodoroContextValue {
  phase: PomodoroPhase;
  secondsLeft: number;
  isRunning: boolean;
  sessionsCompleted: number;
  progress: number;
  start: (phase?: PomodoroPhase) => void;
  pause: () => Promise<void>;
  resume: () => void;
  stop: () => Promise<void>;
  skip: () => Promise<void>;
  resetSessions: () => void;
  config: PomodoroConfig;
  updateConfig: (updates: Partial<PomodoroConfig>) => void;
  totalStudyMinutes: number;
  setTotalStudyMinutes: React.Dispatch<React.SetStateAction<number>>;
  currentSessionSavedMinutes: number;
  /** Focus page registers its per-phase transition handler (chime, glow, etc.) */
  setTransitionCallback: (cb: ((from: PomodoroPhase, to: PomodoroPhase) => void) | null) => void;
}

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PomodoroConfig>(DEFAULT_CONFIG);
  const [totalStudyMinutes, setTotalStudyMinutes] = useState(0);
  const transitionCbRef = useRef<((from: PomodoroPhase, to: PomodoroPhase) => void) | null>(null);

  useEffect(() => { setConfig(loadConfig()); }, []);

  const updateConfig = useCallback((updates: Partial<PomodoroConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      try { localStorage.setItem(CONFIG_LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const handleMinutesSaved = useCallback((minutes: number) => {
    setTotalStudyMinutes((prev) => prev + minutes);
  }, []);

  const handleTransition = useCallback((from: PomodoroPhase, to: PomodoroPhase) => {
    transitionCbRef.current?.(from, to);
  }, []);

  const setTransitionCallback = useCallback(
    (cb: ((from: PomodoroPhase, to: PomodoroPhase) => void) | null) => {
      transitionCbRef.current = cb;
    },
    []
  );

  const pomodoro = usePomodoro(config, handleMinutesSaved, handleTransition);

  return (
    <PomodoroContext.Provider value={{
      ...pomodoro,
      config,
      updateConfig,
      totalStudyMinutes,
      setTotalStudyMinutes,
      setTransitionCallback,
    }}>
      {children}
    </PomodoroContext.Provider>
  );
}

export function usePomodoroContext() {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error("usePomodoroContext must be used within PomodoroProvider");
  return ctx;
}
