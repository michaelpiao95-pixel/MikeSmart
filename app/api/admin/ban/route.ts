import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

async function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const admin = await getAdmin();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return null;
  return { user, admin };
}

// Ban a user
export async function POST(request: NextRequest) {
  const ctx = await assertAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, hours } = await request.json();
  // hours: number of hours, or -1 for permanent
  if (!userId || hours === undefined) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (userId === ctx.user.id) return NextResponse.json({ error: "Cannot ban yourself" }, { status: 400 });

  let bannedUntil: string;
  if (hours === -1) {
    bannedUntil = "2099-01-01T00:00:00Z";
  } else {
    const d = new Date();
    d.setTime(d.getTime() + hours * 60 * 60 * 1000);
    bannedUntil = d.toISOString();
  }

  await ctx.admin.from("profiles").update({ banned_until: bannedUntil }).eq("id", userId);
  return NextResponse.json({ ok: true });
}

// Unban a user
export async function DELETE(request: NextRequest) {
  const ctx = await assertAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  await ctx.admin.from("profiles").update({ banned_until: null }).eq("id", userId);
  return NextResponse.json({ ok: true });
}
