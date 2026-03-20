import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Ensure bucket exists
  const { error: bucketError } = await admin.storage.createBucket("avatars", { public: true });
  // Ignore error if bucket already exists
  if (bucketError && !bucketError.message.includes("already exists")) {
    return NextResponse.json({ error: "Failed to create storage bucket: " + bucketError.message }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const allowed = ["jpg", "jpeg", "png", "gif", "webp"];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: "Only image files are allowed (jpg, png, gif, webp)" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const path = `${user.id}/avatar.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = urlData.publicUrl + `?t=${Date.now()}`;

  const { error: updateError } = await admin
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to save avatar URL: " + updateError.message }, { status: 500 });
  }

  return NextResponse.json({ avatarUrl });
}
