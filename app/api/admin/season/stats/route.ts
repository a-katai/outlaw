import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

type StatRow = { playerId: string; teamId: string; goals: number; assists: number };
type Body = { action: "save"; gameId: string; rows: StatRow[] };

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  if (body.action !== "save") {
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }
  if (!body.gameId) {
    return NextResponse.json({ ok: false, error: "gameId is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("game_stats")
    .select("player_id")
    .eq("game_id", body.gameId);
  if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });

  const rows = body.rows ?? [];
  const keepIds = new Set(rows.map((r) => r.playerId));
  const toDelete = (existing ?? []).map((r) => r.player_id).filter((id) => !keepIds.has(id));

  if (toDelete.length) {
    const { error } = await supabase.from("game_stats").delete().eq("game_id", body.gameId).in("player_id", toDelete);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (rows.length) {
    const { error } = await supabase.from("game_stats").upsert(
      rows.map((r) => ({
        game_id: body.gameId,
        player_id: r.playerId,
        team_id: r.teamId,
        goals: Number(r.goals) || 0,
        assists: Number(r.assists) || 0,
      })),
      { onConflict: "game_id,player_id" },
    );
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
