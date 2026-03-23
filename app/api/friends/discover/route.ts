import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // My current friends
  const { data: myFriendships } = await admin
    .from("friendships")
    .select("user_id_1, user_id_2")
    .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

  const myFriendIds = new Set(
    (myFriendships ?? []).map((f) => (f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1))
  );

  // Pending requests (both directions) — exclude from discover
  const { data: pendingReqs } = await admin
    .from("friend_requests")
    .select("sender_id, receiver_id")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .eq("status", "pending");

  const pendingIds = new Set(
    (pendingReqs ?? []).map((r) => (r.sender_id === user.id ? r.receiver_id : r.sender_id))
  );

  // All friendships in the system — to compute mutual friend counts
  const { data: allFriendships } = await admin
    .from("friendships")
    .select("user_id_1, user_id_2");

  // Build adjacency map
  const friendMap = new Map<string, Set<string>>();
  for (const f of allFriendships ?? []) {
    if (!friendMap.has(f.user_id_1)) friendMap.set(f.user_id_1, new Set());
    if (!friendMap.has(f.user_id_2)) friendMap.set(f.user_id_2, new Set());
    friendMap.get(f.user_id_1)!.add(f.user_id_2);
    friendMap.get(f.user_id_2)!.add(f.user_id_1);
  }

  // Exclude self, existing friends, pending
  const excludeIds = [user.id, ...Array.from(myFriendIds), ...Array.from(pendingIds)];

  const { data: allProfiles } = await admin
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .not("id", "in", `(${excludeIds.join(",")})`);

  // Compute mutual count for each candidate
  const candidates = (allProfiles ?? []).map((profile) => {
    const theirFriends = friendMap.get(profile.id) ?? new Set<string>();
    let mutuals = 0;
    for (const fId of myFriendIds) {
      if (theirFriends.has(fId)) mutuals++;
    }
    return { ...profile, mutuals };
  });

  // Sort: most mutuals first, then alphabetically
  candidates.sort((a, b) => b.mutuals - a.mutuals || (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email));

  return NextResponse.json({ data: candidates });
}
