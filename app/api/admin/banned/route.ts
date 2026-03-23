import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return null;
  return { user, admin };
}

export async function GET() {
  const ctx = await assertAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date().toISOString();
  const { data } = await ctx.admin
    .from("profiles")
    .select("id, email, full_name, avatar_url, banned_until")
    .gt("banned_until", now);

  const users = (data ?? []).map((p) => {
    const bannedUntil = new Date(p.banned_until!);
    return {
      userId: p.id,
      email: p.email,
      fullName: p.full_name ?? null,
      avatarUrl: p.avatar_url ?? null,
      bannedUntil: bannedUntil.toISOString(),
      isPermanent: bannedUntil.getFullYear() >= 2099,
    };
  });

  return NextResponse.json({ data: users });
}
