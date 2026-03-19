import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Build update payload — only allow specific fields to be updated
  const updates: Record<string, unknown> = {};

  if ("is_completed" in body) {
    updates.is_completed = body.is_completed;
    updates.completed_at = body.is_completed ? new Date().toISOString() : null;
  }
  if ("priority" in body) updates.priority = body.priority;
  if ("due_at" in body) updates.due_at = body.due_at;
  if ("title" in body) updates.title = body.title;

  const { data, error: dbError } = await supabase
    .from("assignments")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", user.id) // RLS + ownership double-check
    .select(`
      *,
      course:courses(id, name, course_code, color)
    `)
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error: dbError } = await supabase
    .from("assignments")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Deleted" });
}
