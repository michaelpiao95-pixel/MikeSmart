import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? todayISO();

  const { data } = await supabase
    .from("daily_reflections")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const date = body.date ?? todayISO();

  const { data, error: dbError } = await supabase
    .from("daily_reflections")
    .upsert(
      {
        user_id: user.id,
        date,
        wins: body.wins ?? "",
        mistakes: body.mistakes ?? "",
        improvements: body.improvements ?? "",
        completion_score: body.completion_score ?? 0,
        mood: body.mood ?? 3,
      },
      { onConflict: "user_id,date" }
    )
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Update reflection streak
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const { data: streak } = await supabase
    .from("streaks")
    .select("*")
    .eq("user_id", user.id)
    .eq("streak_type", "daily_reflection")
    .maybeSingle();

  if (!streak) {
    // First ever reflection — create the streak row
    await supabase.from("streaks").insert({
      user_id: user.id,
      streak_type: "daily_reflection",
      current_streak: 1,
      longest_streak: 1,
      last_activity_date: date,
    });
  } else if (streak.last_activity_date !== date) {
    // New day — extend or reset streak
    const isConsecutive = streak.last_activity_date === yesterdayStr;
    const newStreak = isConsecutive ? streak.current_streak + 1 : 1;
    await supabase
      .from("streaks")
      .update({
        current_streak: newStreak,
        longest_streak: Math.max(newStreak, streak.longest_streak),
        last_activity_date: date,
      })
      .eq("id", streak.id);
  }

  return NextResponse.json({ data });
}
