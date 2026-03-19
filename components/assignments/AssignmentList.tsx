"use client";

import { useMemo } from "react";
import { AssignmentCard } from "./AssignmentCard";
import { Progress } from "@/components/ui/Progress";
import { groupAssignments } from "@/lib/utils";
import type { Assignment } from "@/types";
import { AlertTriangle, Clock, CalendarDays, Archive } from "lucide-react";

interface AssignmentListProps {
  assignments: Assignment[];
  onToggle: (id: string, completed: boolean) => Promise<void>;
  showCompleted?: boolean;
}

const GROUP_CONFIG = {
  overdue: {
    label: "Overdue",
    icon: AlertTriangle,
    iconClass: "text-red-400",
    headerClass: "text-red-400",
    emptyText: null,
  },
  today: {
    label: "Today",
    icon: Clock,
    iconClass: "text-amber-400",
    headerClass: "text-amber-400",
    emptyText: "Nothing due today",
  },
  this_week: {
    label: "This Week",
    icon: CalendarDays,
    iconClass: "text-brand-400",
    headerClass: "text-brand-400",
    emptyText: "Clear for the week",
  },
  later: {
    label: "Later",
    icon: Archive,
    iconClass: "text-muted-foreground",
    headerClass: "text-muted-foreground",
    emptyText: null,
  },
} as const;

export function AssignmentList({
  assignments,
  onToggle,
  showCompleted = false,
}: AssignmentListProps) {
  const groups = useMemo(() => groupAssignments(assignments), [assignments]);

  const totalIncomplete = assignments.filter((a) => !a.is_completed).length;
  const totalCompleted = assignments.filter((a) => a.is_completed).length;
  const total = assignments.length;
  const completionPct = total > 0 ? (totalCompleted / total) * 100 : 0;

  const completedAssignments = useMemo(
    () => assignments.filter((a) => a.is_completed),
    [assignments]
  );

  return (
    <div className="space-y-6">
      {/* Progress summary */}
      <div className="bg-surface-2 border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {totalCompleted} of {total} assignments complete
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalIncomplete} remaining
            </p>
          </div>
          <span className="text-2xl font-bold text-foreground tabular-nums">
            {Math.round(completionPct)}%
          </span>
        </div>
        <Progress value={completionPct} size="md" />
      </div>

      {/* Groups */}
      {(["overdue", "today", "this_week", "later"] as const).map((key) => {
        const items = groups[key];
        const cfg = GROUP_CONFIG[key];
        const Icon = cfg.icon;

        if (items.length === 0 && cfg.emptyText === null) return null;

        return (
          <section key={key}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-4 h-4 ${cfg.iconClass}`} />
              <h3 className={`text-sm font-semibold ${cfg.headerClass}`}>
                {cfg.label}
              </h3>
              {items.length > 0 && (
                <span className="text-xs bg-surface-3 text-muted-foreground px-1.5 py-0.5 rounded-full">
                  {items.length}
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 italic pl-6">
                {cfg.emptyText}
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((a) => (
                  <AssignmentCard key={a.id} assignment={a} onToggle={onToggle} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Completed */}
      {showCompleted && completedAssignments.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 rounded border-2 border-brand-600 flex items-center justify-center">
              <svg
                className="w-2.5 h-2.5 text-brand-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-muted-foreground">
              Completed
            </h3>
            <span className="text-xs bg-surface-3 text-muted-foreground px-1.5 py-0.5 rounded-full">
              {completedAssignments.length}
            </span>
          </div>
          <div className="space-y-2">
            {completedAssignments.map((a) => (
              <AssignmentCard key={a.id} assignment={a} onToggle={onToggle} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
