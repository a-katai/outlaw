import { NextRequest, NextResponse } from "next/server";
import { isScorekeeperAuthed, teamIdForCode } from "@/lib/scorekeeper-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { recomputeGame } from "@/lib/scorekeeper";

export async function GET(req: NextRequest, { params }: { params: Promise<{ gameId: string }> }) {
  // Scorekeepers see everything; a team manager (x-team-code) can read the sheet too.
  const managerTeamId = await teamIdForCode(req.headers.get("x-team-code"));
  if (!managerTeamId && !(await isScorekeeperAuthed(req.headers.get("x-scorekeeper-code")))) {
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
  const [teamsRes, picksRes, rostersRes, goalsRes, allPlayersRes, penaltiesRes] = await Promise.all([
    supabase.from("teams").select("id,name").in("id", teamIds),
    supabase.from("draft_picks").select("team_id,player_id").in("team_id", teamIds),
    supabase.from("game_rosters").select("team_id,player_id").eq("game_id", gameId),
    supabase
      .from("goal_events")
      .select("id,team_id,scorer_id,assist_id,assist2_id,period,created_at")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true }),
    supabase.from("players").select("id,name,position,rank,jersey_number,is_sub").order("name", { ascending: true }),
    supabase
      .from("penalty_events")
      .select("id,team_id,player_id,infraction,minutes,period,created_at")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true }),
  ]);
  if (teamsRes.error) return NextResponse.json({ ok: false, error: teamsRes.error.message }, { status: 500 });
  if (picksRes.error) return NextResponse.json({ ok: false, error: picksRes.error.message }, { status: 500 });
  if (rostersRes.error) return NextResponse.json({ ok: false, error: rostersRes.error.message }, { status: 500 });
  if (goalsRes.error) return NextResponse.json({ ok: false, error: goalsRes.error.message }, { status: 500 });
  if (allPlayersRes.error) return NextResponse.json({ ok: false, error: allPlayersRes.error.message }, { status: 500 });
  if (penaltiesRes.error) return NextResponse.json({ ok: false, error: penaltiesRes.error.message }, { status: 500 });

  const teamNameById = new Map((teamsRes.data ?? []).map((t) => [t.id, t.name]));
  const picks = picksRes.data ?? [];
  const dressedRows = rostersRes.data ?? [];
  const goals = goalsRes.data ?? [];
  const allPlayers = allPlayersRes.data ?? [];
  const playerById = new Map(allPlayers.map((p) => [p.id, p]));

  const rosterFor = (teamId: string) => {
    const draftIds = picks.filter((p) => p.team_id === teamId).map((p) => p.player_id);
    const dressedIds = dressedRows.filter((r) => r.team_id === teamId).map((r) => r.player_id);
    const dressedSet = new Set(dressedIds);
    const allIds = Array.from(new Set([...draftIds, ...dressedIds]));
    return allIds
      .map((id) => ({
        id,
        name: playerById.get(id)?.name ?? "Unknown",
        position: playerById.get(id)?.position ?? null,
        rank: playerById.get(id)?.rank ?? null,
        jersey: playerById.get(id)?.jersey_number ?? null,
        dressed: dressedSet.has(id),
      }))
      .sort((a, b) => {
        if (a.dressed !== b.dressed) return a.dressed ? -1 : 1; // dressed first
        return a.name.localeCompare(b.name);
      });
  };

  const homeRoster = rosterFor(game.home_team_id);
  const awayRoster = rosterFor(game.away_team_id);
  const rosteredIds = new Set([...homeRoster.map((p) => p.id), ...awayRoster.map((p) => p.id)]);
  const playerPool = allPlayers
    .filter((p) => !rosteredIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, position: p.position, rank: p.rank, jersey: p.jersey_number ?? null, isSub: p.is_sub }));

  const goalEvents = goals.map((g) => ({
    id: g.id,
    teamId: g.team_id,
    scorerId: g.scorer_id,
    scorerName: g.scorer_id ? (playerById.get(g.scorer_id)?.name ?? "Unknown") : null,
    assistId: g.assist_id,
    assistName: g.assist_id ? (playerById.get(g.assist_id)?.name ?? "Unknown") : null,
    assist2Id: g.assist2_id,
    assist2Name: g.assist2_id ? (playerById.get(g.assist2_id)?.name ?? "Unknown") : null,
    period: g.period ?? null,
    createdAt: g.created_at,
  }));

  const penaltyEvents = (penaltiesRes.data ?? []).map((p) => ({
    id: p.id,
    teamId: p.team_id,
    playerId: p.player_id,
    playerName: p.player_id ? (playerById.get(p.player_id)?.name ?? "Unknown") : null,
    infraction: p.infraction,
    minutes: p.minutes,
    period: p.period ?? null,
    createdAt: p.created_at,
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
      home: homeRoster,
      away: awayRoster,
    },
    playerPool,
    goalEvents,
    penaltyEvents,
  });
}

