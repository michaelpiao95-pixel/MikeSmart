"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Home, CheckSquare, BookOpen, BarChart2,
  Zap, Settings, Command, Users, Trophy,
} from "lucide-react";
import { useStreaks } from "@/lib/hooks/useStreak";

const NAV_ITEMS = [
  { href: "/home",        label: "Today",       icon: Home,        shortcut: "G T" },
  { href: "/assignments", label: "Assignments",  icon: CheckSquare, shortcut: "G A" },
  { href: "/courses",     label: "Courses",      icon: BookOpen,    shortcut: "G C" },
  { href: "/focus",       label: "Focus",        icon: Zap,         shortcut: "G F" },
  { href: "/analytics",   label: "Analytics",    icon: BarChart2,   shortcut: "G L" },
  { href: "/friends",     label: "Friends",      icon: Users,       shortcut: ""    },
  { href: "/leaderboard", label: "Leaderboard",  icon: Trophy,      shortcut: ""    },
];

interface SidebarProps {
  onCommandPalette: () => void;
}

export function Sidebar({ onCommandPalette }: SidebarProps) {
  const pathname = usePathname();
  const { getStreak } = useStreaks();
  const taskStreak = getStreak("task_completion");

  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      height: "100vh",
      position: "sticky",
      top: 0,
      display: "flex",
      flexDirection: "column",
      background: "rgba(4,4,7,0.95)",
      borderRight: "1px solid rgba(124,58,237,0.12)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    }}>

      {/* logo */}
      <div style={{ padding: "20px 16px", borderBottom: "1px solid rgba(124,58,237,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "rgba(124,58,237,0.15)",
            border: "1px solid rgba(124,58,237,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 16px rgba(124,58,237,0.2)",
          }}>
            <Zap style={{ width: 14, height: 14, color: "#a78bfa" }} />
          </div>
          <div>
            <div style={{
              fontFamily: "var(--font-syne,'Syne',sans-serif)",
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: "-0.5px",
              background: "linear-gradient(135deg, #fff 0%, #a78bfa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              MikeSmart
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", letterSpacing: "0.05em", textTransform: "uppercase", marginTop: 1 }}>
              Student OS
            </div>
          </div>
        </div>
      </div>

      {/* command palette */}
      <div style={{ padding: "12px 12px 4px" }}>
        <button onClick={onCommandPalette} style={{
          width: "100%",
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px",
          borderRadius: 8,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.35)",
          fontSize: 12, cursor: "pointer",
          transition: "border-color 0.2s, color 0.2s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,58,237,0.3)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; }}>
          <Command style={{ width: 13, height: 13 }} />
          <span style={{ flex: 1, textAlign: "left" }}>Command palette</span>
          <kbd style={{ fontSize: 10, background: "rgba(255,255,255,0.05)", padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>⌘K</kbd>
        </button>
      </div>

      {/* nav */}
      <nav style={{ flex: 1, padding: "8px 12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} style={{ textDecoration: "none" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, transition: "color 0.2s" }}>
                {active && (
                  <motion.div
                    layoutId="sidebar-pill"
                    style={{ position: "absolute", inset: 0, borderRadius: 8, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)" }}
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon style={{ width: 15, height: 15, flexShrink: 0, position: "relative", zIndex: 1, color: active ? "#a78bfa" : "rgba(255,255,255,0.35)", transition: "color 0.2s" }} />
                <span style={{ fontSize: 13, fontWeight: active ? 500 : 400, position: "relative", zIndex: 1, color: active ? "#fff" : "rgba(255,255,255,0.45)", transition: "color 0.2s" }}>
                  {label}
                </span>
                {active && (
                  <motion.span
                    layoutId="sidebar-dot"
                    style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", background: "#7c3aed", position: "relative", zIndex: 1, boxShadow: "0 0 8px rgba(124,58,237,0.6)" }}
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* bottom */}
      <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(124,58,237,0.1)", display: "flex", flexDirection: "column", gap: 4 }}>
        {taskStreak && taskStreak.current_streak > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.18)", display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}
          >
            <span style={{ fontSize: 14 }}>🔥</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#fbbf24" }}>{taskStreak.current_streak} day streak</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>100% tasks done</div>
            </div>
          </motion.div>
        )}

        <Link href="/settings" style={{ textDecoration: "none" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8 }}>
            {pathname === "/settings" && (
              <motion.div
                layoutId="sidebar-pill"
                style={{ position: "absolute", inset: 0, borderRadius: 8, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)" }}
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <Settings style={{ width: 15, height: 15, position: "relative", zIndex: 1, color: pathname === "/settings" ? "#a78bfa" : "rgba(255,255,255,0.35)" }} />
            <span style={{ fontSize: 13, position: "relative", zIndex: 1, color: pathname === "/settings" ? "#fff" : "rgba(255,255,255,0.45)" }}>
              Settings
            </span>
          </div>
        </Link>
      </div>
    </aside>
  );
}
