import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  // Try a lightweight query on each critical table
  const results = await Promise.all([
    supabase.from("profiles").select("id").limit(1),
    supabase.from("assignments").select("id").limit(1),
    supabase.from("tasks").select("id").limit(1),
    supabase.from("courses").select("id").limit(1),
  ]);

  const missing: string[] = [];
  const tables = ["profiles", "assignments", "tasks", "courses"];

  results.forEach((r, i) => {
    // PostgREST returns a specific error code when the table doesn't exist
    if (r.error && (r.error.code === "42P01" || r.error.message.includes("does not exist") || r.error.message.includes("schema cache"))) {
      missing.push(tables[i]);
    }
  });

  if (missing.length > 0) {
    return NextResponse.json({ ok: false, missing }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
