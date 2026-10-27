import { createBrowserClient } from "./supabase";
import { timeSortKey } from "@/app/components/next-game-card";

export type MilestoneKind = "hat_trick" | "first_goal" | "points" | "streak";

export type Milestone = {
  kind: MilestoneKind;
  playerId: string;
  playerName: string;
  team: string;
  /** Short headline, e.g. "Hat trick" or "25 points". */
  label: string;
  /** Supporting line, e.g. "3 G vs Ghost Pirates"-style context; always plain text. */
  detail: string;
};

export const POINT_THRESHOLDS = [10, 25, 50, 75, 100];
export const MIN_STREAK = 3;

type GameRow = { id: string; season_id: string; game_date: string; game_time: string | null; home_team_id: string; away_team_id: string };
type StatRow = { game_id: string; player_id: string; team_id: string; goals: number; assists: number };
type RosterRow = { game_id: string; player_id: string; team_id: string };

const PAGE = 1000;

/** Pages through a table so a long season never silently truncates at PostgREST's default row cap. */
async function loadAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/**
 * Milestones earned on one game night, computed from final games only — no
 * stored state. This season only — no career or archive totals. Streaks count
 * only nights the player dressed (game_rosters or a game_stats row), so byes
 * and absences neither break nor extend one. Goalies are excluded.
 */
export async function getMilestonesForWeek(weekDate: string): Promise<Milestone[]> {
  const supabase = createBrowserClient();

  let games = await loadAll<GameRow>((f, t) =>
    supabase
      .from("games")
      .select("id,season_id,game_date,game_time,home_team_id,away_team_id")
      .eq("status", "final")
      .lte("game_date", weekDate)
      .order("game_date", { ascending: true })
      .order("id", { ascending: true })
      .range(f, t),
  );
  const weekGames = games.filter((g) => g.game_date === weekDate);
  if (!weekGames.length) return [];
  const seasonId = weekGames[0].season_id;
  games = games.filter((g) => g.season_id === seasonId);

  const gameById = new Map(games.map((g) => [g.id, g]));
  const [stats, rosters] = await Promise.all([
    loadAll<StatRow>((f, t) =>
      supabase.from("game_stats").select("game_id,player_id,team_id,goals,assists").order("game_id").order("player_id").range(f, t),
    ),
    loadAll<RosterRow>((f, t) =>
      supabase.from("game_rosters").select("game_id,player_id,team_id").order("game_id").order("player_id").range(f, t),
    ),
  ]);

  // Per player: dressed games (union of roster + stat appearances), keyed by game id.
  type Dressed = { gameId: string; teamId: string; goals: number; assists: number };
  const byPlayer = new Map<string, Map<string, Dressed>>();
  const touch = (playerId: string, gameId: string, teamId: string): Dressed | null => {
    if (!gameById.has(gameId)) return null; // not final / after this night
    let m = byPlayer.get(playerId);
    if (!m) byPlayer.set(playerId, (m = new Map()));
    let d = m.get(gameId);
    if (!d) m.set(gameId, (d = { gameId, teamId, goals: 0, assists: 0 }));
    return d;
  };
  for (const r of rosters) touch(r.player_id, r.game_id, r.team_id);
  for (const s of stats) {
    const d = touch(s.player_id, s.game_id, s.team_id);
    if (d) {
      d.goals += s.goals;
      d.assists += s.assists;
    }
  }

  const weekGameIds = new Set(weekGames.map((g) => g.id));
  const candidateIds = Array.from(byPlayer.entries())
    .filter(([, m]) => Array.from(m.keys()).some((id) => weekGameIds.has(id)))
    .map(([id]) => id);
  if (!candidateIds.length) return [];

  const teamIds = Array.from(new Set(weekGames.flatMap((g) => [g.home_team_id, g.away_team_id])));
  const [playersRes, teamsRes] = await Promise.all([
    supabase.from("players").select("id,name,position").in("id", candidateIds),
    supabase.from("teams").select("id,name").in("id", teamIds),
  ]);
  const teamName = new Map((teamsRes.data ?? []).map((t) => [t.id, t.name]));

  const order = (id: string) => {
    const g = gameById.get(id)!;
    return [g.game_date, String(timeSortKey(g.game_time)).padStart(6, "0"), g.id].join("|");
  };

  const out: Milestone[] = [];
  for (const p of playersRes.data ?? []) {
    if (p.position === "G") continue;
    const dressed = Array.from(byPlayer.get(p.id)!.values()).sort((a, b) => (order(a.gameId) < order(b.gameId) ? -1 : 1));
    const week = dressed.filter((d) => weekGameIds.has(d.gameId));
    if (!week.length) continue;
    const prior = dressed.filter((d) => !weekGameIds.has(d.gameId));
    const team = teamName.get(week[week.length - 1].teamId) ?? "";
    const base = { playerId: p.id, playerName: p.name, team };

    const goalsBefore = prior.reduce((n, d) => n + d.goals, 0);
    const pointsBefore = prior.reduce((n, d) => n + d.goals + d.assists, 0);
    const weekGoals = week.reduce((n, d) => n + d.goals, 0);
    const weekPoints = week.reduce((n, d) => n + d.goals + d.assists, 0);

    // Hat tricks: 3+ goals in a single game.
    for (const d of week) {
      if (d.goals >= 3) {
        out.push({ ...base, kind: "hat_trick", label: d.goals === 3 ? "Hat trick" : `${d.goals}-goal game`, detail: `${d.goals} G` });
      }
    }

    // First goal of the season.
    if (goalsBefore === 0 && weekGoals > 0) {
      out.push({ ...base, kind: "first_goal", label: "First goal of the season", detail: weekGoals > 1 ? `${weekGoals} G on the night` : "1 G" });
    }

    // Season points: report the highest threshold crossed this night.
    const crossed = POINT_THRESHOLDS.filter((t) => pointsBefore < t && pointsBefore + weekPoints >= t);
    if (crossed.length) {
      const t = crossed[crossed.length - 1];
      out.push({ ...base, kind: "points", label: `${t} points`, detail: `${pointsBefore + weekPoints} P` });
    }

    // Active point streak through this night, over dressed games only.
    let streak = 0;
    for (let i = dressed.length - 1; i >= 0 && dressed[i].goals + dressed[i].assists > 0; i--) streak++;
    if (streak >= MIN_STREAK) {
      out.push({ ...base, kind: "streak", label: `${streak}-game point streak`, detail: `${streak} GP` });
    }
  }

  const rank: Record<MilestoneKind, number> = { hat_trick: 0, first_goal: 1, points: 2, streak: 3 };
  const size = (m: Milestone) => parseInt(m.label, 10) || 0;
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || size(b) - size(a) || a.playerName.localeCompare(b.playerName));
}

