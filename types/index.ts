// ─── Core Domain Types ──────────────────────────────────────────────────────

export type Priority = "low" | "medium" | "high" | "critical";
export type TaskCategory = "academic" | "personal";
export type TaskStatus = "pending" | "in_progress" | "completed";

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  canvas_base_url?: string;
  canvas_api_token?: string; // stored encrypted
  canvas_last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

// ─── Canvas Types ────────────────────────────────────────────────────────────

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_state: string;
  workflow_state: string;
  start_at?: string;
  end_at?: string;
}

export interface CanvasAssignment {
  id: number;
  course_id: number;
  name: string;
  description?: string;
  due_at?: string;
  points_possible?: number;
  submission_types: string[];
  html_url: string;
  has_submitted_submissions: boolean;
  workflow_state: string;
  submission?: {
    workflow_state: "submitted" | "unsubmitted" | "graded" | "pending_review";
    score?: number;
  };
}

// ─── Database Types ──────────────────────────────────────────────────────────

export interface Course {
  id: string;
  user_id: string;
  canvas_course_id: number;
  name: string;
  course_code: string;
  color: string;
  // Grade tracking
  current_grade?: number;
  target_grade?: number;
  // Weighted grade components stored as JSON
  grade_components?: GradeComponent[];
  notes?: string;
  links?: CourseLink[];
  created_at: string;
  updated_at: string;
}

export interface GradeComponent {
  id: string;
  name: string;
  weight: number; // percentage (e.g. 30 = 30%)
  score?: number;  // achieved score
  max_score: number;
}

export interface CourseLink {
  id: string;
  label: string;
  url: string;
}

export interface Assignment {
  id: string;
  user_id: string;
  course_id: string;
  canvas_assignment_id?: number;
  canvas_course_id?: number;
  title: string;
  description?: string;
  due_at?: string;
  points_possible?: number;
  priority: Priority;
  is_completed: boolean;
  completed_at?: string;
  canvas_html_url?: string;
  is_synced_from_canvas: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  course?: Course;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: Priority;
  due_date?: string;
  scheduled_date?: string;
  scheduled_start?: string; // HH:MM
  scheduled_end?: string;   // HH:MM
  is_habit: boolean;
  habit_days?: number[]; // 0=Sun, 1=Mon, ...
  completed_at?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PomodoroSession {
  id: string;
  user_id: string;
  task_id?: string;
  assignment_id?: string;
  duration_minutes: number;
  completed: boolean;
  started_at: string;
  ended_at?: string;
  notes?: string;
}

export interface DailyReflection {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  wins: string;
  mistakes: string;
  improvements: string;
  completion_score: number; // 0-100
  mood: number; // 1-5
  created_at: string;
  updated_at: string;
}

export interface Streak {
  id: string;
  user_id: string;
  streak_type: "task_completion" | "study_session" | "daily_reflection";
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
  updated_at: string;
}

export interface CanvasSyncLog {
  id: string;
  user_id: string;
  synced_at: string;
  courses_synced: number;
  assignments_synced: number;
  assignments_updated: number;
  status: "success" | "partial" | "failed";
  error_message?: string;
}

// ─── UI / Component Types ────────────────────────────────────────────────────

export interface TimeBlock {
  id: string;
  taskId?: string;
  assignmentId?: string;
  label: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  color?: string;
  isHabit?: boolean;
}

export interface CommandPaletteItem {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action: () => void;
  group?: string;
}

export interface DailyStats {
  date: string;
  tasksCompleted: number;
  tasksTotal: number;
  assignmentsCompleted: number;
  assignmentsTotal: number;
  studyMinutes: number;
  pomodoroSessions: number;
  completionScore: number;
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface SyncResult {
  coursesAdded: number;
  coursesUpdated: number;
  assignmentsAdded: number;
  assignmentsUpdated: number;
  syncedAt: string;
}

// ─── Grouped Assignment Types ────────────────────────────────────────────────

export type AssignmentGroup = "overdue" | "today" | "this_week" | "later";

export interface GroupedAssignments {
  overdue: Assignment[];
  today: Assignment[];
  this_week: Assignment[];
  later: Assignment[];
}
