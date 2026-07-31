import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  let body: { code?: string; playerId?: string; draftId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const code = body.code?.trim().toUpperCase();
  const playerId = body.playerId;
  let draftId = body.draftId;

  if (!code) return NextResponse.json({ ok: false, error: "Missing team code" }, { status: 400 });
  if (!playerId) return NextResponse.json({ ok: false, error: "Missing player" }, { status: 400 });

  const supabase = createAdminClient();

  if (!draftId) {
    const { data: latest, error } = await supabase
      .from("drafts")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !latest) return NextResponse.json({ ok: false, error: "No draft found" }, { status: 404 });
    draftId = latest.id;
  }

  const { data, error } = await supabase.rpc("make_pick", {
    p_draft_id: draftId,
    p_code: code,
    p_player_id: playerId,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
