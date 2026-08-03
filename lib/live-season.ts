import { cache } from "react";
import { createBrowserClient } from "./supabase";
import { seasons as staticSeasons, type SkaterStat, type TeamStanding } from "./league-data";

// Row shapes mirroring supabase/migrations/0002_live_season.sql.

export type SeasonStatus = "upcoming" | "active" | "complete";

export type SeasonRow = {
  id: string;
  label: string;
  status: SeasonStatus;
};

export type LiveTeam = {
  id: string;
  name: string;
};

export type LiveRosterPlayer = {
  id: string;
  name: string;
  position: string | null;
  rank: number | null;
};

export type GameType = "regular" | "playoff";

export type GameStatus = "scheduled" | "live" | "final";

export type LiveGame = {
  id: string;
  date: string; // ISO date, e.g. "2026-09-09"
  time: string | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  note: string | null;
  gameType: GameType;
  seriesId: string | null;
};

export type GoalieStat = {
  playerId: string;
  player: string;
  team: string;
  gp: number;
  wins: number;
  losses: number;
  ties: number;
  goalsAgainst: number;
  gaa: number;
  shutouts: number;
};

export type LiveSeason = {
  id: string;
  label: string;
  status: SeasonStatus;
  standings: TeamStanding[];
  skaters: SkaterStat[];
  goalies: GoalieStat[];
  games: LiveGame[];
  teams: LiveTeam[];
  rosters: Record<string, LiveRosterPlayer[]>; // keyed by team name
};

export type SeasonSummary = {
  id: string;
  label: string;
  status: SeasonStatus | "complete";
  live: boolean;
};

// --- Shared skater aggregation ---

export type GameStatDbRow = { game_id: string; player_id: string; team_id: string; goals: number; assists: number };
export type GameRosterDbRow = { game_id: string; player_id: string; team_id: string };
export type SkaterAggregate = { gamesPlayed: number; goals: number; assists: number; teamId: string };

/**
 * GP = union of game_stats appearances and game_rosters check-ins across the
 * given eligible game ids — a dressed player gets GP credit even if they
 * never touched the scoresheet. G/A are summed purely from game_stats.
 * "Team" = most recent (by game date) appearance across either source.
 *
 * Shared by league-wide skater stats (getSeasonLive, below) and a single
 * player's career line (lib/players.ts) — both call this one implementation
 * so the GP rule never drifts between the two.
 */
export function aggregateSkaterStats(
  eligibleGameIds: Set<string>,
  gameDateById: Map<string, string>,
  gameStats: GameStatDbRow[],
  gameRosters: GameRosterDbRow[],
): Map<string, SkaterAggregate> {
  const stats = gameStats.filter((s) => eligibleGameIds.has(s.game_id));
  const rosters = gameRosters.filter((r) => eligibleGameIds.has(r.game_id));

  type Appearance = { playerId: string; gameId: string; teamId: string };
  const appearances: Appearance[] = [
    ...stats.map((s) => ({ playerId: s.player_id, gameId: s.game_id, teamId: s.team_id })),
    ...rosters.map((r) => ({ playerId: r.player_id, gameId: r.game_id, teamId: r.team_id })),
  ];
  const appearancesByDateAsc = [...appearances].sort((a, b) => {
    const da = gameDateById.get(a.gameId) ?? "";
    const db = gameDateById.get(b.gameId) ?? "";
    return da < db ? -1 : da > db ? 1 : 0;
  });

  type Agg = { gpGames: Set<string>; goals: number; assists: number; teamId: string };
  const aggByPlayer = new Map<string, Agg>();
  for (const a of appearancesByDateAsc) {
    const existing = aggByPlayer.get(a.playerId) ?? { gpGames: new Set<string>(), goals: 0, assists: 0, teamId: a.teamId };
    existing.gpGames.add(a.gameId); // Set — union, no double-count when both sources hit the same game.
    existing.teamId = a.teamId; // last write (ascending by date) = most recent
    aggByPlayer.set(a.playerId, existing);
  }
  // Goals/assists are additive from game_stats only — every player here is
  // already present in aggByPlayer via the appearances merge above.
  for (const s of stats) {
    const existing = aggByPlayer.get(s.player_id);
    if (!existing) continue;
    existing.goals += s.goals;
    existing.assists += s.assists;
  }

  const result = new Map<string, SkaterAggregate>();
  for (const [playerId, agg] of aggByPlayer) {
    result.set(playerId, { gamesPlayed: agg.gpGames.size, goals: agg.goals, assists: agg.assists, teamId: agg.teamId });
  }
  return result;
}

