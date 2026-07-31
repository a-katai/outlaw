import { NextRequest, NextResponse } from "next/server";
import { isScorekeeperAuthed } from "@/lib/scorekeeper-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { recomputeGame } from "@/lib/scorekeeper";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ gameId: string }> }) {
  if (!(await isScorekeeperAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { gameId } = await params;
  const supabase = createAdminClient();

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id,season_id,game_date,game_time,home_team_id,away_team_id,home_score,away_score,status,note,game_type")
    .eq("id", gameId)
    .maybeSingle();
  if (gameError) return NextResponse.json({ ok: false, error: gameError.message }, { status: 500 });
  if (!game) return NextResponse.json({ ok: false, error: "Game not found" }, { status: 404 });

  const teamIds = [game.home_team_id, game.away_team_id];
  const [teamsRes, picksRes, goalsRes] = await Promise.all([
    supabase.from("teams").select("id,name").in("id", teamIds),
    supabase.from("draft_picks").select("team_id,player_id").in("team_id", teamIds),
    supabase
      .from("goal_events")
      .select("id,team_id,scorer_id,assist_id,created_at")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true }),
  ]);
  if (teamsRes.error) return NextResponse.json({ ok: false, error: teamsRes.error.message }, { status: 500 });
  if (picksRes.error) return NextResponse.json({ ok: false, error: picksRes.error.message }, { status: 500 });
  if (goalsRes.error) return NextResponse.json({ ok: false, error: goalsRes.error.message }, { status: 500 });

  const teamNameById = new Map((teamsRes.data ?? []).map((t) => [t.id, t.name]));
  const picks = picksRes.data ?? [];
  const goals = goalsRes.data ?? [];

  const playerIds = Array.from(
    new Set([
      ...picks.map((p) => p.player_id),
      ...goals.map((g) => g.scorer_id).filter((v): v is string => Boolean(v)),
      ...goals.map((g) => g.assist_id).filter((v): v is string => Boolean(v)),
    ]),
  );
  const playersRes = playerIds.length
    ? await supabase.from("players").select("id,name").in("id", playerIds)
    : { data: [] as { id: string; name: string }[] };
  const playerNameById = new Map((playersRes.data ?? []).map((p) => [p.id, p.name]));

  const rosterFor = (teamId: string) =>
    picks
      .filter((p) => p.team_id === teamId)
      .map((p) => ({ id: p.player_id, name: playerNameById.get(p.player_id) ?? "Unknown" }))
      .sort((a, b) => a.name.localeCompare(b.name));

  const goalEvents = goals.map((g) => ({
    id: g.id,
    teamId: g.team_id,
    scorerId: g.scorer_id,
    scorerName: g.scorer_id ? (playerNameById.get(g.scorer_id) ?? "Unknown") : null,
    assistId: g.assist_id,
    assistName: g.assist_id ? (playerNameById.get(g.assist_id) ?? "Unknown") : null,
    createdAt: g.created_at,
  }));

  return NextResponse.json({
    ok: true,
    game: {
      id: game.id,
      date: game.game_date,
      time: game.game_time,
      status: game.status,
      gameType: game.game_type,
      note: game.note,
      homeTeamId: game.home_team_id,
      awayTeamId: game.away_team_id,
      homeTeam: teamNameById.get(game.home_team_id) ?? "TBD",
      awayTeam: teamNameById.get(game.away_team_id) ?? "TBD",
      homeScore: game.home_score,
      awayScore: game.away_score,
    },
    roster: {
      home: rosterFor(game.home_team_id),
      away: rosterFor(game.away_team_id),
    },
    goalEvents,
  });
}

type Body =
  | { action: "start" }
  | { action: "add-goal"; teamId: string; scorerId: string | null; assistId: string | null }
  | { action: "remove-goal"; eventId: string }
  | { action: "end" }
  | { action: "reopen" };

export async function POST(req: NextRequest, { params }: { params: Promise<{ gameId: string }> }) {
  if (!(await isScorekeeperAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { gameId } = await params;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id,home_team_id,away_team_id,status")
    .eq("id", gameId)
    .maybeSingle();
  if (gameError) return NextResponse.json({ ok: false, error: gameError.message }, { status: 500 });
  if (!game) return NextResponse.json({ ok: false, error: "Game not found" }, { status: 404 });

  switch (body.action) {
    case "start": {
      if (game.status !== "scheduled") {
        return NextResponse.json({ ok: false, error: "Game already started" }, { status: 400 });
      }
      const { error } = await supabase.from("games").update({ status: "live" }).eq("id", gameId);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      break;
    }

    case "add-goal": {
      if (game.status !== "live") {
        return NextResponse.json({ ok: false, error: "Game isn't live" }, { status: 400 });
      }
      if (body.teamId !== game.home_team_id && body.teamId !== game.away_team_id) {
        return NextResponse.json({ ok: false, error: "Invalid team" }, { status: 400 });
      }
      if (body.scorerId && body.assistId && body.scorerId === body.assistId) {
        return NextResponse.json({ ok: false, error: "Scorer and assist must be different players" }, { status: 400 });
      }
      const { error } = await supabase.from("goal_events").insert({
        game_id: gameId,
        team_id: body.teamId,
        scorer_id: body.scorerId || null,
        assist_id: body.assistId || null,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      break;
    }

    case "remove-goal": {
      const { error } = await supabase.from("goal_events").delete().eq("id", body.eventId).eq("game_id", gameId);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      break;
    }

    case "end": {
      const { error } = await supabase.from("games").update({ status: "final" }).eq("id", gameId);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      break;
    }

    case "reopen": {
      if (game.status !== "final") {
        return NextResponse.json({ ok: false, error: "Game isn't final" }, { status: 400 });
      }
      const { error } = await supabase.from("games").update({ status: "live" }).eq("id", gameId);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      break;
    }

    default:
      return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }

  const recomputed = await recomputeGame(supabase, gameId);
  return NextResponse.json({ ok: true, ...recomputed });
}