export type MilestoneCard = {
  playerId: string;
  playerName: string;
  team: string;
  /** Hero text, e.g. { big: "25", sub: "Points this season" } or { big: "Hat trick", sub: "" }. */
  hero: { big: string; sub: string };
  /** Remaining milestones that night, strongest first. */
  others: string[];
  /** The night's line, e.g. "1G 3A". */
  line: string;
  /** Opponent(s) that night, e.g. "Trashers". */
  opponent: string;
};

export const MIN_CARD_STREAK = 5;

const heroOf = (m: Milestone): { big: string; sub: string } => {
  const n = parseInt(m.label, 10);
  if (m.kind === "points") return { big: String(n), sub: "Points this season" };
  if (m.kind === "streak") return { big: String(n), sub: "Game point streak" };
  if (m.kind === "first_goal") return { big: "First", sub: "Goal of the season" };
  return n ? { big: String(n), sub: "Goal game" } : { big: "Hat trick", sub: "" };
};

/**
 * One card per player per night. Eligible: hat trick / N-goal game, first
 * goal of the season, or a season-points threshold; plus a streak only when it is the
 * night's longest and at least MIN_CARD_STREAK games. A player's strongest
 * milestone is the hero (N-goal game > points > first goal > streak).
 */
export async function getMilestoneCardsFor(milestones: Milestone[], date: string): Promise<MilestoneCard[]> {
  const longest = milestones.reduce((n, m) => (m.kind === "streak" ? Math.max(n, parseInt(m.label, 10)) : n), 0);
  const eligible = milestones.filter((m) => m.kind !== "streak" || (longest >= MIN_CARD_STREAK && parseInt(m.label, 10) === longest));
  if (!eligible.length) return [];

  const supabase = createBrowserClient();
  const { data: games } = await supabase.from("games").select("id,home_team_id,away_team_id").eq("game_date", date).eq("status", "final");
  const gameIds = (games ?? []).map((g) => g.id);
  const ids = Array.from(new Set(eligible.map((m) => m.playerId)));
  const [{ data: stats }, { data: teams }] = await Promise.all([
    supabase.from("game_stats").select("game_id,player_id,team_id,goals,assists").in("game_id", gameIds).in("player_id", ids),
    supabase.from("teams").select("id,name").in("id", Array.from(new Set((games ?? []).flatMap((g) => [g.home_team_id, g.away_team_id])))),
  ]);
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const gameById = new Map((games ?? []).map((g) => [g.id, g]));

  // Strength order for the hero: goals in a game, then points, first goal, streak.
  const strength = (m: Milestone) => {
    const n = parseInt(m.label, 10) || 0;
    return m.kind === "hat_trick" ? 1000 + n * 10 + (n ? 0 : 3) : m.kind === "points" ? 500 + n : m.kind === "first_goal" ? 400 : n;
  };

  return ids.map((id) => {
    const list = eligible.filter((m) => m.playerId === id).sort((a, b) => strength(b) - strength(a));
    const rows = (stats ?? []).filter((s) => s.player_id === id);
    const g = rows.reduce((n, s) => n + s.goals, 0);
    const a = rows.reduce((n, s) => n + s.assists, 0);
    const opp = Array.from(
      new Set(
        rows.map((s) => {
          const game = gameById.get(s.game_id);
          return teamName.get(game && game.home_team_id === s.team_id ? game.away_team_id : game?.home_team_id ?? "") ?? "";
        }),
      ),
    ).filter(Boolean);
    const [hero, ...rest] = list;
    return {
      playerId: id,
      playerName: hero.playerName,
      team: hero.team,
      hero: heroOf(hero),
      others: rest.map((m) => m.label),
      line: [g ? `${g}G` : "", a ? `${a}A` : ""].filter(Boolean).join(" ") || "0 P",
      opponent: opp.join(" / "),
    };
  });
}

export async function getMilestoneCards(date: string): Promise<MilestoneCard[]> {
  return getMilestoneCardsFor(await getMilestonesForWeek(date), date);
}
