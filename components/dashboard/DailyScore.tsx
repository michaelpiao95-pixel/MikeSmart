"use client";

import { Progress } from "@/components/ui/Progress";
import { cn } from "@/lib/utils";

interface DailyScoreProps {
  score: number;
  tasksCompleted: number;
  tasksTotal: number;
  weekTasksCompleted: number;
  weekTasksTotal: number;
  studyMinutes: number;
}

export function DailyScore({
  score,
  tasksCompleted,
  tasksTotal,
  weekTasksCompleted,
  weekTasksTotal,
  studyMinutes,
}: DailyScoreProps) {
  const getScoreLabel = () => {
    if (score >= 90) return { label: "Outstanding", color: "text-emerald-400" };
    if (score >= 70) return { label: "Strong", color: "text-brand-400" };
    if (score >= 50) return { label: "Decent", color: "text-amber-400" };
    if (score >= 25) return { label: "Needs work", color: "text-orange-400" };
    return { label: "Just starting", color: "text-muted-foreground" };
  };

  const { label, color } = getScoreLabel();

  return (
    <div className="bg-surface-2 border border-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Daily Score</h3>
          <p className={cn("text-xs mt-0.5", color)}>{label}</p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-foreground tabular-nums">
            {score}
          </span>
          <span className="text-lg text-muted-foreground">%</span>
        </div>
      </div>

      <Progress value={score} size="md" className="mb-5" />

      <div className="grid grid-cols-3 gap-3">
        <Stat
          label="Tasks"
          value={`${tasksCompleted}/${tasksTotal}`}
          subtext={tasksTotal > 0 ? `${Math.round((tasksCompleted / tasksTotal) * 100)}%` : "0%"}
        />
        <Stat
          label="This week"
          value={`${weekTasksCompleted}/${weekTasksTotal}`}
          subtext={
            weekTasksTotal > 0
              ? `${Math.round((weekTasksCompleted / weekTasksTotal) * 100)}%`
              : "—"
          }
        />
        <Stat
          label="Study time"
          value={
            studyMinutes >= 60
              ? `${Math.floor(studyMinutes / 60)}h ${studyMinutes % 60}m`
              : `${studyMinutes}m`
          }
          subtext="today"
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="bg-surface-3 rounded-lg p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold text-foreground tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{subtext}</p>
    </div>
  );
}
