"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Trophy, Pencil, Check, X } from "lucide-react";

type Period = "daily" | "weekly" | "alltime";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  isMe: boolean;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  hours: number;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const RANK_COLORS: Record<number, string> = {
  1: "text-amber-400",
  2: "text-slate-400",
  3: "text-amber-700",
};

function Avatar({ name, email, avatarUrl }: { name: string | null; email: string; avatarUrl?: string | null }) {
  const safeEmail = email || "?";
  const initials = name
    ? name.split(" ").map((n) => n[0]).filter(Boolean).join("").toUpperCase().slice(0, 2)
    : safeEmail[0].toUpperCase();
  const colors = ["bg-indigo-600", "bg-emerald-600", "bg-amber-600", "bg-blue-600", "bg-purple-600", "bg-pink-600"];
  const color = colors[safeEmail.charCodeAt(0) % colors.length];
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? email}
        className="w-9 h-9 rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center font-semibold text-white text-sm shrink-0", color)}>
      {initials}
    </div>
  );
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("weekly");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustHours, setAdjustHours] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    const res = await fetch(`/api/friends/leaderboard?period=${p}`);
    const json = await res.json();
    setEntries(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const myEntry = entries.find((e) => e.isMe);

  const handleAdjust = async () => {
    const h = parseFloat(adjustHours);
    if (isNaN(h) || h < 0) return;
    setSaving(true);
    await fetch("/api/leaderboard/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period, totalHours: h }),
    });
    setSaving(false);
    setAdjusting(false);
    setAdjustHours("");
    load(period);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" />
            Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">You vs your friends — ranked by study hours.</p>
        </div>

        {/* Period toggle */}
        <div className="flex bg-surface-3 rounded-full p-1 gap-0.5">
          {(["daily", "weekly", "alltime"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-full font-medium transition-all",
                period === p ? "bg-surface-0 text-foreground shadow" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p === "daily" ? "Today" : p === "weekly" ? "This Week" : "All Time"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-border border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 bg-surface-2 border border-border rounded-xl">
          <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No data yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Add friends and start studying to see the leaderboard.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top 3 podium if 3+ entries */}
          {entries.length >= 2 && (
            <div className="grid grid-cols-3 gap-3 mb-2">
              {[entries[1], entries[0], entries[2]].filter(Boolean).map((entry, podiumIdx) => {
                const realRank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3;
                const heights = ["h-20", "h-28", "h-16"];
                return (
                  <div key={entry.userId} className={cn(
                    "flex flex-col items-center justify-end bg-surface-2 border rounded-xl p-3 transition-all",
                    entry.isMe ? "border-brand-600/50 bg-brand-600/5" : "border-border",
                    heights[podiumIdx]
                  )}>
                    <span className="text-xl mb-1">{MEDAL[realRank]}</span>
                    <Avatar name={entry.fullName} email={entry.email} avatarUrl={entry.avatarUrl} />
                    <p className="text-xs font-medium text-foreground truncate max-w-full mt-1.5 text-center">
                      {entry.isMe ? "You" : (entry.fullName ?? entry.email.split("@")[0])}
                    </p>
                    <p className="text-xs font-bold tabular-nums text-brand-400">{entry.hours}h</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full ranked list */}
          <div className="bg-surface-2 border border-border rounded-xl divide-y divide-border">
            {entries.map((entry) => (
              <div
                key={entry.userId}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-all",
                  entry.isMe && "bg-brand-600/5"
                )}
              >
                {/* Rank */}
                <div className={cn(
                  "w-7 text-center tabular-nums font-bold text-sm shrink-0",
                  RANK_COLORS[entry.rank] ?? "text-muted-foreground"
                )}>
                  {MEDAL[entry.rank] ?? `#${entry.rank}`}
                </div>

                <Avatar name={entry.fullName} email={entry.email} avatarUrl={entry.avatarUrl} />

                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium truncate",
                    entry.isMe ? "text-brand-400" : "text-foreground"
                  )}>
                    {entry.isMe ? "You" : (entry.fullName ?? entry.email.split("@")[0])}
                    {entry.isMe && <span className="ml-1.5 text-xs text-brand-500/70">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{entry.email}</p>
                </div>

                {/* Hours */}
                <div className="text-right shrink-0">
                  {entry.isMe && adjusting ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        step="0.1"
                        value={adjustHours}
                        onChange={(e) => setAdjustHours(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAdjust(); if (e.key === "Escape") setAdjusting(false); }}
                        placeholder={String(entry.hours)}
                        className="w-16 bg-surface-3 border border-brand-600/40 rounded px-2 py-1 text-sm text-foreground text-right focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <span className="text-xs text-muted-foreground">h</span>
                      <button onClick={handleAdjust} disabled={saving} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setAdjusting(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-sm font-bold tabular-nums text-foreground">{entry.hours}h</p>
                        <p className="text-xs text-muted-foreground">studied</p>
                      </div>
                      {entry.isMe && (
                        <button
                          onClick={() => { setAdjustHours(String(entry.hours)); setAdjusting(true); }}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Adjust your hours"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* My position callout if not in top view */}
          {myEntry && myEntry.rank > 3 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-brand-600/10 border border-brand-600/20 rounded-xl">
              <span className="text-sm font-bold text-brand-400 w-7 text-center">#{myEntry.rank}</span>
              <Avatar name={myEntry.fullName} email={myEntry.email} avatarUrl={myEntry.avatarUrl} />
              <div className="flex-1">
                <p className="text-sm font-medium text-brand-400">Your position</p>
                <p className="text-xs text-muted-foreground">{myEntry.hours}h studied</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
