import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await request.json(); // 'accept' | 'decline'
  if (!["accept", "decline"].includes(action))
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  // Fetch the request — must be the receiver
  const { data: req } = await admin
    .from("friend_requests")
    .select("*")
    .eq("id", params.id)
    .eq("receiver_id", user.id)
    .eq("status", "pending")
    .single();

  if (!req) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  // Update status
  await admin
    .from("friend_requests")
    .update({ status: action === "accept" ? "accepted" : "declined" })
    .eq("id", params.id);

  // Create friendship if accepted
  if (action === "accept") {
    const [uid1, uid2] = [req.sender_id, user.id].sort();
    await admin
      .from("friendships")
      .insert({ user_id_1: uid1, user_id_2: uid2 })
      .select()
      .single();
  }

  return NextResponse.json({ ok: true });
}
