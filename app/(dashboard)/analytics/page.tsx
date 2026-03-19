"use client";

import { useEffect, useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle, TrendingUp, Zap } from "lucide-react";

// ─── Mock-data helpers ────────────────────────────────────────────────────────

function pseudoRandom(dateStr: string, salt: number): number {
  let h = (salt * 2654435761) >>> 0;
  for (const c of dateStr) h = (Math.imul(h ^ c.charCodeAt(0), 0x9e3779b9)) >>> 0;
  return (h % 10000) / 10000;
}

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

interface DayData {
  dateStr: string;
  label: string;
  taskRate: number;   // 0-100
  score: number;      // 0-100
  onTime: boolean;
}

function genDay(dateStr: string, label: string): DayData {
  return {
    dateStr,
    label,
    taskRate: Math.round(42 + pseudoRandom(dateStr, 1) * 53),
    score:    Math.round(38 + pseudoRandom(dateStr, 2) * 57),
    onTime:   pseudoRandom(dateStr, 3) > 0.22,
  };
}

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekDays(): DayData[] {
  const today = new Date();
  const dow = today.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return genDay(toISO(d), ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]);
  });
}

function getPeriodDays(days: number): DayData[] {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = subDays(today, days - 1 - i);
    const label = days <= 7 ? SHORT_DAYS[d.getDay()] : format(d, "MMM d");
    return genDay(toISO(d), label);
  });
}

function getLast14(): DayData[] {
  const today = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = subDays(today, 13 - i);
    return genDay(toISO(d), SHORT_DAYS[d.getDay()]);
  });
}

function calcStreak(days: DayData[]): number {
  let s = 0;
  for (const d of [...days].reverse()) {
    if (d.onTime) s++; else break;
  }
  return s;
}

// ─── Sparkline bar chart ──────────────────────────────────────────────────────

