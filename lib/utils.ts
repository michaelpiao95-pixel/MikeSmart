import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  format,
  isToday,
  isTomorrow,
  isThisWeek,
  isPast,
  formatDistanceToNow,
  startOfDay,
  endOfDay,
  addDays,
} from "date-fns";
import type { Assignment, GroupedAssignments, Priority } from "@/types";

// ─── Class name utility ───────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Date utilities ───────────────────────────────────────────────────────────

export function formatDueDate(dateStr?: string | null): string {
  if (!dateStr) return "No due date";
  const date = new Date(dateStr);

  if (isToday(date)) return `Today ${format(date, "h:mm a")}`;
  if (isTomorrow(date)) return `Tomorrow ${format(date, "h:mm a")}`;
  if (isThisWeek(date)) return format(date, "EEEE h:mm a");
  return format(date, "MMM d, h:mm a");
}

export function formatRelativeTime(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
}

export function isOverdue(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return isPast(new Date(dateStr));
}

export function isDueWithin24Hours(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const due = new Date(dateStr);
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  return diff > 0 && diff <= 24 * 60 * 60 * 1000;
}

export function isDueThisWeek(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const due = new Date(dateStr);
  return isThisWeek(due, { weekStartsOn: 1 });
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function getStartOfToday(): Date {
  return startOfDay(new Date());
}

export function getEndOfToday(): Date {
  return endOfDay(new Date());
}

export function getEndOfWeek(): Date {
  return endOfDay(addDays(new Date(), 7));
}

// ─── Assignment grouping ──────────────────────────────────────────────────────

export function groupAssignments(assignments: Assignment[]): GroupedAssignments {
  const now = new Date();
  const endOfToday = endOfDay(now);
  const endOfWeek = endOfDay(addDays(now, 7));

  const groups: GroupedAssignments = {
    overdue: [],
    today: [],
    this_week: [],
    later: [],
  };

  for (const a of assignments) {
    if (a.is_completed) continue; // show only incomplete

    if (!a.due_at) {
      groups.later.push(a);
      continue;
    }

    const due = new Date(a.due_at);

    if (due < now) {
      groups.overdue.push(a);
    } else if (due <= endOfToday) {
      groups.today.push(a);
    } else if (due <= endOfWeek) {
      groups.this_week.push(a);
    } else {
      groups.later.push(a);
    }
  }

  // Sort each group by due date ascending
  const sortByDue = (a: Assignment, b: Assignment) => {
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  };

  groups.overdue.sort(sortByDue);
  groups.today.sort(sortByDue);
  groups.this_week.sort(sortByDue);
  groups.later.sort(sortByDue);

  return groups;
}

// ─── Priority utilities ───────────────────────────────────────────────────────

export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; dotColor: string; badgeClass: string }
> = {
  low: {
    label: "Low",
    color: "text-slate-400",
    dotColor: "bg-slate-400",
    badgeClass: "bg-slate-800 text-slate-300",
  },
  medium: {
    label: "Medium",
    color: "text-blue-400",
    dotColor: "bg-blue-400",
    badgeClass: "bg-blue-900/50 text-blue-300",
  },
  high: {
    label: "High",
    color: "text-orange-400",
    dotColor: "bg-orange-400",
    badgeClass: "bg-orange-900/50 text-orange-300",
  },
  critical: {
    label: "Critical",
    color: "text-red-400",
    dotColor: "bg-red-400",
    badgeClass: "bg-red-900/50 text-red-300",
  },
};

// ─── Course color palette ─────────────────────────────────────────────────────

const COURSE_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
];

export function getCourseColor(index: number): string {
  return COURSE_COLORS[index % COURSE_COLORS.length];
}

// ─── Completion score ─────────────────────────────────────────────────────────

export function calculateCompletionScore(
  completedTasks: number,
  totalTasks: number,
  completedAssignments: number,
  totalAssignments: number
): number {
  if (totalTasks === 0 && totalAssignments === 0) return 0;

  const taskWeight = 0.6;
  const assignmentWeight = 0.4;

  const taskScore = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const assignmentScore =
    totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0;

  if (totalTasks === 0) return Math.round(assignmentScore);
  if (totalAssignments === 0) return Math.round(taskScore);

  return Math.round(taskScore * taskWeight + assignmentScore * assignmentWeight);
}

// ─── Grade calculator ─────────────────────────────────────────────────────────

export interface WeightedGradeResult {
  currentGrade: number;
  maxPossible: number;
  neededOnFinal: number | null;
}

export function calculateWeightedGrade(
  components: Array<{ weight: number; score?: number; max_score: number }>,
  targetGrade: number,
  finalWeight: number
): WeightedGradeResult {
  let earnedWeightedPoints = 0;
  let totalWeightCompleted = 0;

  for (const c of components) {
    if (c.score !== undefined) {
      const percentage = c.score / c.max_score;
      earnedWeightedPoints += percentage * c.weight;
      totalWeightCompleted += c.weight;
    }
  }

  const remainingWeight = 100 - totalWeightCompleted;
  const currentGrade =
    totalWeightCompleted > 0
      ? (earnedWeightedPoints / totalWeightCompleted) * 100
      : 0;

  // What do you need on the final?
  // targetGrade = earnedWeightedPoints + (finalScore * finalWeight / 100)
  // finalScore needed = (targetGrade - earnedWeightedPoints) / (finalWeight / 100)
  let neededOnFinal: number | null = null;
  if (finalWeight > 0) {
    const needed = (targetGrade - earnedWeightedPoints) / (finalWeight / 100);
    neededOnFinal = Math.round(needed * 10) / 10;
  }

  const maxPossible =
    totalWeightCompleted > 0
      ? ((earnedWeightedPoints + remainingWeight) / 100) * 100
      : 100;

  return { currentGrade: Math.round(currentGrade * 10) / 10, maxPossible, neededOnFinal };
}

// ─── Pomodoro ─────────────────────────────────────────────────────────────────

export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
