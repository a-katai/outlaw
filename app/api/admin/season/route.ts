import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

type Body =
  | { action: "create"; id: string; label: string }
  | { action: "set-active"; id: string }
  | { action: "mark-complete"; id: string };

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const [seasonsRes, teamsRes, playersRes, picksRes] = await Promise.all([
    supabase.from("seasons").select("*").order("id", { ascending: false }),
    supabase.from("teams").select("*").order("name", { ascending: true }),
    supabase.from("players").select("id,name").order("name", { ascending: true }),
    supabase.from("draft_picks").select("team_id,player_id"),
  ]);

  for (const res of [seasonsRes, teamsRes, playersRes, picksRes]) {
    if (res.error) return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
  }

  const activeSeason = (seasonsRes.data ?? []).find((s) => s.status === "active") ?? null;

  let games: unknown[] = [];
  let gameStats: unknown[] = [];
  if (activeSeason) {
    const gamesRes = await supabase
      .from("games")
      .select("*")
      .eq("season_id", activeSeason.id)
      .order("game_date", { ascending: true });
    if (gamesRes.error) return NextResponse.json({ ok: false, error: gamesRes.error.message }, { status: 500 });
    games = gamesRes.data ?? [];

    const gameIds = games.map((g) => (g as { id: string }).id);
    if (gameIds.length) {
      const statsRes = await supabase.from("game_stats").select("*").in("game_id", gameIds);
      if (statsRes.error) return NextResponse.json({ ok: false, error: statsRes.error.message }, { status: 500 });
      gameStats = statsRes.data ?? [];
    }
  }

  return NextResponse.json({
    ok: true,
    seasons: seasonsRes.data ?? [],
    activeSeason,
    teams: teamsRes.data ?? [],
    players: playersRes.data ?? [],
    draftPicks: picksRes.data ?? [],
    games,
    gameStats,
  });
}

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

  const supabase = createAdminClient();

  switch (body.action) {
    case "create": {
      const id = body.id?.trim();
      const label = body.label?.trim();
      if (!id || !label) return NextResponse.json({ ok: false, error: "Season id and label are required" }, { status: 400 });
      const { data, error } = await supabase
        .from("seasons")
        .insert({ id, label, status: "upcoming" })
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, season: data });
    }

    case "set-active": {
      const { error: deactivateError } = await supabase
        .from("seasons")
        .update({ status: "complete" })
        .eq("status", "active");
      if (deactivateError) return NextResponse.json({ ok: false, error: deactivateError.message }, { status: 500 });

      const { data, error } = await supabase
        .from("seasons")
        .update({ status: "active" })
        .eq("id", body.id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, season: data });
    }

    case "mark-complete": {
      const { data, error } = await supabase
        .from("seasons")
        .update({ status: "complete" })
        .eq("id", body.id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, season: data });
    }

    default:
      return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }
}
