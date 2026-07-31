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
  status: "scheduled" | "final";
  note: string | null;
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
      .select("id,game_date,game_time,home_team_id,away_team_id,home_score,away_score,status,note")
      .eq("season_id", seasonRow.id)
      .in("status", ["scheduled", "final"])
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
    status: g.status as "scheduled" | "final",
    note: g.note,
  }));

  const gameIds = games.map((g) => g.id);
  const statsRes = gameIds.length
    ? await supabase.from("game_stats").select("game_id,player_id,team_id,goals,assists").in("game_id", gameIds)
    : { data: [] as { game_id: string; player_id: string; team_id: string; goals: number; assists: number }[] };
  const gameStats = statsRes.data ?? [];

  const playerIds = Array.from(new Set(gameStats.map((s) => s.player_id)));
  const playersRes = playerIds.length
    ? await supabase.from("players").select("id,name").in("id", playerIds)
    : { data: [] as { id: string; name: string }[] };
  const playerNameById = new Map((playersRes.data ?? []).map((p) => [p.id, p.name]));

  // --- Standings: FINAL games only. ---
  type TeamRecord = { gp: number; wins: number; losses: number; ties: number; gf: number; ga: number };
  const recordByTeam = new Map<string, TeamRecord>(
    teams.map((t) => [t.id, { gp: 0, wins: 0, losses: 0, ties: 0, gf: 0, ga: 0 }]),
  );

  for (const g of games) {
    if (g.status !== "final" || g.homeScore === null || g.awayScore === null) continue;
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

  // --- Skater stats: aggregate game_stats per player. "Team" = most recent
  // (by game date) team_id on their rows. ---
  const gameDateById = new Map(games.map((g) => [g.id, g.date]));
  // Only finished games count toward GP and scoring totals.
  const finalGameIds = new Set(games.filter((g) => g.status === "final").map((g) => g.id));
  const finalStats = gameStats.filter((s) => finalGameIds.has(s.game_id));
  const statsByDateAsc = [...finalStats].sort((a, b) => {
    const da = gameDateById.get(a.game_id) ?? "";
    const db = gameDateById.get(b.game_id) ?? "";
    return da < db ? -1 : da > db ? 1 : 0;
  });

  type SkaterAgg = { gp: number; goals: number; assists: number; teamId: string };
  const aggByPlayer = new Map<string, SkaterAgg>();
  for (const s of statsByDateAsc) {
    const existing = aggByPlayer.get(s.player_id) ?? { gp: 0, goals: 0, assists: 0, teamId: s.team_id };
    existing.gp += 1;
    existing.goals += s.goals;
    existing.assists += s.assists;
    existing.teamId = s.team_id; // last write (ascending by date) = most recent
    aggByPlayer.set(s.player_id, existing);
  }

  const skaters: SkaterStat[] = Array.from(aggByPlayer.entries())
    .map(([playerId, agg]) => ({
      player: playerNameById.get(playerId) ?? "Unknown",
      team: teamNameById.get(agg.teamId) ?? "Unknown",
      gamesPlayed: agg.gp,
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
