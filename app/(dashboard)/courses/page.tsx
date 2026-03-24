"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { cn, calculateWeightedGrade } from "@/lib/utils";
import type { Course, GradeComponent } from "@/types";
import { ChevronDown, ChevronRight, Plus, Trash2, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const RANK_COLORS = ["#f59e0b", "#94a3b8", "#b45309"];
const RANK_LABELS = ["1st", "2nd", "3rd"];

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = useRef(createClient()).current;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase
      .from("courses")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    const loaded = (data ?? []).map((c) => ({
      ...c,
      grade_components: c.grade_components ?? [],
      links: c.links ?? [],
    }));
    setCourses(loaded);

    // Load saved order from localStorage
    const savedRaw = localStorage.getItem(`course_order_${user.id}`);
    let savedOrder: string[] = [];
    try { savedOrder = savedRaw ? JSON.parse(savedRaw) : []; } catch { savedOrder = []; }
    // Merge: saved order first, then any new courses not yet ranked
    const savedIds = savedOrder.filter((id) => loaded.some((c) => c.id === id));
    const newIds = loaded.filter((c) => !savedIds.includes(c.id)).map((c) => c.id);
    setOrderedIds([...savedIds, ...newIds]);

    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const orderedCourses = orderedIds
    .map((id) => courses.find((c) => c.id === id))
    .filter(Boolean) as Course[];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(active.id as string);
    const newIndex = orderedIds.indexOf(over.id as string);
    const newOrder = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(newOrder);
    if (userId) localStorage.setItem(`course_order_${userId}`, JSON.stringify(newOrder));
  };

  const handleSave = async (course: Course) => {
    setSaving(course.id);
    await supabase.from("courses").update({
      notes: course.notes,
      target_grade: course.target_grade,
      grade_components: course.grade_components,
      links: course.links,
    }).eq("id", course.id);
    setSaving(null);
  };

  const updateCourse = (id: string, updates: Partial<Course>) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Courses</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drag to rank by importance — top 3 appear on Today.
        </p>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">
            No courses yet. Sync Canvas to import your courses.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {orderedCourses.map((course, index) => (
                <SortableCourseCard
                  key={course.id}
                  course={course}
                  rank={index}
                  expanded={expanded === course.id}
                  saving={saving === course.id}
                  onToggle={() =>
                    setExpanded(expanded === course.id ? null : course.id)
                  }
                  onUpdate={(updates) => updateCourse(course.id, updates)}
                  onSave={() => handleSave(course)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableCourseCard(props: {
  course: Course;
  rank: number;
  expanded: boolean;
  saving: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<Course>) => void;
  onSave: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.course.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CourseCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function CourseCard({
  course,
  rank,
  expanded,
  saving,
  onToggle,
  onUpdate,
  onSave,
  dragHandleProps,
}: {
  course: Course;
  rank: number;
  expanded: boolean;
  saving: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<Course>) => void;
  onSave: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const components = course.grade_components ?? [];
  const finalComponent = components.find((c) => c.name.toLowerCase().includes("final"));
  const finalWeight = finalComponent?.weight ?? 0;
  const targetGrade = course.target_grade ?? 90;

  const { currentGrade, neededOnFinal } = calculateWeightedGrade(
    components,
    targetGrade,
    finalWeight
  );

  const hasGrades = components.some((c) => c.score !== undefined);

  const addComponent = () => {
    const newComp: GradeComponent = {
      id: crypto.randomUUID(),
      name: "New Component",
      weight: 10,
      max_score: 100,
    };
    onUpdate({ grade_components: [...components, newComp] });
  };

  const updateComponent = (id: string, updates: Partial<GradeComponent>) => {
    onUpdate({
      grade_components: components.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    });
  };

  const removeComponent = (id: string) => {
    onUpdate({ grade_components: components.filter((c) => c.id !== id) });
  };

  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const rankColor = RANK_COLORS[rank] ?? "#6b7280";
  const rankLabel = RANK_LABELS[rank] ?? `${rank + 1}th`;

  return (
    <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center">
        {/* Drag handle */}
        <button
          {...dragHandleProps}
          className="pl-3 pr-1 py-4 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          tabIndex={-1}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Rank badge */}
        <div
          className="w-8 h-6 rounded text-[10px] font-bold flex items-center justify-center shrink-0 mr-1"
          style={{ color: rankColor, backgroundColor: `${rankColor}18` }}
        >
          {rankLabel}
        </div>

        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-3 pr-4 py-4 hover:bg-surface-3 transition-colors min-w-0"
        >
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: course.color }}
          />
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {course.name}
            </p>
            <p className="text-xs text-muted-foreground">{course.course_code}</p>
          </div>
          {hasGrades && (
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-foreground tabular-nums">
                {currentGrade}%
              </p>
              <p className="text-xs text-muted-foreground">current</p>
            </div>
          )}
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-5">
          {/* Target grade */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground w-32 shrink-0">
              Target grade
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={course.target_grade ?? 90}
                onChange={(e) =>
                  onUpdate({ target_grade: parseFloat(e.target.value) })
                }
                className="w-16 bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            {hasGrades && neededOnFinal !== null && (
              <div className="ml-auto text-right">
                <p className="text-xs text-muted-foreground">Need on final</p>
                <p
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    neededOnFinal > 100
                      ? "text-red-400"
                      : neededOnFinal > 90
                      ? "text-amber-400"
                      : "text-emerald-400"
                  )}
                >
                  {neededOnFinal > 100 ? "Impossible" : `${neededOnFinal}%`}
                </p>
              </div>
            )}
          </div>

          {/* Grade components */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-foreground">
                Grade Components
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-xs",
                    Math.abs(totalWeight - 100) < 0.01
                      ? "text-emerald-400"
                      : "text-amber-400"
                  )}
                >
                  {totalWeight}% / 100%
                </span>
                <Button variant="ghost" size="sm" onClick={addComponent}>
                  <Plus className="w-3 h-3" />
                  Add
                </Button>
              </div>
            </div>

            {components.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 italic">
                No components. Add one to track your grade.
              </p>
            ) : (
              <div className="space-y-2">
                {components.map((comp) => (
                  <div
                    key={comp.id}
                    className="flex items-center gap-2 bg-surface-3 rounded-lg p-2"
                  >
                    <input
                      value={comp.name}
                      onChange={(e) =>
                        updateComponent(comp.id, { name: e.target.value })
                      }
                      className="flex-1 bg-transparent text-sm text-foreground focus:outline-none min-w-0"
                      placeholder="Component name"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={comp.score ?? ""}
                        onChange={(e) =>
                          updateComponent(comp.id, {
                            score: e.target.value ? parseFloat(e.target.value) : undefined,
                          })
                        }
                        placeholder="Score"
                        className="w-14 bg-surface-4 border border-border rounded px-1.5 py-1 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <span className="text-xs text-muted-foreground">/</span>
                      <input
                        type="number"
                        min={1}
                        value={comp.max_score}
                        onChange={(e) =>
                          updateComponent(comp.id, {
                            max_score: parseFloat(e.target.value),
                          })
                        }
                        className="w-14 bg-surface-4 border border-border rounded px-1.5 py-1 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <span className="text-xs text-muted-foreground">•</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={comp.weight}
                        onChange={(e) =>
                          updateComponent(comp.id, {
                            weight: parseFloat(e.target.value),
                          })
                        }
                        className="w-12 bg-surface-4 border border-border rounded px-1.5 py-1 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                    <button
                      onClick={() => removeComponent(comp.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Notes</h3>
            <textarea
              value={course.notes ?? ""}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              rows={3}
              placeholder="Add notes, office hours, tips..."
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <Button onClick={onSave} disabled={saving} size="sm">
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