function SparklineBar({ data }: { data: DayData[] }) {
  const todayStr = toISO(new Date());
  return (
    <div className="mt-3">
      <div className="flex items-end gap-0.5" style={{ height: 36 }}>
        {data.map((d, i) => {
          const isToday = d.dateStr === todayStr;
          const h = Math.max(Math.round((d.taskRate / 100) * 36), 3);
          return (
            <div key={i} className="flex-1 flex items-end" title={`${d.label}: ${d.taskRate}%`}>
              <div
                className="w-full rounded-sm transition-all"
                style={{
                  height: h,
                  background: isToday ? "#3dba7a" : "rgba(61,186,122,0.4)",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex mt-1">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-muted-foreground/50" style={{ fontSize: 9 }}>
            {d.label[0]}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Circular arc progress ────────────────────────────────────────────────────

function ArcRing({ pct, color }: { pct: number; color: string }) {
  const r = 27;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 100) / 100);
  return (
    <svg width={70} height={70} className="shrink-0" style={{ transform: "rotate(-90deg)" }}>
      <circle cx={35} cy={35} r={r} fill="none" stroke="#1c1c28" strokeWidth={6} />
      <circle
        cx={35} cy={35} r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${circ}`}
        strokeDashoffset={`${offset}`}
        style={{ transition: "stroke-dashoffset 0.7s ease" }}
      />
    </svg>
  );
}

// ─── 14-day dot timeline ──────────────────────────────────────────────────────

function DotTimeline({ days }: { data?: never; days: DayData[] }) {
  const todayStr = toISO(new Date());
  return (
    <div className="mt-3 flex gap-1">
      {days.map((d, i) => {
        const isToday = d.dateStr === todayStr;
        return (
          <div
            key={i}
            title={`${d.dateStr}: ${d.onTime ? "on time ✓" : "missed"}`}
            className="flex-1 rounded-full transition-all"
            style={{
              height: 8,
              background: isToday
                ? "#60a5fa"
                : d.onTime
                ? "rgba(59,130,246,0.65)"
                : "#1c1c28",
              boxShadow: isToday ? "0 0 6px 2px rgba(96,165,250,0.4)" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Custom recharts tooltip ──────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, unit }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string; unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-0.5">{label}</p>
      <p className="font-semibold text-foreground tabular-nums">{payload[0].value}{unit}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ChartTab = "taskRate" | "score" | "streak";

const TAB_CFG: Record<ChartTab, { label: string; color: string; unit: string; yFmt: (v: number) => string; domain: [number, string | number] }> = {
  taskRate: { label: "Tasks % Done", color: "#3dba7a", unit: "%",  yFmt: (v) => `${v}%`,  domain: [0, 100] },
  score:    { label: "Avg. Score",   color: "#f59e0b", unit: "%",  yFmt: (v) => `${v}%`,  domain: [0, 100] },
  streak:   { label: "Streak",       color: "#3b82f6", unit: "d",  yFmt: (v) => `${v}d`,  domain: [0, "auto"] },
};

export default function AnalyticsPage() {
  const [studyData, setStudyData] = useState<{ hours: number; sessions: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 14 | 30>(7);
  const [activeTab, setActiveTab] = useState<ChartTab>("taskRate");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?days=${period}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.summary) {
          setStudyData({
            hours: json.data.summary.totalStudyHours,
            sessions: json.data.summary.totalPomodoros,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  const weekData  = useMemo(() => getWeekDays(), []);
  const last14    = useMemo(() => getLast14(), []);
  const periodData = useMemo(() => getPeriodDays(period), [period]);

  const weekAvgTask  = Math.round(weekData.reduce((s, d) => s + d.taskRate, 0) / 7);
  const weekAvgScore = Math.round(weekData.reduce((s, d) => s + d.score, 0) / 7);
  const streak = calcStreak(last14);

  const chartData = useMemo(() => {
    let run = 0;
    return periodData.map((d) => {
      if (d.onTime) run++; else run = 0;
      return { label: d.label, taskRate: d.taskRate, score: d.score, streak: run };
    });
  }, [periodData]);

  const tab = TAB_CFG[activeTab];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Productivity trends and patterns.</p>
        </div>
        {/* Period toggle */}
        <div className="flex bg-surface-3 rounded-full p-1 gap-0.5">
          {([7, 14, 30] as const).map((d) => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={cn(
                "px-4 py-1.5 text-sm rounded-full font-medium transition-all",
                period === d
                  ? "bg-surface-0 text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Card 1 — Study Hours (real data) */}
        <div className="bg-surface-2 border border-border rounded-xl p-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/15 flex items-center justify-center mb-3">
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          {loading ? (
            <div className="h-7 w-14 rounded bg-surface-3 animate-pulse mb-1" />
          ) : (
            <p className="text-2xl font-bold text-foreground tabular-nums">{studyData?.hours ?? 0}h</p>
          )}
          <p className="text-xs font-medium text-muted-foreground mt-0.5">Study Hours</p>
          <p className="text-xs text-muted-foreground/60">
            {loading ? "—" : `${studyData?.sessions ?? 0} sessions`}
          </p>
        </div>

        {/* Card 2 — Tasks Done This Week */}
        <div className="bg-surface-2 border border-border rounded-xl p-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
            style={{ background: "#0f3d2a" }}
          >
            <CheckCircle className="w-4 h-4" style={{ color: "#3dba7a" }} />
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">{weekAvgTask}%</p>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">Tasks Done</p>
          <p className="text-xs text-muted-foreground/60">This week avg.</p>
          <SparklineBar data={weekData} />
        </div>

        {/* Card 3 — Avg. Score */}
        <div className="bg-surface-2 border border-border rounded-xl p-4">
          <div className="w-8 h-8 rounded-lg bg-amber-600/15 flex items-center justify-center mb-3">
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-2xl font-bold text-foreground tabular-nums">{weekAvgScore}%</p>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">Avg. Score</p>
              <p className="text-xs text-muted-foreground/60">Daily completion rate</p>
            </div>
            <ArcRing pct={weekAvgScore} color="#f59e0b" />
          </div>
        </div>

        {/* Card 4 — Assignment Streak */}
        <div className="bg-surface-2 border border-border rounded-xl p-4">
          <div className="w-8 h-8 rounded-lg bg-blue-600/15 flex items-center justify-center mb-3">
            <Zap className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums flex items-center gap-1.5">
            {streak}
            {streak >= 3 && <span className="text-xl leading-none">🔥</span>}
          </p>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">Assignment Streak</p>
          <p className="text-xs text-muted-foreground/60">On-time submissions</p>
          <DotTimeline days={last14} />
        </div>
      </div>

      {/* Full-width chart panel */}
      <div
        className="rounded-xl border border-[#2a2a4a] p-5"
        style={{ background: "#1a1a2e" }}
      >
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          {/* Tab buttons */}
          <div className="flex gap-1 bg-surface-3/50 rounded-lg p-1">
            {(Object.entries(TAB_CFG) as [ChartTab, typeof TAB_CFG[ChartTab]][]).map(([key, t]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  activeTab === key
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                style={
                  activeTab === key
                    ? { background: t.color + "22", color: t.color }
                    : {}
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground/60">Last {period} days</span>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={tab.color} stopOpacity={0.28} />
                <stop offset="95%" stopColor={tab.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#44446a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#44446a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={tab.domain}
              tickFormatter={tab.yFmt}
              width={34}
            />
            <Tooltip
              content={(props) => (
                <ChartTooltip
                  active={props.active}
                  payload={props.payload as Array<{ value: number }>}
                  label={props.label as string}
                  unit={tab.unit}
                />
              )}
              cursor={{ stroke: tab.color, strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            <Area
              key={activeTab}
              type="monotone"
              dataKey={activeTab}
              stroke={tab.color}
              fill="url(#aGrad)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: tab.color, stroke: "#1a1a2e", strokeWidth: 2 }}
              animationDuration={400}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
