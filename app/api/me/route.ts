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

  const { data: profile } = await admin
    .from("profiles")
    .select("banned_until")
    .eq("id", user.id)
    .single();

  const bannedUntil = profile?.banned_until ? new Date(profile.banned_until) : null;
  const now = new Date();
  const isBanned = bannedUntil ? bannedUntil > now : false;
  const isPermanent = isBanned && bannedUntil!.getFullYear() >= 2099;

  return NextResponse.json({
    banned: isBanned,
    bannedUntil: bannedUntil?.toISOString() ?? null,
    isPermanent,
  });
}
