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

  // Build time filter: daily = today, weekly = Mon–now, alltime = no filter
  let since: string | null = null;
  if (period === "daily") {
    since = localMidnight(0);
  } else if (period === "weekly") {
    since = localWeekStart();
  }

  // Query pomodoro sessions for the period
  let query = admin
    .from("pomodoro_sessions")
    .select("user_id, duration_minutes")
    .in("user_id", allIds);
  if (since) query = query.gte("started_at", since);
  const { data: sessions } = await query;

  // Sum minutes per user for the period
  const minutesByUser = new Map<string, number>();
  for (const s of sessions ?? []) {
    minutesByUser.set(s.user_id, (minutesByUser.get(s.user_id) ?? 0) + s.duration_minutes);
  }
  for (const id of allIds) {
    if (!minutesByUser.has(id)) minutesByUser.set(id, 0);
  }

  // Fetch profiles
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name, avatar_url, leaderboard_adjustments, is_admin, banned_until")
    .in("id", allIds);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  const isAdmin = profileMap[user.id]?.is_admin === true;
  const nowTs = new Date();

  // Apply each user's adjustment, enforcing the hierarchy:
  // weekly adj >= daily adj, alltime adj >= weekly adj >= daily adj
  // This ensures today's hours always count toward this week, and this week toward all-time.
  for (const id of allIds) {
    const adj = (profileMap[id]?.leaderboard_adjustments as Record<string, number>) ?? {};
    let periodAdj = adj[period] ?? 0;
    if (period === "weekly") {
      periodAdj = Math.max(periodAdj, adj.daily ?? 0);
    } else if (period === "alltime") {
      periodAdj = Math.max(periodAdj, adj.weekly ?? 0, adj.daily ?? 0);
    }
    if (periodAdj !== 0) {
      minutesByUser.set(id, Math.max(0, (minutesByUser.get(id) ?? 0) + periodAdj));
    }
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
