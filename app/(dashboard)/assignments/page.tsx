"use client";

import { useCallback, useEffect, useState } from "react";
import { SyncButton } from "@/components/canvas/SyncButton";
import { AssignmentList } from "@/components/assignments/AssignmentList";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { cn, todayISO } from "@/lib/utils";
import { Plus, X, AlertCircle } from "lucide-react";
import type { Assignment } from "@/types";

interface NewAssignmentForm {
  title: string;
  due_at: string;
  priority: "low" | "medium" | "high" | "critical";
  description: string;
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [profile, setProfile] = useState<{ canvas_last_synced_at?: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<NewAssignmentForm>({
    title: "",
    due_at: "",
    priority: "medium",
    description: "",
  });

  const supabase = createClient();

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [assignmentsRes, profileRes] = await Promise.all([
      fetch(`/api/assignments?include_completed=${showCompleted}`),
      supabase
        .from("profiles")
        .select("canvas_last_synced_at")
        .eq("id", user.id)
        .single(),
    ]);

    if (!assignmentsRes.ok) {
      const json = await assignmentsRes.json().catch(() => ({}));
      setError(json.error ?? `Server error ${assignmentsRes.status}`);
      setLoading(false);
      return;
    }

    const json = await assignmentsRes.json();
    setAssignments(json.data ?? []);
    setProfile(profileRes.data);
    setError(null);
    setLoading(false);
  }, [supabase, showCompleted]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Check Canvas for completion updates:
  //  • immediately on mount
  //  • every 60 s while the page is open
  //  • instantly when the user tabs back to the window (covers the "just finished on Canvas" case)
  useEffect(() => {
    let active = true;
    let running = false;

    const checkCompletions = async () => {
      if (running || !active) return;
      running = true;
      try {
        const res = await fetch("/api/canvas/sync-completions", { method: "POST" });
        if (!res.ok || !active) return;
        const json = await res.json();
        const ids: string[] = json.completed ?? [];
        if (ids.length > 0) {
          // Update checkboxes in-place so the page feels instant
          setAssignments((prev) =>
            prev.map((a) => (ids.includes(a.id) ? { ...a, is_completed: true } : a))
          );
        }
      } catch {
        // Network errors are silent — never block the UI
      } finally {
        running = false;
      }
    };

    const onFocus = () => checkCompletions();

    checkCompletions();
    const interval = setInterval(checkCompletions, 60_000);
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (id: string, completed: boolean) => {
    const res = await fetch(`/api/assignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_completed: completed }),
    });

    if (!res.ok) throw new Error("Failed to update");

    setAssignments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_completed: completed } : a))
    );
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setAdding(true);

    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        due_at: form.due_at || null,
        priority: form.priority,
        description: form.description || null,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.data) setAssignments((prev) => [json.data, ...prev]);
      setForm({ title: "", due_at: "", priority: "medium", description: "" });
      setShowAddModal(false);
    }
    setAdding(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assignments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Canvas checklist — your deadlines, all in one place.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <div
              onClick={() => setShowCompleted((v) => !v)}
              className={cn(
                "w-8 h-5 rounded-full transition-all cursor-pointer relative",
                showCompleted ? "bg-brand-600" : "bg-surface-4"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all",
                  showCompleted ? "left-4" : "left-0.5"
                )}
              />
            </div>
            Show completed
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
          <SyncButton
            lastSyncedAt={profile?.canvas_last_synced_at}
            onSyncComplete={load}
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Failed to load assignments</p>
            <p className="text-red-400/70 mt-0.5">{error}</p>
            {error.includes("does not exist") && (
              <p className="mt-2 text-red-300/80">
                Your database tables may not be set up yet. Run the schema from{" "}
                <code className="font-mono bg-red-950/50 px-1 rounded">supabase/schema.sql</code>{" "}
                in your Supabase SQL Editor.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="w-6 h-6" />
        </div>
      ) : !error && assignments.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-muted-foreground font-medium">No assignments yet</p>
          <p className="text-sm text-muted-foreground/60">
            Connect Canvas in Settings and hit Sync, or add one manually.
          </p>
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="w-3.5 h-3.5" />
            Add assignment
          </Button>
        </div>
      ) : !error ? (
        <AssignmentList
          assignments={assignments}
          onToggle={handleToggle}
          showCompleted={showCompleted}
        />
      ) : null}

      {/* Add Assignment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-2 border border-border rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Add Assignment</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Assignment title"
                  autoFocus
                  required
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Due date</label>
                <input
                  type="datetime-local"
                  value={form.due_at}
                  onChange={(e) => setForm((f) => ({ ...f, due_at: e.target.value }))}
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as NewAssignmentForm["priority"] }))}
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Optional description..."
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={adding || !form.title.trim()} className="flex-1">
                  {adding ? "Adding..." : "Add Assignment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
