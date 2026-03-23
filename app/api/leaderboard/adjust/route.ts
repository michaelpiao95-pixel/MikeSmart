import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { period, totalHours } = await request.json();
  if (!["daily", "weekly", "alltime"].includes(period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }
  if (typeof totalHours !== "number" || totalHours < 0) {
    return NextResponse.json({ error: "Invalid hours" }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Get current system minutes for this period
  let since: string | null = null;
  const now = new Date();
  if (period === "daily") {
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    since = d.toISOString();
  } else if (period === "weekly") {
    const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0);
    since = d.toISOString();
  }

  let query = admin.from("pomodoro_sessions").select("duration_minutes").eq("user_id", user.id);
  if (since) query = query.gte("started_at", since);
  const { data: sessions } = await query;

  const systemMinutes = (sessions ?? []).reduce((s, r) => s + r.duration_minutes, 0);
  const desiredMinutes = Math.round(totalHours * 60);
  const adjustmentMinutes = desiredMinutes - systemMinutes;

  // Fetch existing adjustments
  const { data: profile } = await admin
    .from("profiles")
    .select("leaderboard_adjustments")
    .eq("id", user.id)
    .single();

  const existing = (profile?.leaderboard_adjustments as Record<string, number>) ?? {};
  const updated = { ...existing, [period]: adjustmentMinutes };

  await admin
    .from("profiles")
    .update({ leaderboard_adjustments: updated })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
