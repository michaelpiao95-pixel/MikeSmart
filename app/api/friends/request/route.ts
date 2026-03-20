import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail === user.email?.toLowerCase())
    return NextResponse.json({ error: "You can't add yourself" }, { status: 400 });

  // Create admin client inside handler so env vars are always resolved
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Search all profiles and filter in JS to avoid any PostgREST filter issues
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, email, full_name");

  if (profilesError) {
    return NextResponse.json({ error: "Database error: " + profilesError.message }, { status: 500 });
  }

  const target = (profiles ?? []).find(
    (p) => p.email?.trim().toLowerCase() === normalizedEmail
  );

  if (!target) return NextResponse.json({ error: "No user found with that email" }, { status: 404 });

  // Check if already friends
  const [uid1, uid2] = [user.id, target.id].sort();
  const { data: existing } = await admin
    .from("friendships")
    .select("id")
    .eq("user_id_1", uid1)
    .eq("user_id_2", uid2)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "You are already friends" }, { status: 400 });

  // Check if request already sent
  const { data: existingReq } = await admin
    .from("friend_requests")
    .select("id, status")
    .eq("sender_id", user.id)
    .eq("receiver_id", target.id)
    .maybeSingle();

  if (existingReq?.status === "pending")
    return NextResponse.json({ error: "Friend request already sent" }, { status: 400 });

  // Check if they already sent us a request
  const { data: reverseReq } = await admin
    .from("friend_requests")
    .select("id, status")
    .eq("sender_id", target.id)
    .eq("receiver_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (reverseReq)
    return NextResponse.json({ error: "This user already sent you a friend request" }, { status: 400 });

  const { data, error: insertError } = await admin
    .from("friend_requests")
    .insert({ sender_id: user.id, receiver_id: target.id, status: "pending" })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ data });
}
