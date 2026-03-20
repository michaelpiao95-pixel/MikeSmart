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

  // Incoming pending requests
  const { data: incoming } = await admin
    .from("friend_requests")
    .select("id, sender_id, created_at")
    .eq("receiver_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  // Outgoing pending requests
  const { data: outgoing } = await admin
    .from("friend_requests")
    .select("id, receiver_id, created_at")
    .eq("sender_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  // Fetch profiles for all relevant user IDs
  const senderIds = (incoming ?? []).map((r) => r.sender_id);
  const receiverIds = (outgoing ?? []).map((r) => r.receiver_id);
  const allIds = [...new Set([...senderIds, ...receiverIds])];

  let profiles: Record<string, { email: string; full_name: string | null; avatar_url: string | null }> = {};
  if (allIds.length > 0) {
    const { data: profileData } = await admin
      .from("profiles")
      .select("id, email, full_name, avatar_url")
      .in("id", allIds);
    profiles = Object.fromEntries((profileData ?? []).map((p) => [p.id, p]));
  }

  return NextResponse.json({
    data: {
      incoming: (incoming ?? []).map((r) => ({ ...r, sender: profiles[r.sender_id] })),
      outgoing: (outgoing ?? []).map((r) => ({ ...r, receiver: profiles[r.receiver_id] })),
    },
  });
}
