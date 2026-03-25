import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "weekly"; // daily | weekly | alltime
  const tzOffset = parseInt(searchParams.get("tzOffset") ?? "0", 10);

  // Returns UTC timestamp of local midnight in the user's timezone
  const localMidnight = (daysAgo = 0): string => {
    const now = new Date();
    const localNow = new Date(now.getTime() - tzOffset * 60000);
    localNow.setUTCHours(0, 0, 0, 0);
    if (daysAgo > 0) localNow.setUTCDate(localNow.getUTCDate() - daysAgo);
    return new Date(localNow.getTime() + tzOffset * 60000).toISOString();
  };

  // Returns UTC timestamp of the most recent Monday midnight in the user's timezone
  const localWeekStart = (): string => {
    const now = new Date();
    const localNow = new Date(now.getTime() - tzOffset * 60000);
    localNow.setUTCHours(0, 0, 0, 0);
    const dow = localNow.getUTCDay(); // 0=Sun … 6=Sat
    const daysFromMonday = dow === 0 ? 6 : dow - 1;
    localNow.setUTCDate(localNow.getUTCDate() - daysFromMonday);
    return new Date(localNow.getTime() + tzOffset * 60000).toISOString();
  };

  // Get friend IDs
  const { data: friendships } = await admin
    .from("friendships")
    .select("user_id_1, user_id_2")
    .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

  const friendIds = (friendships ?? []).map((f) =>
    f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1
  );

  const allIds = [user.id, ...friendIds];

  const dailyStartMs  = new Date(localMidnight(0)).getTime();
  const weeklyStartMs = new Date(localWeekStart()).getTime();

  const weeklyStartISO = new Date(weeklyStartMs).toISOString();

  // Paginate through ALL sessions to get alltime totals (Supabase caps at 1000/page)
  const alltimeSessions: Array<{ user_id: string; duration_minutes: number }> = [];
  for (let page = 0; ; page++) {
    const { data } = await admin
      .from("pomodoro_sessions")
      .select("user_id, duration_minutes")
      .in("user_id", allIds)
      .range(page * 1000, page * 1000 + 999);
    if (!data || data.length === 0) break;
    alltimeSessions.push(...data);
    if (data.length < 1000) break;
  }

  // Paginate through this week's sessions for daily/weekly buckets
  const recentSessions: Array<{ user_id: string; duration_minutes: number; started_at: string }> = [];
  for (let page = 0; ; page++) {
    const { data } = await admin
      .from("pomodoro_sessions")
      .select("user_id, duration_minutes, started_at")
      .in("user_id", allIds)
      .gte("started_at", weeklyStartISO)
      .range(page * 1000, page * 1000 + 999);
    if (!data || data.length === 0) break;
    recentSessions.push(...data);
    if (data.length < 1000) break;
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name, avatar_url, leaderboard_adjustments, is_admin, banned_until")
    .in("id", allIds);

  // Bucket sessions into periods
  const rawMinutes = new Map<string, { daily: number; weekly: number; alltime: number }>();
  for (const id of allIds) rawMinutes.set(id, { daily: 0, weekly: 0, alltime: 0 });

  // Alltime: sum all pages of sessions
  for (const s of alltimeSessions) {
    const bucket = rawMinutes.get(s.user_id);
    if (!bucket) continue;
    bucket.alltime += s.duration_minutes;
  }

  // Daily + weekly: only sessions from this week (pre-filtered, won't hit 1000 limit)
  for (const s of recentSessions ?? []) {
    const bucket = rawMinutes.get(s.user_id);
    if (!bucket) continue;
    const t = new Date(s.started_at).getTime();
    if (t >= weeklyStartMs) bucket.weekly += s.duration_minutes;
    if (t >= dailyStartMs)  bucket.daily  += s.duration_minutes;
  }

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  const isAdmin = profileMap[user.id]?.is_admin === true;
  const nowTs = new Date();

  // Apply adjustments then enforce daily ≤ weekly ≤ alltime
  const minutesByUser = new Map<string, number>();
  for (const id of allIds) {
    const adj = (profileMap[id]?.leaderboard_adjustments as Record<string, number>) ?? {};
    const raw = rawMinutes.get(id)!;

    const dailyFinal   = Math.max(0, raw.daily   + (adj.daily   ?? 0));
    const weeklyRaw    = Math.max(0, raw.weekly   + (adj.weekly  ?? 0));
    const alltimeRaw   = Math.max(0, raw.alltime  + (adj.alltime ?? 0));
    const weeklyFinal  = Math.max(weeklyRaw,  dailyFinal);
    const alltimeFinal = Math.max(alltimeRaw, weeklyFinal);

    minutesByUser.set(
      id,
      period === "daily" ? dailyFinal : period === "weekly" ? weeklyFinal : alltimeFinal
    );
  }

  // Build ranked list — admins see banned users with a flag; others don't see them
  const ranked = [...minutesByUser.entries()]
    .map(([id, minutes]) => {
      const profile = profileMap[id];
      const bannedUntil = profile?.banned_until ? new Date(profile.banned_until) : null;
      const isBanned = bannedUntil ? bannedUntil > nowTs : false;
      const isPermanentBan = isBanned && bannedUntil!.getFullYear() >= 2099;
      return {
        userId: id,
        isMe: id === user.id,
        email: profile?.email ?? "",
        fullName: profile?.full_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        hours: +(minutes / 60).toFixed(1),
        isBanned,
        isPermanentBan,
        bannedUntil: bannedUntil?.toISOString() ?? null,
      };
    })
    .filter((e) => isAdmin || !e.isBanned || e.isMe)
    .sort((a, b) => b.hours - a.hours)
    .map((entry, i) => ({ ...entry, rank: i + 1, isAdmin }));

  return NextResponse.json({ data: ranked });
}