type Body =
  | { action: "start" }
  | { action: "add-goal"; teamId: string; scorerId: string | null; assistId: string | null; assist2Id?: string | null; period?: number | null }
  | { action: "remove-goal"; eventId: string }
  | { action: "end" }
  | { action: "reopen" }
  | { action: "reset" }
  | { action: "add-penalty"; teamId: string; playerId: string | null; infraction: string; minutes: number; period?: number | null }
  | { action: "remove-penalty"; eventId: string }
  | { action: "add-new-player"; teamId: string; name: string }
  | { action: "toggle-player"; teamId: string; playerId: string; dressed: boolean };

/** 1–3 or 4 (OT); anything else is "not recorded". */
function periodOf(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 4 ? v : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ gameId: string }> }) {
  const scorekeeper = await isScorekeeperAuthed(req.headers.get("x-scorekeeper-code"));
  const managerTeamId = scorekeeper ? null : await teamIdForCode(req.headers.get("x-team-code"));
  if (!scorekeeper && !managerTeamId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { gameId } = await params;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  // A manager only touches their own lineup — never the score, never the other bench.
  if (managerTeamId) {
    const ownLineup =
      (body.action === "toggle-player" || body.action === "add-new-player") && body.teamId === managerTeamId;
    if (!ownLineup) {
      return NextResponse.json({ ok: false, error: "Managers can only edit their own lineup" }, { status: 403 });
    }
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
        assist2_id: body.assist2Id || null,
        period: periodOf(body.period),
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

      // A goal by a not-yet-checked-in player counts as checking them in —
      // don't block logging on lineup bookkeeping. Same for the assist.
      const autoCheckIns = [body.scorerId, body.assistId, body.assist2Id].filter((v): v is string => Boolean(v));
      if (autoCheckIns.length) {
        const { error: rosterError } = await supabase.from("game_rosters").upsert(
          autoCheckIns.map((playerId) => ({ game_id: gameId, player_id: playerId, team_id: body.teamId })),
          { onConflict: "game_id,player_id", ignoreDuplicates: true },
        );
        if (rosterError) return NextResponse.json({ ok: false, error: rosterError.message }, { status: 500 });
      }
      break;
    }

    case "toggle-player": {
      if (body.teamId !== game.home_team_id && body.teamId !== game.away_team_id) {
        return NextResponse.json({ ok: false, error: "Invalid team" }, { status: 400 });
      }
      if (typeof body.dressed !== "boolean" || !body.playerId) {
        return NextResponse.json({ ok: false, error: "playerId and dressed are required" }, { status: 400 });
      }
      if (body.dressed) {
        const { error } = await supabase
          .from("game_rosters")
          .upsert(
            { game_id: gameId, player_id: body.playerId, team_id: body.teamId },
            { onConflict: "game_id,player_id", ignoreDuplicates: true },
          );
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      } else {
        const { error } = await supabase
          .from("game_rosters")
          .delete()
          .eq("game_id", gameId)
          .eq("player_id", body.playerId);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      // Lineup check-in doesn't touch goal_events/game_stats, so skip
      // recomputeGame here — otherwise a pre-game roster tap would
      // seed home_score/away_score to 0 and make the admin editor's
      // Save button look armed on an unplayed game.
      return NextResponse.json({ ok: true });
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

    case "reset": {
      // Undo an accidental start: back to scheduled, wiping the sheet.
      // Lineups stay — those were right before the tap.
      if (game.status !== "live" && game.status !== "final") {
        return NextResponse.json({ ok: false, error: "Nothing to reset — game hasn't started" }, { status: 400 });
      }
      const goalsDel = await supabase.from("goal_events").delete().eq("game_id", gameId);
      if (goalsDel.error) return NextResponse.json({ ok: false, error: goalsDel.error.message }, { status: 500 });
      const pensDel = await supabase.from("penalty_events").delete().eq("game_id", gameId);
      if (pensDel.error) return NextResponse.json({ ok: false, error: pensDel.error.message }, { status: 500 });
      const statsDel = await supabase.from("game_stats").delete().eq("game_id", gameId);
      if (statsDel.error) return NextResponse.json({ ok: false, error: statsDel.error.message }, { status: 500 });
      const { error } = await supabase
        .from("games")
        .update({ status: "scheduled", home_score: null, away_score: null })
        .eq("id", gameId);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      // No recompute: it would seed 0–0 onto a game that hasn't happened.
      return NextResponse.json({ ok: true });
    }

    case "add-penalty": {
      if (body.teamId !== game.home_team_id && body.teamId !== game.away_team_id) {
        return NextResponse.json({ ok: false, error: "Invalid team" }, { status: 400 });
      }
      const infraction = body.infraction?.trim();
      if (!infraction) return NextResponse.json({ ok: false, error: "Pick an infraction" }, { status: 400 });
      const minutes = Number(body.minutes);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 30) {
        return NextResponse.json({ ok: false, error: "Minutes must be 1–30" }, { status: 400 });
      }
      const { error } = await supabase.from("penalty_events").insert({
        game_id: gameId,
        team_id: body.teamId,
        player_id: body.playerId || null,
        infraction,
        minutes,
        period: periodOf(body.period),
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      // A penalized player was on the ice — check them in like a scorer.
      if (body.playerId) {
        const { error: rosterError } = await supabase.from("game_rosters").upsert(
          { game_id: gameId, player_id: body.playerId, team_id: body.teamId },
          { onConflict: "game_id,player_id", ignoreDuplicates: true },
        );
        if (rosterError) return NextResponse.json({ ok: false, error: rosterError.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    case "add-new-player": {
      // Someone not in the system at all — a walk-on. They enter as a sub
      // and are dressed for this game in one step.
      if (body.teamId !== game.home_team_id && body.teamId !== game.away_team_id) {
        return NextResponse.json({ ok: false, error: "Invalid team" }, { status: 400 });
      }
      const name = body.name?.trim().replace(/\s+/g, " ");
      if (!name || name.length < 2) return NextResponse.json({ ok: false, error: "Enter the player's name" }, { status: 400 });
      const { data: existing } = await supabase.from("players").select("id").ilike("name", name).maybeSingle();
      let playerId = existing?.id ?? null;
      if (!playerId) {
        const { data: created, error: createError } = await supabase
          .from("players")
          .insert({ name, is_sub: true })
          .select("id")
          .single();
        if (createError) return NextResponse.json({ ok: false, error: createError.message }, { status: 500 });
        playerId = created.id;
      }
      const { error } = await supabase
        .from("game_rosters")
        .upsert({ game_id: gameId, player_id: playerId, team_id: body.teamId }, { onConflict: "game_id,player_id", ignoreDuplicates: true });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, playerId });
    }

    case "remove-penalty": {
      const { error } = await supabase.from("penalty_events").delete().eq("id", body.eventId).eq("game_id", gameId);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
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
