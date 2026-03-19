"use client";

import { useState } from "react";
import { ExternalLink, Calendar } from "lucide-react";
import { cn, formatDueDate, isOverdue, isDueWithin24Hours, PRIORITY_CONFIG } from "@/lib/utils";
import type { Assignment } from "@/types";

interface AssignmentCardProps {
  assignment: Assignment;
  onToggle: (id: string, completed: boolean) => Promise<void>;
}

export function AssignmentCard({ assignment, onToggle }: AssignmentCardProps) {
  const [optimisticCompleted, setOptimisticCompleted] = useState(assignment.is_completed);
  const [toggling, setToggling] = useState(false);
  const [popping, setPopping] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const overdue = isOverdue(assignment.due_at) && !optimisticCompleted;
  const urgent = isDueWithin24Hours(assignment.due_at) && !optimisticCompleted;
  const priority = PRIORITY_CONFIG[assignment.priority] ?? PRIORITY_CONFIG.medium;

  const handleToggle = async () => {
    if (toggling) return;
    const next = !optimisticCompleted;
    setOptimisticCompleted(next);
    setPopping(true);
    if (next) setShowConfetti(true);
    setToggling(true);
    setTimeout(() => setPopping(false), 300);
    setTimeout(() => setShowConfetti(false), 700);
    try {
      await onToggle(assignment.id, next);
    } catch {
      setOptimisticCompleted(!next);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div
      className={cn(
        "group flex items-start gap-3 p-3 rounded-lg border transition-all duration-200",
        optimisticCompleted
          ? "bg-surface-1 border-border/50 opacity-60"
          : overdue
          ? "bg-red-950/20 border-red-900/40 hover:border-red-800/60"
          : urgent
          ? "bg-amber-950/10 border-amber-900/30 hover:border-amber-800/50"
          : "bg-surface-2 border-border hover:border-brand-600/40 hover:bg-surface-3/50"
      )}
    >
      {/* Checkbox with pop + confetti */}
      <div className="relative mt-0.5 shrink-0">
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={cn(
            "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
            popping && "animate-pop",
            optimisticCompleted
              ? "bg-brand-600 border-brand-600"
              : "border-border hover:border-brand-500"
          )}
          aria-label={optimisticCompleted ? "Mark incomplete" : "Mark complete"}
        >
          {optimisticCompleted && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Confetti particles */}
        {showConfetti && (
          <>
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand-400 pointer-events-none" style={{ animation: "confetti-3 0.6s ease-out forwards" }} />
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-violet-400 pointer-events-none" style={{ animation: "confetti-1 0.6s ease-out forwards" }} />
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-pink-400 pointer-events-none" style={{ animation: "confetti-2 0.6s ease-out forwards" }} />
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span className={cn(
            "text-sm font-medium leading-5 break-words transition-all duration-300",
            optimisticCompleted ? "line-through text-muted-foreground" : "text-foreground"
          )}>
            {assignment.title}
          </span>
          {assignment.canvas_html_url && (
            <a
              href={assignment.canvas_html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {assignment.course && (
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${assignment.course.color}20`, color: assignment.course.color }}
            >
              {assignment.course.course_code}
            </span>
          )}
          {assignment.due_at && (
            <span className={cn(
              "flex items-center gap-1 text-xs",
              overdue ? "text-red-400 font-medium" : urgent ? "text-amber-400 font-medium" : "text-muted-foreground"
            )}>
              <Calendar className="w-3 h-3" />
              {formatDueDate(assignment.due_at)}
              {overdue && " — Overdue"}
            </span>
          )}
          {!optimisticCompleted && (
            <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", priority.badgeClass)}>
              {priority.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
