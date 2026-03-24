"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  BookOpen,
  CheckSquare,
  BarChart2,
  Settings,
  Timer,
  RefreshCw,
  Zap,
} from "lucide-react";

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  group: string;
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const navigate = (path: string) => {
    router.push(path);
    onClose();
  };

  const allItems: PaletteItem[] = [
    {
      id: "home",
      label: "Today",
      description: "Your daily execution dashboard",
      icon: <Home className="w-4 h-4" />,
      group: "Navigation",
      action: () => navigate("/"),
      shortcut: "G T",
    },
    {
      id: "assignments",
      label: "Assignments",
      description: "Canvas checklist & deadlines",
      icon: <CheckSquare className="w-4 h-4" />,
      group: "Navigation",
      action: () => navigate("/assignments"),
      shortcut: "G A",
    },
    {
      id: "courses",
      label: "Courses",
      description: "Academic control center",
      icon: <BookOpen className="w-4 h-4" />,
      group: "Navigation",
      action: () => navigate("/courses"),
      shortcut: "G C",
    },
    {
      id: "analytics",
      label: "Analytics",
      description: "Productivity trends & charts",
      icon: <BarChart2 className="w-4 h-4" />,
      group: "Navigation",
      action: () => navigate("/analytics"),
      shortcut: "G L",
    },
    {
      id: "focus",
      label: "Focus Mode",
      description: "Enter distraction-free mode",
      icon: <Zap className="w-4 h-4" />,
      group: "Navigation",
      action: () => navigate("/focus"),
      shortcut: "G F",
    },
    {
      id: "settings",
      label: "Settings",
      description: "Canvas, profile, preferences",
      icon: <Settings className="w-4 h-4" />,
      group: "Navigation",
      action: () => navigate("/settings"),
    },
    {
      id: "sync",
      label: "Sync Canvas",
      description: "Pull latest assignments & courses",
      icon: <RefreshCw className="w-4 h-4" />,
      group: "Actions",
      action: async () => {
        onClose();
        await fetch("/api/canvas/sync", { method: "POST" });
        router.refresh();
      },
    },
    {
      id: "pomodoro",
      label: "Start Pomodoro",
      description: "25-minute focus session",
      icon: <Timer className="w-4 h-4" />,
      group: "Actions",
      action: () => navigate("/"),
    },
  ];

  const filtered = query
    ? allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.description?.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  const groups = [...new Set(filtered.map((i) => i.group))];

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
      setQuery("");
      setSelected(0);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((v) => Math.min(v + 1, filtered.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((v) => Math.max(v - 1, 0));
    }
    if (e.key === "Enter") {
      filtered[selected]?.action();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  let itemIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4 animate-backdrop-in"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg bg-surface-2 border border-border rounded-xl shadow-2xl overflow-hidden animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <svg
            className="w-4 h-4 text-muted-foreground shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or jump to..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <kbd className="text-xs text-muted-foreground bg-surface-4 px-1.5 py-0.5 rounded border border-border">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No results
            </p>
          ) : (
            groups.map((group) => (
              <div key={group}>
                <p className="px-4 py-1.5 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                  {group}
                </p>
                {filtered
                  .filter((i) => i.group === group)
                  .map((item) => {
                    itemIndex++;
                    const idx = itemIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={item.action}
                        onMouseEnter={() => setSelected(idx)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          selected === idx
                            ? "bg-brand-600/15 text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "shrink-0",
                            selected === idx
                              ? "text-brand-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {item.icon}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-foreground">
                            {item.label}
                          </span>
                          {item.description && (
                            <span className="block text-xs text-muted-foreground truncate">
                              {item.description}
                            </span>
                          )}
                        </span>
                        {item.shortcut && (
                          <span className="text-xs text-muted-foreground/50 shrink-0">
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 flex gap-4 text-xs text-muted-foreground/60">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
