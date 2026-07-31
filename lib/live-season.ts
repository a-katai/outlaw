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

export type LiveSeason = {
  id: string;
  label: string;
  status: SeasonStatus;
  standings: TeamStanding[];
  skaters: SkaterStat[];
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

/**
 * Fetches the active season (status = 'active') with computed standings and
 * skater stats, plus its teams/rosters for the pre-season roster-card view.
 * Anon client is fine — every table involved is public-read.
 */
export const getActiveSeasonLive = cache(async (): Promise<LiveSeason | null> => {
  const supabase = createBrowserClient();

  const { data: seasonRow } = await supabase
    .from("seasons")
    .select("id,label,status")
    .eq("status", "active")
    .maybeSingle();

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
    ? await supabase.from("players").select("id,name").in("id", playerIds)
    : { data: [] as { id: string; name: string }[] };
  const playerNameById = new Map((playersRes.data ?? []).map((p) => [p.id, p.name]));

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

  // --- Skater stats: GP = union of game_stats appearances and game_rosters
  // check-ins for FINAL regular-season games — a dressed player gets GP
  // credit even if they never touched the scoresheet. G/A are still summed
  // purely from game_stats. "Team" = most recent (by game date) appearance
  // across either source. ---
  const gameDateById = new Map(games.map((g) => [g.id, g.date]));
  // Only finished, regular-season games count toward GP and scoring totals —
  // playoff and live-in-progress stat lines show up on the game page, not league stats.
  const finalGameIds = new Set(
    games.filter((g) => g.status === "final" && g.gameType === "regular").map((g) => g.id),
  );
  const finalStats = gameStats.filter((s) => finalGameIds.has(s.game_id));
  const finalRosters = gameRosters.filter((r) => finalGameIds.has(r.game_id));

  type Appearance = { playerId: string; gameId: string; teamId: string };
  const appearances: Appearance[] = [
    ...finalStats.map((s) => ({ playerId: s.player_id, gameId: s.game_id, teamId: s.team_id })),
    ...finalRosters.map((r) => ({ playerId: r.player_id, gameId: r.game_id, teamId: r.team_id })),
  ];
  const appearancesByDateAsc = [...appearances].sort((a, b) => {
    const da = gameDateById.get(a.gameId) ?? "";
    const db = gameDateById.get(b.gameId) ?? "";
    return da < db ? -1 : da > db ? 1 : 0;
  });

  type SkaterAgg = { gpGames: Set<string>; goals: number; assists: number; teamId: string };
  const aggByPlayer = new Map<string, SkaterAgg>();
  for (const a of appearancesByDateAsc) {
    const existing = aggByPlayer.get(a.playerId) ?? { gpGames: new Set<string>(), goals: 0, assists: 0, teamId: a.teamId };
    existing.gpGames.add(a.gameId); // Set — union, no double-count when both sources hit the same game.
    existing.teamId = a.teamId; // last write (ascending by date) = most recent
    aggByPlayer.set(a.playerId, existing);
  }
  // Goals/assists are additive from game_stats only — every player here is
  // already present in aggByPlayer via the appearances merge above.
  for (const s of finalStats) {
    const existing = aggByPlayer.get(s.player_id);
    if (!existing) continue;
    existing.goals += s.goals;
    existing.assists += s.assists;
  }

  const skaters: SkaterStat[] = Array.from(aggByPlayer.entries())
    .map(([playerId, agg]) => ({
      player: playerNameById.get(playerId) ?? "Unknown",
      team: teamNameById.get(agg.teamId) ?? "Unknown",
      gamesPlayed: agg.gpGames.size,
      goals: agg.goals,
      assists: agg.assists,
      points: agg.goals + agg.assists,
    }))
    .sort((a, b) => b.points - a.points || b.goals - a.goals);

  // --- Rosters via draft_picks, for teams in this season. ---
  const rosters: Record<string, LiveRosterPlayer[]> = {};
  for (const t of teams) rosters[t.name] = [];
  const teamIds = teams.map((t) => t.id);
  if (teamIds.length) {
    const picksRes = await supabase.from("draft_picks").select("team_id,player_id").in("team_id", teamIds);
    const picks = picksRes.data ?? [];
    const rosterPlayerIds = Array.from(new Set(picks.map((p) => p.player_id)));
    const rosterPlayersRes = rosterPlayerIds.length
      ? await supabase.from("players").select("id,name,position").in("id", rosterPlayerIds)
      : { data: [] as { id: string; name: string; position: string | null }[] };
    const rosterPlayerById = new Map((rosterPlayersRes.data ?? []).map((p) => [p.id, p]));
    for (const pick of picks) {
      const teamName = teamNameById.get(pick.team_id);
      const player = rosterPlayerById.get(pick.player_id);
      if (!teamName || !player) continue;
      rosters[teamName].push({ id: player.id, name: player.name, position: player.position });
    }
    for (const name of Object.keys(rosters)) rosters[name].sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    id: seasonRow.id,
    label: seasonRow.label,
    status: seasonRow.status as SeasonStatus,
    standings,
    skaters,
    games,
    teams,
    rosters,
  };
});

/**
 * Merged season list for the stats-page switcher: the live active season
 * first, then static archived seasons. The static "2026-27" placeholder is
 * always skipped — the live season (whatever its id) replaces it.
 */
export const getSeasonCatalogue = cache(async (): Promise<SeasonSummary[]> => {
  const live = await getActiveSeasonLive();

  const staticEntries: SeasonSummary[] = staticSeasons
    .filter((s) => s.id !== "2026-27")
    .map((s) => ({ id: s.id, label: s.label, status: s.status, live: false }));

  const liveEntry: SeasonSummary[] = live
    ? [{ id: live.id, label: live.label, status: live.status, live: true }]
    : [];

  return [...liveEntry, ...staticEntries];
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
