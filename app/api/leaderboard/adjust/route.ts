import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Check if current user is admin
  const { data: myProfile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (myProfile?.is_admin !== true) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { period, deltaHours, userId } = await request.json();
  if (!["daily", "weekly", "alltime"].includes(period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }
  if (typeof deltaHours !== "number" || isNaN(deltaHours)) {
    return NextResponse.json({ error: "Invalid hours" }, { status: 400 });
  }

  const targetId = userId ?? user.id;
  const deltaMinutes = Math.round(deltaHours * 60);

  const { data: profile } = await admin
    .from("profiles")
    .select("leaderboard_adjustments")
    .eq("id", targetId)
    .single();

  const existing = (profile?.leaderboard_adjustments as Record<string, number>) ?? {};
  const updated = { ...existing, [period]: (existing[period] ?? 0) + deltaMinutes };

  await admin.from("profiles").update({ leaderboard_adjustments: updated }).eq("id", targetId);

  return NextResponse.json({ ok: true });
}
