import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeCompleted = searchParams.get("include_completed") === "true";

  const baseQuery = supabase
    .from("assignments")
    .select(`
      *,
      course:courses(id, name, course_code, color)
    `)
    .eq("user_id", user.id)
    .order("due_at", { ascending: true, nullsFirst: false });

  // When not showing all completed: fetch incomplete + recently completed (last 7d) in two queries
  let data, dbError;

  if (!includeCompleted) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [incompleteResult, recentResult] = await Promise.all([
      baseQuery.eq("is_completed", false),
      supabase
        .from("assignments")
        .select(`*, course:courses(id, name, course_code, color)`)
        .eq("user_id", user.id)
        .eq("is_completed", true)
        .gte("completed_at", sevenDaysAgo)
        .order("due_at", { ascending: true, nullsFirst: false }),
    ]);

    dbError = incompleteResult.error ?? recentResult.error;
    if (!dbError) {
      const seen = new Set<string>();
      data = [...(incompleteResult.data ?? []), ...(recentResult.data ?? [])].filter((a) => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });
      data.sort((a, b) => {
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      });
    }
  } else {
    const result = await baseQuery;
    data = result.data;
    dbError = result.error;
  }

  if (dbError) {
    console.error("[assignments GET] DB error:", dbError);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const { data, error: dbError } = await supabase
    .from("assignments")
    .insert({
      user_id: user.id,
      course_id: body.course_id ?? null,
      title: body.title,
      description: body.description ?? null,
      due_at: body.due_at ?? null,
      priority: body.priority ?? "medium",
      is_completed: false,
      is_synced_from_canvas: false,
    })
    .select(`
      *,
      course:courses(id, name, course_code, color)
    `)
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
