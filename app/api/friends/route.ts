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

  const { data: friendships } = await admin
    .from("friendships")
    .select("user_id_1, user_id_2, created_at")
    .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

  const friendIds = (friendships ?? []).map((f) =>
    f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1
  );

  if (friendIds.length === 0) return NextResponse.json({ data: [] });

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .in("id", friendIds);

  // For any profile missing an email, fall back to the auth user's email
  const missingEmailIds = (profiles ?? []).filter((p) => !p.email).map((p) => p.id);
  const authEmailMap: Record<string, string> = {};
  if (missingEmailIds.length > 0) {
    await Promise.all(
      missingEmailIds.map(async (id) => {
        const { data: { user: authUser } } = await admin.auth.admin.getUserById(id);
        if (authUser?.email) authEmailMap[id] = authUser.email;
      })
    );
  }

  const data = (profiles ?? []).map((p) => ({
    ...p,
    email: p.email ?? authEmailMap[p.id] ?? null,
  }));

  return NextResponse.json({ data });
}
