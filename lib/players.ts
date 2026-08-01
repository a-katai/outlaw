import { cache } from "react";
import { createBrowserClient } from "./supabase";
import { sortByRankThenName } from "./draft-logic";
import type { PlayerPosition } from "./draft-types";
import { getArchiveSkaterLine, type SkaterStat } from "./league-data";
import { aggregateSkaterStats, type GameStatDbRow, type GameRosterDbRow, type GameType } from "./live-season";

// --- /players pool ---

export type PlayerPoolRow = {
  id: string;
  name: string;
  position: PlayerPosition | null;
  rank: number | null;
  teamName: string | null; // drafted team name in the active season, else null
};

/**
 * Every player in the pool, with their drafted team (active season only) if
 * one exists. Sorted rank asc (nulls last), then name — same ordering as the
 * draft board's available-players list.
 */
export const getPlayerPool = cache(async (): Promise<PlayerPoolRow[]> => {
  const supabase = createBrowserClient();

  const [playersRes, activeSeasonRes] = await Promise.all([
    supabase.from("players").select("id,name,position,rank"),
    supabase.from("seasons").select("id").eq("status", "active").maybeSingle(),
  ]);
  const players = playersRes.data ?? [];

  const teamNameByPlayerId = new Map<string, string>();
  const activeSeasonId = activeSeasonRes.data?.id;
  if (activeSeasonId) {
    const teamsRes = await supabase.from("teams").select("id,name").eq("season_id", activeSeasonId);
    const teams = teamsRes.data ?? [];
    const teamIds = teams.map((t) => t.id);
    if (teamIds.length) {
      const picksRes = await supabase.from("draft_picks").select("team_id,player_id").in("team_id", teamIds);
      const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
      for (const pick of picksRes.data ?? []) {
        const name = teamNameById.get(pick.team_id);
        if (name) teamNameByPlayerId.set(pick.player_id, name);
      }
    }
  }

  const rows: PlayerPoolRow[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position as PlayerPosition | null,
    rank: p.rank,
    teamName: teamNameByPlayerId.get(p.id) ?? null,
  }));

  return sortByRankThenName(rows);
});

// --- /players/[id] profile ---

export type PlayerCareerRow = {
  seasonId: string;
  seasonLabel: string;
  gameType: GameType;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
};

export type PlayerGameLogRow = {
  gameId: string;
  date: string;
  matchup: string;
  goals: number;
  assists: number;
};

export type PlayerProfile = {
  id: string;
  name: string;
  position: PlayerPosition | null;
  rank: number | null;
  teamName: string | null; // drafted team name in the active season, else null
  career: PlayerCareerRow[]; // DB seasons, newest first; playoff row only if it has GP
  gameLog: PlayerGameLogRow[]; // this player's final games, newest first
  archiveLine: SkaterStat | null; // 2025–26 static archive line, if matched
};

/**
 * Full profile for one player: drafted team (active season), DB career
 * lines (regular/playoff split, per season, FINAL games only), game log, and
 * a static 2025–26 archive line if their name matches. Returns null if the
 * player id doesn't exist.
 */