// --- Goalie aggregation ---

export type GoalieGameInput = {
  id: string;
  date: string; // ISO date — used to pick "team of record" the same way aggregateSkaterStats does (most recent appearance)
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};
export type GoaliePlayerInput = { id: string; name: string; position: string | null };
export type GoalieTeamInput = { id: string; name: string };

/**
 * Goalie stats over a set of FINAL games (regular season, in getSeasonLive's
 * case). Pure function, no Supabase — takes exactly the rows it needs so it
 * can be unit-tested without a DB.
 *
 * Beer-league assumption: normally one goalie dresses per team per game, but
 * if game_rosters (or game_stats) shows two goalies checked in for the same
 * team in the same game, BOTH get full credit for that game (a mid-game
 * goalie swap is real beer-league life) — this is a deliberate choice, not a
 * dedup bug.
 *
 * A goalie's appearance-to-team mapping prefers game_rosters (who actually
 * dressed); a game_stats row fills in a goalie who has a scoring line but
 * wasn't checked in via roster.
 */
export function computeGoalieStats(
  games: GoalieGameInput[],
  gameRosters: GameRosterDbRow[],
  gameStats: GameStatDbRow[],
  players: GoaliePlayerInput[],
  teams: GoalieTeamInput[],
): GoalieStat[] {
  const goalieIds = new Set(players.filter((p) => p.position === "G").map((p) => p.id));
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
  const playerNameById = new Map(players.map((p) => [p.id, p.name]));
  const gameById = new Map(games.map((g) => [g.id, g]));

  const teamByPlayerGame = new Map<string, string>(); // `${playerId}::${gameId}` -> teamId
  for (const r of gameRosters) {
    if (!goalieIds.has(r.player_id) || !gameById.has(r.game_id)) continue;
    teamByPlayerGame.set(`${r.player_id}::${r.game_id}`, r.team_id);
  }
  for (const s of gameStats) {
    if (!goalieIds.has(s.player_id) || !gameById.has(s.game_id)) continue;
    const key = `${s.player_id}::${s.game_id}`;
    if (!teamByPlayerGame.has(key)) teamByPlayerGame.set(key, s.team_id);
  }

  // Process appearances date-ascending so "team" (last write per player)
  // lands on the most recent appearance — same rule as aggregateSkaterStats,
  // so a goalie who's dressed for two teams this season doesn't get an
  // arbitrary one.
  const orderedAppearances = Array.from(teamByPlayerGame.entries())
    .map(([key, teamId]) => {
      const [playerId, gameId] = key.split("::");
      return { playerId, gameId, teamId, date: gameById.get(gameId)!.date };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  type Agg = {
    gp: number;
    wins: number;
    losses: number;
    ties: number;
    goalsAgainst: number;
    shutouts: number;
    teamId: string;
  };
  const aggByPlayer = new Map<string, Agg>();

  for (const { playerId, gameId, teamId } of orderedAppearances) {
    const game = gameById.get(gameId)!;
    const isHome = teamId === game.homeTeamId;
    const isAway = teamId === game.awayTeamId;
    if (!isHome && !isAway) continue; // dressed for a team not in this game — shouldn't happen, guard anyway
    const teamScore = isHome ? game.homeScore : game.awayScore;
    const oppScore = isHome ? game.awayScore : game.homeScore;

    const existing = aggByPlayer.get(playerId) ?? {
      gp: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      goalsAgainst: 0,
      shutouts: 0,
      teamId,
    };
    existing.gp += 1;
    existing.goalsAgainst += oppScore;
    if (oppScore === 0) existing.shutouts += 1;
    if (teamScore > oppScore) existing.wins += 1;
    else if (teamScore < oppScore) existing.losses += 1;
    else existing.ties += 1;
    existing.teamId = teamId;
    aggByPlayer.set(playerId, existing);
  }

  const result: GoalieStat[] = Array.from(aggByPlayer.entries()).map(([playerId, agg]) => ({
    playerId,
    player: playerNameById.get(playerId) ?? "Unknown",
    team: teamNameById.get(agg.teamId) ?? "Unknown",
    gp: agg.gp,
    wins: agg.wins,
    losses: agg.losses,
    ties: agg.ties,
    goalsAgainst: agg.goalsAgainst,
    gaa: agg.gp > 0 ? Number((agg.goalsAgainst / agg.gp).toFixed(2)) : 0,
    shutouts: agg.shutouts,
  }));

  result.sort((a, b) => b.wins - a.wins || a.gaa - b.gaa);
  return result;
}

/**
 * Fetches a DB season with computed standings, skater stats, games, and
 * rosters — the same computation regardless of the season's status, so a
 * completed season's history stays fully browsable, not just the active one.
 *
 * - No id: prefer the active season; if none is active, fall back to the
 *   newest DB season by created_at.
 * - With id: fetch THAT season row whatever its status (active/complete/
 *   upcoming) — returns null if it doesn't exist as a DB season.
 *
 * Anon client is fine — every table involved is public-read.
 */
export const getSeasonLive = cache(async (id?: string): Promise<LiveSeason | null> => {
  const supabase = createBrowserClient();

  let seasonRow: SeasonRow | null = null;
  if (id) {
    const { data } = await supabase.from("seasons").select("id,label,status").eq("id", id).maybeSingle();
    seasonRow = data ?? null;
  } else {
    const { data: activeRow } = await supabase
      .from("seasons")
      .select("id,label,status")
      .eq("status", "active")
      .maybeSingle();
    if (activeRow) {
      seasonRow = activeRow;
    } else {
      const { data: newestRow } = await supabase
        .from("seasons")
        .select("id,label,status")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      seasonRow = newestRow ?? null;
    }
  }

  if (!seasonRow) return null;

  const [teamsRes, gamesRes] = await Promise.all([
    supabase.from("teams").select("id,name").eq("season_id", seasonRow.id),
    supabase
      .from("games")
      .select(
        "id,game_date,game_time,home_team_id,away_team_id,home_score,away_score,status,note,game_type,series_id",
      )
      .eq("season_id", seasonRow.id)
      .in("status", ["scheduled", "live", "final"])
      .order("game_date", { ascending: true }),
  ]);

  const teams: LiveTeam[] = teamsRes.data ?? [];
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  const games: LiveGame[] = (gamesRes.data ?? []).map((g) => ({
    id: g.id,
    date: g.game_date,
    time: g.game_time,
    homeTeamId: g.home_team_id,
    awayTeamId: g.away_team_id,
    homeTeam: teamNameById.get(g.home_team_id) ?? "TBD",
    awayTeam: teamNameById.get(g.away_team_id) ?? "TBD",
    homeScore: g.home_score,
    awayScore: g.away_score,
    status: g.status as GameStatus,
    note: g.note,
    gameType: (g.game_type as GameType) ?? "regular",
    seriesId: g.series_id,
  }));

  const gameIds = games.map((g) => g.id);
  const [statsRes, rostersRes] = await Promise.all([
    gameIds.length
      ? supabase.from("game_stats").select("game_id,player_id,team_id,goals,assists").in("game_id", gameIds)
      : Promise.resolve({ data: [] as { game_id: string; player_id: string; team_id: string; goals: number; assists: number }[] }),
    gameIds.length
      ? supabase.from("game_rosters").select("game_id,player_id,team_id").in("game_id", gameIds)
      : Promise.resolve({ data: [] as { game_id: string; player_id: string; team_id: string }[] }),
  ]);
  const gameStats = statsRes.data ?? [];
  const gameRosters = rostersRes.data ?? [];

  const playerIds = Array.from(new Set([...gameStats.map((s) => s.player_id), ...gameRosters.map((r) => r.player_id)]));
  const playersRes = playerIds.length
    ? await supabase.from("players").select("id,name,position").in("id", playerIds)
    : { data: [] as { id: string; name: string; position: string | null }[] };
  const players = playersRes.data ?? [];
  const playerNameById = new Map(players.map((p) => [p.id, p.name]));

  // --- Standings: FINAL, regular-season games only. Playoff games never
  // touch the standings — they appear on game pages and /playoffs instead. ---
  type TeamRecord = { gp: number; wins: number; losses: number; ties: number; gf: number; ga: number };
  const recordByTeam = new Map<string, TeamRecord>(
    teams.map((t) => [t.id, { gp: 0, wins: 0, losses: 0, ties: 0, gf: 0, ga: 0 }]),
  );

  for (const g of games) {
    if (g.gameType !== "regular" || g.status !== "final" || g.homeScore === null || g.awayScore === null) continue;
    const home = recordByTeam.get(g.homeTeamId);
    const away = recordByTeam.get(g.awayTeamId);
    if (!home || !away) continue;
    home.gp += 1;
    away.gp += 1;
    home.gf += g.homeScore;
    home.ga += g.awayScore;
    away.gf += g.awayScore;
    away.ga += g.homeScore;
    if (g.homeScore > g.awayScore) {
      home.wins += 1;
      away.losses += 1;
    } else if (g.awayScore > g.homeScore) {
      away.wins += 1;
      home.losses += 1;
    } else {
      home.ties += 1;
      away.ties += 1;
    }
  }

  const standings: TeamStanding[] = teams
    .map((t) => {
      const r = recordByTeam.get(t.id)!;
      const points = r.wins * 2 + r.ties;
      const pct = r.gp > 0 ? (points / (2 * r.gp)).toFixed(3).replace(/^0/, "") : ".000";
      return {
        team: t.name,
        gp: r.gp,
        wins: r.wins,
        losses: r.losses,
        ties: r.ties,
        points,
        pct,
        goalsFor: r.gf,
        goalsAgainst: r.ga,
        diff: r.gf - r.ga,
      };
    })
    .sort((a, b) => b.points - a.points || b.diff - a.diff || b.goalsFor - a.goalsFor);

  // Only finished, regular-season games count toward GP and scoring totals —
  // playoff and live-in-progress stat lines show up on the game page, not league stats.
  const gameDateById = new Map(games.map((g) => [g.id, g.date]));
  const finalGameIds = new Set(
    games.filter((g) => g.status === "final" && g.gameType === "regular").map((g) => g.id),
  );
  const skaterAgg = aggregateSkaterStats(finalGameIds, gameDateById, gameStats, gameRosters);

  const skaters: SkaterStat[] = Array.from(skaterAgg.entries())
    .map(([playerId, agg]) => ({
      playerId,
      player: playerNameById.get(playerId) ?? "Unknown",
      team: teamNameById.get(agg.teamId) ?? "Unknown",
      gamesPlayed: agg.gamesPlayed,
      goals: agg.goals,
      assists: agg.assists,
      points: agg.goals + agg.assists,
    }))
    .sort((a, b) => b.points - a.points || b.goals - a.goals);

  // --- Goalies: same FINAL regular-season game set as skaters. ---
  const finalGamesForGoalies: GoalieGameInput[] = games
    .filter((g) => finalGameIds.has(g.id) && g.homeScore !== null && g.awayScore !== null)
    .map((g) => ({
      id: g.id,
      date: g.date,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      homeScore: g.homeScore as number,
      awayScore: g.awayScore as number,
    }));
  const goalies = computeGoalieStats(finalGamesForGoalies, gameRosters, gameStats, players, teams);

  // --- Rosters via draft_picks, for teams in this season. ---
  const rosters: Record<string, LiveRosterPlayer[]> = {};
  for (const t of teams) rosters[t.name] = [];
  const teamIds = teams.map((t) => t.id);
  if (teamIds.length) {
    const picksRes = await supabase.from("draft_picks").select("team_id,player_id").in("team_id", teamIds);
    const picks = picksRes.data ?? [];
    const rosterPlayerIds = Array.from(new Set(picks.map((p) => p.player_id)));
    const rosterPlayersRes = rosterPlayerIds.length
      ? await supabase.from("players").select("id,name,position,rank").in("id", rosterPlayerIds)
      : { data: [] as { id: string; name: string; position: string | null; rank: number | null }[] };
    const rosterPlayerById = new Map((rosterPlayersRes.data ?? []).map((p) => [p.id, p]));
    for (const pick of picks) {
      const teamName = teamNameById.get(pick.team_id);
      const player = rosterPlayerById.get(pick.player_id);
      if (!teamName || !player) continue;
      rosters[teamName].push({ id: player.id, name: player.name, position: player.position, rank: player.rank });
    }
    for (const name of Object.keys(rosters)) rosters[name].sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    id: seasonRow.id,
    label: seasonRow.label,
    status: seasonRow.status as SeasonStatus,
    standings,
    skaters,
    goalies,
    games,
    teams,
    rosters,
  };
});

/**
 * Thin wrapper over getSeasonLive: the active season only, or null if none is
 * active. Existing consumers (schedule, scorekeeper) rely on this "active
 * only, no fallback" semantics — don't change it here.
 */
export const getActiveSeasonLive = cache(async (): Promise<LiveSeason | null> => {
  const supabase = createBrowserClient();

  const { data: seasonRow } = await supabase
    .from("seasons")
    .select("id")
    .eq("status", "active")
    .maybeSingle();

  if (!seasonRow) return null;

  return getSeasonLive(seasonRow.id);
});

/**
 * Merged season list for the stats-page switcher: every DB season (any
 * status, newest first by created_at — active pinned to the front if one
 * exists), followed by the static archived entries. The static "2026-27"
 * placeholder is always skipped, and any static id that collides with a DB
 * season id is skipped too — the DB season wins.
 */
export const getSeasonCatalogue = cache(async (): Promise<SeasonSummary[]> => {
  const supabase = createBrowserClient();

  const { data } = await supabase
    .from("seasons")
    .select("id,label,status,created_at")
    .order("created_at", { ascending: false });
  const dbSeasons = data ?? [];

  const active = dbSeasons.filter((s) => s.status === "active");
  const rest = dbSeasons.filter((s) => s.status !== "active");
  const orderedDb = [...active, ...rest]; // active pinned first; rest already newest-first from the query
  const dbIds = new Set(orderedDb.map((s) => s.id));

  const dbEntries: SeasonSummary[] = orderedDb.map((s) => ({
    id: s.id,
    label: s.label,
    status: s.status as SeasonStatus,
    live: true,
  }));

  const staticEntries: SeasonSummary[] = staticSeasons
    .filter((s) => s.id !== "2026-27" && !dbIds.has(s.id))
    .map((s) => ({ id: s.id, label: s.label, status: s.status, live: false }));

  return [...dbEntries, ...staticEntries];
});

// --- Game page ---

export type GameStatLine = { playerId: string; playerName: string; goals: number; assists: number };

export type GoalEventLine = {
  id: string;
  teamId: string;
  teamName: string;
  scorerName: string | null;
  assistName: string | null;
  createdAt: string;
};

export type SeriesRef = { id: string; round: number; name: string };

export type LineupPlayer = { playerId: string; playerName: string };

export type GameDetail = {
  id: string;
  date: string;
  time: string | null;
  status: GameStatus;
  gameType: GameType;
  note: string | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  series: SeriesRef | null;
  homeScorers: GameStatLine[];
  awayScorers: GameStatLine[];
  goalEvents: GoalEventLine[];
  lineups: { home: LineupPlayer[]; away: LineupPlayer[] };
};

/** Fetches a single game with its box score, live goal feed, lineups, and series (if any). Public/anon read. */
export const getGameDetail = cache(async (id: string): Promise<GameDetail | null> => {
  const supabase = createBrowserClient();

  const { data: game } = await supabase
    .from("games")
    .select("id,game_date,game_time,home_team_id,away_team_id,home_score,away_score,status,note,game_type,series_id")
    .eq("id", id)
    .maybeSingle();

  if (!game) return null;

  const teamIds = [game.home_team_id, game.away_team_id];
  const [teamsRes, statsRes, goalsRes, rostersRes, seriesRes] = await Promise.all([
    supabase.from("teams").select("id,name").in("id", teamIds),
    supabase.from("game_stats").select("player_id,team_id,goals,assists").eq("game_id", id),
    supabase
      .from("goal_events")
      .select("id,team_id,scorer_id,assist_id,created_at")
      .eq("game_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("game_rosters").select("player_id,team_id").eq("game_id", id),
    game.series_id
      ? supabase.from("playoff_series").select("id,round,name").eq("id", game.series_id).maybeSingle()
      : Promise.resolve({ data: null as { id: string; round: number; name: string } | null }),
  ]);

  const teamNameById = new Map((teamsRes.data ?? []).map((t) => [t.id, t.name]));
  const homeTeam = teamNameById.get(game.home_team_id) ?? "TBD";
  const awayTeam = teamNameById.get(game.away_team_id) ?? "TBD";

  const statRows = statsRes.data ?? [];
  const goalRows = goalsRes.data ?? [];
  const rosterRows = rostersRes.data ?? [];

  const playerIds = Array.from(
    new Set([
      ...statRows.map((s) => s.player_id),
      ...goalRows.map((g) => g.scorer_id).filter((v): v is string => Boolean(v)),
      ...goalRows.map((g) => g.assist_id).filter((v): v is string => Boolean(v)),
      ...rosterRows.map((r) => r.player_id),
    ]),
  );
  const playersRes = playerIds.length
    ? await supabase.from("players").select("id,name").in("id", playerIds)
    : { data: [] as { id: string; name: string }[] };
  const playerNameById = new Map((playersRes.data ?? []).map((p) => [p.id, p.name]));

  const toLine = (s: { player_id: string; goals: number; assists: number }): GameStatLine => ({
    playerId: s.player_id,
    playerName: playerNameById.get(s.player_id) ?? "Unknown",
    goals: s.goals,
    assists: s.assists,
  });

  const sortScorers = (rows: GameStatLine[]) =>
    [...rows].sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.playerName.localeCompare(b.playerName));

  const homeScorers = sortScorers(statRows.filter((s) => s.team_id === game.home_team_id).map(toLine));
  const awayScorers = sortScorers(statRows.filter((s) => s.team_id === game.away_team_id).map(toLine));

  const goalEvents: GoalEventLine[] = goalRows.map((g) => ({
    id: g.id,
    teamId: g.team_id,
    teamName: teamNameById.get(g.team_id) ?? "Unknown",
    scorerName: g.scorer_id ? (playerNameById.get(g.scorer_id) ?? "Unknown") : null,
    assistName: g.assist_id ? (playerNameById.get(g.assist_id) ?? "Unknown") : null,
    createdAt: g.created_at,
  }));

  const toLineupPlayer = (r: { player_id: string }): LineupPlayer => ({
    playerId: r.player_id,
    playerName: playerNameById.get(r.player_id) ?? "Unknown",
  });
  const sortLineup = (rows: LineupPlayer[]) => [...rows].sort((a, b) => a.playerName.localeCompare(b.playerName));
  const lineups = {
    home: sortLineup(rosterRows.filter((r) => r.team_id === game.home_team_id).map(toLineupPlayer)),
    away: sortLineup(rosterRows.filter((r) => r.team_id === game.away_team_id).map(toLineupPlayer)),
  };

  const seriesData = seriesRes.data;

  return {
    id: game.id,
    date: game.game_date,
    time: game.game_time,
    status: game.status as GameStatus,
    gameType: (game.game_type as GameType) ?? "regular",
    note: game.note,
    homeTeamId: game.home_team_id,
    awayTeamId: game.away_team_id,
    homeTeam,
    awayTeam,
    homeScore: game.home_score,
    awayScore: game.away_score,
    series: seriesData ? { id: seriesData.id, round: seriesData.round, name: seriesData.name } : null,
    homeScorers,
    awayScorers,
    goalEvents,
    lineups,
  };
});

// --- Playoffs bracket ---

export type PlayoffGameChip = {
  id: string;
  date: string;
  status: GameStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamId: string;
  awayTeamId: string;
};

export type PlayoffSeriesView = {
  id: string;
  round: number;
  name: string;
  position: number;
  bestOf: number;
  teamAId: string | null;
  teamBId: string | null;
  teamAName: string | null;
  teamBName: string | null;
  winnerTeamId: string | null;
  winnerTeamName: string | null;
  teamAWins: number;
  teamBWins: number;
  games: PlayoffGameChip[];
};

export type PlayoffBracket = {
  seasonId: string;
  seasonLabel: string;
  rounds: { round: number; name: string; series: PlayoffSeriesView[] }[];
  champion: { seriesId: string; teamId: string; teamName: string } | null;
};

/** Fetches the active season's playoff bracket: series grouped by round, with linked games. Public/anon read. */
export const getPlayoffBracket = cache(async (): Promise<PlayoffBracket | null> => {
  const supabase = createBrowserClient();

  const { data: seasonRow } = await supabase
    .from("seasons")
    .select("id,label,status")
    .eq("status", "active")
    .maybeSingle();

  if (!seasonRow) return null;

  const { data: seriesRows } = await supabase
    .from("playoff_series")
    .select("id,season_id,round,name,position,team_a,team_b,best_of,winner_team_id")
    .eq("season_id", seasonRow.id)
    .order("round", { ascending: true })
    .order("position", { ascending: true });

  const series = seriesRows ?? [];
  if (series.length === 0) {
    return { seasonId: seasonRow.id, seasonLabel: seasonRow.label, rounds: [], champion: null };
  }

  const seriesIds = series.map((s) => s.id);
  const teamIds = Array.from(
    new Set(series.flatMap((s) => [s.team_a, s.team_b, s.winner_team_id]).filter((v): v is string => Boolean(v))),
  );

  const [teamsRes, gamesRes] = await Promise.all([
    teamIds.length
      ? supabase.from("teams").select("id,name").in("id", teamIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase
      .from("games")
      .select("id,game_date,status,home_score,away_score,home_team_id,away_team_id,series_id")
      .in("series_id", seriesIds),
  ]);

  const teamNameById = new Map((teamsRes.data ?? []).map((t) => [t.id, t.name]));

  type SeriesGameRow = {
    id: string;
    game_date: string;
    status: string;
    home_score: number | null;
    away_score: number | null;
    home_team_id: string;
    away_team_id: string;
    series_id: string | null;
  };

  const gamesBySeries = new Map<string, SeriesGameRow[]>();
  for (const g of (gamesRes.data ?? []) as SeriesGameRow[]) {
    if (!g.series_id) continue;
    const list = gamesBySeries.get(g.series_id) ?? [];
    list.push(g);
    gamesBySeries.set(g.series_id, list);
  }

  const seriesViews: PlayoffSeriesView[] = series.map((s) => {
    const games = (gamesBySeries.get(s.id) ?? []).sort((a, b) => (a.game_date < b.game_date ? -1 : 1));
    let teamAWins = 0;
    let teamBWins = 0;
    for (const g of games) {
      if (g.status !== "final" || g.home_score === null || g.away_score === null) continue;
      const winnerTeamId =
        g.home_score > g.away_score ? g.home_team_id : g.away_score > g.home_score ? g.away_team_id : null;
      if (!winnerTeamId) continue;
      if (winnerTeamId === s.team_a) teamAWins += 1;
      else if (winnerTeamId === s.team_b) teamBWins += 1;
    }
    return {
      id: s.id,
      round: s.round,
      name: s.name,
      position: s.position,
      bestOf: s.best_of,
      teamAId: s.team_a,
      teamBId: s.team_b,
      teamAName: s.team_a ? (teamNameById.get(s.team_a) ?? "TBD") : null,
      teamBName: s.team_b ? (teamNameById.get(s.team_b) ?? "TBD") : null,
      winnerTeamId: s.winner_team_id,
      winnerTeamName: s.winner_team_id ? (teamNameById.get(s.winner_team_id) ?? null) : null,
      teamAWins,
      teamBWins,
      games: games.map((g) => ({
        id: g.id,
        date: g.game_date,
        status: g.status as GameStatus,
        homeScore: g.home_score,
        awayScore: g.away_score,
        homeTeamId: g.home_team_id,
        awayTeamId: g.away_team_id,
      })),
    };
  });

  const roundsMap = new Map<number, { round: number; name: string; series: PlayoffSeriesView[] }>();
  for (const sv of seriesViews) {
    const bucket = roundsMap.get(sv.round) ?? { round: sv.round, name: sv.name, series: [] };
    bucket.series.push(sv);
    roundsMap.set(sv.round, bucket);
  }
  const rounds = Array.from(roundsMap.values()).sort((a, b) => a.round - b.round);
  for (const r of rounds) r.series.sort((a, b) => a.position - b.position);

  const maxRound = Math.max(...series.map((s) => s.round));
  const finalRoundSeries = seriesViews.filter((s) => s.round === maxRound);
  const championSeries = finalRoundSeries.find((s) => s.winnerTeamId);
  const champion =
    championSeries && championSeries.winnerTeamId
      ? { seriesId: championSeries.id, teamId: championSeries.winnerTeamId, teamName: championSeries.winnerTeamName ?? "TBD" }
      : null;

  return { seasonId: seasonRow.id, seasonLabel: seasonRow.label, rounds, champion };
});
