"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  CheckSquare,
  BookOpen,
  BarChart2,
  Zap,
  Settings,
  Command,
  Users,
  Trophy,
} from "lucide-react";
import { useStreaks } from "@/lib/hooks/useStreak";

const NAV_ITEMS = [
  { href: "/", label: "Today", icon: Home, shortcut: "G T" },
  { href: "/assignments", label: "Assignments", icon: CheckSquare, shortcut: "G A" },
  { href: "/courses", label: "Courses", icon: BookOpen, shortcut: "G C" },
  { href: "/focus", label: "Focus", icon: Zap, shortcut: "G F" },
  { href: "/analytics", label: "Analytics", icon: BarChart2, shortcut: "G L" },
  { href: "/friends", label: "Friends", icon: Users, shortcut: "" },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy, shortcut: "" },
];

interface SidebarProps {
  onCommandPalette: () => void;
}

export function Sidebar({ onCommandPalette }: SidebarProps) {
  const pathname = usePathname();
  const { getStreak } = useStreaks();
  const taskStreak = getStreak("task_completion");

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col bg-surface-1 border-r border-border">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600/20 border border-brand-600/30 flex items-center justify-center animate-pulse-glow">
            <svg
              className="w-4 h-4 text-brand-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-gradient-animated">MikeSmart</div>
            <div className="text-xs text-muted-foreground">Student Dashboard</div>
          </div>
        </div>
      </div>

      {/* Command palette button */}
      <div className="px-3 pt-3">
        <button
          onClick={onCommandPalette}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-3 border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-all text-sm"
        >
          <Command className="w-3.5 h-3.5" />
          <span className="flex-1 text-left text-xs">Command palette</span>
          <kbd className="text-xs bg-surface-4 px-1 rounded">⌘K</kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto mt-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
                active
                  ? "bg-brand-600/15 text-brand-400 font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-3"
              )}
            >
              <Icon className={cn("w-4 h-4", active && "text-brand-400")} />
              {label}
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t border-border space-y-1">
        {/* Streak display */}
        {taskStreak && taskStreak.current_streak > 0 && (
          <div className="px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-900/30 flex items-center gap-2 mb-2">
            <span className="text-base">🔥</span>
            <div>
              <div className="text-xs font-medium text-amber-400">
                {taskStreak.current_streak} day streak
              </div>
              <div className="text-xs text-muted-foreground">Keep it up!</div>
            </div>
          </div>
        )}

        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
            pathname === "/settings"
              ? "bg-brand-600/15 text-brand-400"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-3"
          )}
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
