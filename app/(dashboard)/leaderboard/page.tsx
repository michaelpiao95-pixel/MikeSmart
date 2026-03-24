"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Trophy, Pencil, Check, X, Ban, ShieldOff, ChevronDown, ChevronUp } from "lucide-react";

type Period = "daily" | "weekly" | "alltime";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  isMe: boolean;
  isAdmin: boolean;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  hours: number;
  isBanned: boolean;
  isPermanentBan: boolean;
  bannedUntil: string | null;
}

interface BannedUser {
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  bannedUntil: string;
  isPermanent: boolean;
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
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustHours, setAdjustHours] = useState("");
  const [saving, setSaving] = useState(false);
  const [banTarget, setBanTarget] = useState<LeaderboardEntry | null>(null);
  const [banHours, setBanHours] = useState<number>(24);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [showBannedPanel, setShowBannedPanel] = useState(false);
  const [loadingBanned, setLoadingBanned] = useState(false);

  const loadBanned = useCallback(async () => {
    setLoadingBanned(true);
    const res = await fetch("/api/admin/banned");
    if (res.ok) {
      const json = await res.json();
      setBannedUsers(json.data ?? []);
    }
    setLoadingBanned(false);
  }, []);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    const res = await fetch(`/api/friends/leaderboard?period=${p}`);
    const json = await res.json();
    setEntries(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const myEntry = entries.find((e) => e.isMe);

  const isAdmin = entries.some((e) => e.isMe && e.isAdmin);

  const handleAdjust = async (userId: string) => {
    const h = parseFloat(adjustHours);
    if (isNaN(h) || h < 0) return;
    setSaving(true);
    await fetch("/api/leaderboard/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period, totalHours: h, userId }),
    });
    setSaving(false);
    setAdjustingId(null);
    setAdjustHours("");
    load(period);
  };

  const handleBan = async () => {
    if (!banTarget) return;
    setSaving(true);
    await fetch("/api/admin/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: banTarget.userId, hours: banHours }),
    });
    setSaving(false);
    setBanTarget(null);
    load(period);
  };

  const handleUnban = async (userId: string) => {
    await fetch("/api/admin/ban", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    load(period);
    loadBanned();
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
          <div className="bg-surface-2 border border-border rounded-xl divide-y divide-border stagger-children">
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

                {/* Hours + admin controls */}
                <div className="flex items-center gap-2 shrink-0">
                  {isAdmin && !entry.isMe && (
                    entry.isBanned ? (
                      <button
                        onClick={() => handleUnban(entry.userId)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                        title="Unban"
                      >
                        <ShieldOff className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => { setBanTarget(entry); setBanHours(24); }}
                        className="text-muted-foreground hover:text-red-400 transition-colors"
                        title="Ban user"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}

                  {adjustingId === entry.userId ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        step="0.1"
                        value={adjustHours}
                        onChange={(e) => setAdjustHours(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAdjust(entry.userId); if (e.key === "Escape") setAdjustingId(null); }}
                        placeholder={String(entry.hours)}
                        className="w-16 bg-surface-3 border border-brand-600/40 rounded px-2 py-1 text-sm text-foreground text-right focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <span className="text-xs text-muted-foreground">h</span>
                      <button onClick={() => handleAdjust(entry.userId)} disabled={saving} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setAdjustingId(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className={cn("text-sm font-bold tabular-nums", entry.isBanned ? "text-red-400 line-through" : "text-foreground")}>
                          {entry.hours}h
                        </p>
                        {entry.isBanned ? (
                          <p className="text-xs text-red-400">
                            {entry.isPermanentBan ? "Perm banned" : `Banned`}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">studied</p>
                        )}
                      </div>
                      {isAdmin && !entry.isBanned && (
                        <button
                          onClick={() => { setAdjustHours(String(entry.hours)); setAdjustingId(entry.userId); }}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Adjust hours"
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

      {/* Admin — Banned Users panel */}
      {isAdmin && (
        <div className="bg-surface-2 border border-red-900/30 rounded-xl overflow-hidden">
          <button
            onClick={() => {
              if (!showBannedPanel) loadBanned();
              setShowBannedPanel((v) => !v);
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-950/10 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Ban className="w-4 h-4" />
              Banned Users
              {bannedUsers.length > 0 && (
                <span className="text-xs bg-red-600/20 text-red-400 border border-red-600/30 px-1.5 py-0.5 rounded-full">
                  {bannedUsers.length}
                </span>
              )}
            </span>
            {showBannedPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showBannedPanel && (
            <div className="border-t border-red-900/20 divide-y divide-border">
              {loadingBanned ? (
                <div className="flex justify-center py-6">
                  <div className="w-4 h-4 border-2 border-border border-t-red-500 rounded-full animate-spin" />
                </div>
              ) : bannedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No users are currently banned.</p>
              ) : (
                bannedUsers.map((u) => {
                  const until = new Date(u.bannedUntil);
                  return (
                    <div key={u.userId} className="flex items-center gap-3 px-4 py-3">
                      <Avatar name={u.fullName} email={u.email} avatarUrl={u.avatarUrl} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {u.fullName ?? u.email.split("@")[0]}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.email}
                        </p>
                        <p className="text-xs text-red-400 mt-0.5">
                          {u.isPermanent
                            ? "Permanently banned"
                            : `Banned until ${until.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${until.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUnban(u.userId)}
                        className="shrink-0 flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-900/30 px-3 py-1.5 rounded-lg transition-all"
                      >
                        <ShieldOff className="w-3.5 h-3.5" />
                        Unban
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Ban modal */}
      {banTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-backdrop-in">
          <div className="bg-surface-1 border border-border rounded-xl p-6 w-full max-w-sm space-y-4 animate-modal-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-400" />
                Ban {banTarget.fullName ?? banTarget.email}
              </h3>
              <button onClick={() => setBanTarget(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Duration</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: "1h", value: 1 },
                  { label: "24h", value: 24 },
                  { label: "48h", value: 48 },
                  { label: "72h", value: 72 },
                  { label: "Forever", value: -1 },
                ].map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setBanHours(value)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium border transition-all",
                      banHours === value
                        ? value === -1
                          ? "bg-red-700/30 border-red-600/50 text-red-300"
                          : "bg-red-600/20 border-red-600/40 text-red-400"
                        : "bg-surface-3 border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setBanTarget(null)} className="flex-1 py-2 rounded-lg text-sm border border-border bg-surface-3 text-muted-foreground hover:text-foreground transition-all">
                Cancel
              </button>
              <button onClick={handleBan} disabled={saving} className="flex-1 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium transition-all">
                {saving ? "Banning..." : "Confirm Ban"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