export const getPlayerProfile = cache(async (id: string): Promise<PlayerProfile | null> => {
  const supabase = createBrowserClient();

  const { data: player } = await supabase.from("players").select("id,name,position,rank").eq("id", id).maybeSingle();
  if (!player) return null;

  const [activeSeasonRes, statsRes, rostersRes] = await Promise.all([
    supabase.from("seasons").select("id").eq("status", "active").maybeSingle(),
    supabase.from("game_stats").select("game_id,team_id,goals,assists").eq("player_id", id),
    supabase.from("game_rosters").select("game_id,team_id").eq("player_id", id),
  ]);

  // --- Drafted team, active season only ---
  let teamName: string | null = null;
  const activeSeasonId = activeSeasonRes.data?.id;
  if (activeSeasonId) {
    const teamsRes = await supabase.from("teams").select("id,name").eq("season_id", activeSeasonId);
    const activeTeams = teamsRes.data ?? [];
    const activeTeamIds = activeTeams.map((t) => t.id);
    if (activeTeamIds.length) {
      const pickRes = await supabase
        .from("draft_picks")
        .select("team_id")
        .eq("player_id", id)
        .in("team_id", activeTeamIds)
        .maybeSingle();
      if (pickRes.data) {
        teamName = activeTeams.find((t) => t.id === pickRes.data!.team_id)?.name ?? null;
      }
    }
  }

  // --- DB career + game log: every FINAL game this player appears in, via
  // game_stats and/or game_rosters (same GP union rule as getSeasonLive). ---
  const statRows: GameStatDbRow[] = (statsRes.data ?? []).map((s) => ({
    game_id: s.game_id,
    player_id: id,
    team_id: s.team_id,
    goals: s.goals,
    assists: s.assists,
  }));
  const rosterRows: GameRosterDbRow[] = (rostersRes.data ?? []).map((r) => ({
    game_id: r.game_id,
    player_id: id,
    team_id: r.team_id,
  }));

  const gameIds = Array.from(new Set([...statRows.map((s) => s.game_id), ...rosterRows.map((r) => r.game_id)]));

  let career: PlayerCareerRow[] = [];
  let gameLog: PlayerGameLogRow[] = [];

  if (gameIds.length) {
    const [gamesRes, seasonsRes] = await Promise.all([
      supabase
        .from("games")
        .select("id,season_id,game_date,status,game_type,home_team_id,away_team_id")
        .in("id", gameIds),
      supabase.from("seasons").select("id,label").order("created_at", { ascending: false }),
    ]);
    const games = (gamesRes.data ?? []).filter((g) => g.status === "final");
    const seasonRows = seasonsRes.data ?? [];
    const seasonLabelById = new Map(seasonRows.map((s) => [s.id, s.label]));
    // seasonsRes is already ordered newest-first (created_at desc) — index = rank.
    const seasonOrder = new Map(seasonRows.map((s, i) => [s.id, i]));

    const gameDateById = new Map(games.map((g) => [g.id, g.game_date]));

    const teamIds = Array.from(new Set(games.flatMap((g) => [g.home_team_id, g.away_team_id])));
    const teamsRes = teamIds.length
      ? await supabase.from("teams").select("id,name").in("id", teamIds)
      : { data: [] as { id: string; name: string }[] };
    const teamNameById = new Map((teamsRes.data ?? []).map((t) => [t.id, t.name]));

    // Career rows: bucket final games by (season, gameType), aggregate with
    // the shared GP-union helper, keep only buckets where this player has GP.
    const buckets = new Map<string, Set<string>>();
    for (const g of games) {
      const key = `${g.season_id}::${g.game_type}`;
      const set = buckets.get(key) ?? new Set<string>();
      set.add(g.id);
      buckets.set(key, set);
    }
    const careerRows: PlayerCareerRow[] = [];
    for (const [key, bucketGameIds] of buckets) {
      const [seasonId, gameType] = key.split("::") as [string, GameType];
      const agg = aggregateSkaterStats(bucketGameIds, gameDateById, statRows, rosterRows).get(id);
      if (!agg || agg.gamesPlayed === 0) continue;
      careerRows.push({
        seasonId,
        seasonLabel: seasonLabelById.get(seasonId) ?? seasonId,
        gameType,
        gamesPlayed: agg.gamesPlayed,
        goals: agg.goals,
        assists: agg.assists,
        points: agg.goals + agg.assists,
      });
    }
    careerRows.sort((a, b) => {
      const orderA = seasonOrder.get(a.seasonId) ?? 0;
      const orderB = seasonOrder.get(b.seasonId) ?? 0;
      if (orderA !== orderB) return orderA - orderB; // newest season first
      if (a.gameType === b.gameType) return 0;
      return a.gameType === "regular" ? -1 : 1; // regular row before its playoff row
    });
    career = careerRows;

    // Game log: every final game, newest first, with this player's G/A that game.
    const statByGame = new Map(statRows.map((s) => [s.game_id, s]));
    gameLog = games
      .map((g) => {
        const s = statByGame.get(g.id);
        return {
          gameId: g.id,
          date: g.game_date,
          matchup: `${teamNameById.get(g.away_team_id) ?? "TBD"} at ${teamNameById.get(g.home_team_id) ?? "TBD"}`,
          goals: s?.goals ?? 0,
          assists: s?.assists ?? 0,
        };
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  return {
    id: player.id,
    name: player.name,
    position: player.position as PlayerPosition | null,
    rank: player.rank,
    teamName,
    career,
    gameLog,
    archiveLine: getArchiveSkaterLine(player.name),
  };
});
