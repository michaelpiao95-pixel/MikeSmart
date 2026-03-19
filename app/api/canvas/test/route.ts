import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CanvasClient, CanvasApiError } from "@/lib/canvas/client";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { canvas_base_url, canvas_api_token } = body;

  if (!canvas_base_url || !canvas_api_token) {
    return NextResponse.json(
      { error: "canvas_base_url and canvas_api_token are required" },
      { status: 400 }
    );
  }

  const canvas = new CanvasClient(canvas_base_url, canvas_api_token);

  try {
    const me = await canvas.validateToken();
    return NextResponse.json({ data: { name: me.name } });
  } catch (err) {
    if (err instanceof CanvasApiError) {
      return NextResponse.json(
        { error: `Canvas returned ${err.status} — check your token.` },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Could not reach Canvas. Check the URL." },
      { status: 400 }
    );
  }
}
