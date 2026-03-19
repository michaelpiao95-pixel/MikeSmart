import type { CanvasAssignment, CanvasCourse } from "@/types";

// ─── Canvas API Client ────────────────────────────────────────────────────────
// All requests are proxied through our Next.js API routes to keep
// the Canvas token server-side. This client is used only in API routes.

export class CanvasClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    // Normalize — strip trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new CanvasApiError(
        `Canvas API error ${response.status}: ${response.statusText}`,
        response.status,
        body
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Paginated fetch — Canvas uses Link headers for pagination.
   * Returns all results across all pages.
   */
  private async fetchPaginated<T>(endpoint: string): Promise<T[]> {
    const results: T[] = [];
    let url: string | null = `${this.baseUrl}/api/v1${endpoint}`;

    while (url) {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new CanvasApiError(
          `Canvas API error ${response.status}: ${response.statusText}`,
          response.status,
          body
        );
      }

      const page = (await response.json()) as T[];
      results.push(...page);

      // Parse Link header for next page
      const linkHeader = response.headers.get("Link");
      url = parseLinkNext(linkHeader);
    }

    return results;
  }

  /** Validate that the token works by fetching the current user */
  async validateToken(): Promise<{ id: number; name: string; email: string }> {
    return this.fetch("/users/self/profile");
  }

  /** Fetch active enrollments (courses) for the current user */
  async getCourses(): Promise<CanvasCourse[]> {
    const courses = await this.fetchPaginated<CanvasCourse>(
      "/courses?enrollment_state=active&per_page=50&include[]=term"
    );
    return courses.filter(
      (c) => c.workflow_state === "available" && c.name
    );
  }

  /** Fetch all assignments for a given course */
  async getAssignmentsForCourse(courseId: number): Promise<CanvasAssignment[]> {
    return this.fetchPaginated<CanvasAssignment>(
      `/courses/${courseId}/assignments?per_page=50&include[]=description&include[]=submission&order_by=due_at`
    );
  }

  /** Fetch submitted/graded submissions for a course (current user only) */
  async getSubmittedForCourse(courseId: number): Promise<Array<{ assignment_id: number; workflow_state: string }>> {
    return this.fetchPaginated(
      `/courses/${courseId}/submissions?student_ids[]=self&workflow_state[]=submitted&workflow_state[]=graded&per_page=100`
    );
  }

  /** Fetch all assignments across all active courses */
  async getAllAssignments(courses: CanvasCourse[]): Promise<CanvasAssignment[]> {
    const all = await Promise.all(
      courses.map((course) => this.getAssignmentsForCourse(course.id))
    );
    return all.flat();
  }
}

// ─── Canvas API Error ─────────────────────────────────────────────────────────

export class CanvasApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string
  ) {
    super(message);
    this.name = "CanvasApiError";
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseLinkNext(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  // Link header format: <url>; rel="next", <url>; rel="last"
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

/** Derive priority from due date */
export function derivePriority(dueAt?: string): "low" | "medium" | "high" | "critical" {
  if (!dueAt) return "low";
  const now = new Date();
  const due = new Date(dueAt);
  const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilDue < 0) return "critical";  // overdue
  if (hoursUntilDue <= 24) return "critical";
  if (hoursUntilDue <= 72) return "high";
  if (hoursUntilDue <= 168) return "medium"; // 1 week
  return "low";
}
