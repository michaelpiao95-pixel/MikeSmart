"use client";

import { useEffect, useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayLabel(dateStr: string, period: number): string {
  const d = parseISO(dateStr);
  return period <= 7 ? SHORT_DAYS[d.getDay()] : format(d, "MMM d");
}

function ChartTooltip({ active, payload, label, unit, decimals = 0 }: {
  active?: boolean;
  payload?: Array<{ value: number | null }>;
  label?: string;
  unit: string;
  decimals?: number;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  if (val == null) return null;
  return (
    <div className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-0.5">{label}</p>
      <p className="font-semibold text-foreground tabular-nums">
        {decimals > 0 ? val.toFixed(decimals) : val}{unit}
      </p>
    </div>
  );
}

function StudyHoursChart({ data, loading }: {
  data: Array<{ label: string; value: number }>;
  loading: boolean;
}) {
  return (
    <div className="bg-surface-2 border border-border rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Study Hours</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Hours studied per day</p>
      </div>
      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-border border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={192}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -32, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-study" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#818cf8" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#6b7280", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis hide />
            <Tooltip
              content={(props) => (
                <ChartTooltip
                  active={props.active}
                  payload={props.payload as Array<{ value: number | null }>}
                  label={props.label as string}
                  unit="h"
                  decimals={1}
                />
              )}
              cursor={{ stroke: "#818cf8", strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#818cf8"
              fill="url(#grad-study)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#818cf8", stroke: "#0a0a0f", strokeWidth: 2 }}
              animationDuration={500}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function TaskCompletionChart({ data, loading }: {
  data: Array<{ label: string; value: number | null }>;
  loading: boolean;
}) {
  return (
    <div className="bg-surface-2 border border-border rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Task Completion</h3>
        <p className="text-xs text-muted-foreground mt-0.5">% of scheduled tasks completed each day</p>
      </div>
      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-border border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={192}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -4, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#6b7280", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              ticks={[20, 40, 60, 80, 100]}
              tickFormatter={(v) => `${v}%`}
              width={38}
            />
            <Tooltip
              content={(props) => (
                <ChartTooltip
                  active={props.active}
                  payload={props.payload as Array<{ value: number | null }>}
                  label={props.label as string}
                  unit="%"
                />
              )}
              cursor={{ fill: "rgba(52,211,153,0.06)" }}
            />
            <Bar
              dataKey="value"
              fill="#34d399"
              fillOpacity={0.85}
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
              animationDuration={500}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

interface DayData {
  date: string;
  studyHours: number;
  taskPct: number | null;
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<7 | 14 | 30>(7);
  const [daily, setDaily] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/analytics?days=${period}`)
      .then((r) => r.json())
      .then((json) => {
        setDaily(json.data?.daily ?? []);
        setLoading(false);
      })
      .catch(() => { setLoading(false); setError(true); });
  }, [period]);

  const studyChartData = useMemo(
    () => daily.map((d) => ({ label: dayLabel(d.date, period), value: d.studyHours })),
    [daily, period]
  );

  const taskChartData = useMemo(
    () => daily.map((d) => ({ label: dayLabel(d.date, period), value: d.taskPct ?? 0 })),
    [daily, period]
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Your study and task trends.</p>
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

      {error && (
        <div className="text-center py-10 bg-surface-2 border border-border rounded-xl">
          <p className="text-sm text-muted-foreground">Failed to load analytics. Check your connection and refresh.</p>
        </div>
      )}

      {/* Charts */}
      {!error && (
        <div className="grid grid-cols-1 gap-4">
          <StudyHoursChart data={studyChartData} loading={loading} />
          <TaskCompletionChart data={taskChartData} loading={loading} />
        </div>
      )}
    </div>
  );
}
