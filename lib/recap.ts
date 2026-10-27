import { createBrowserClient } from "./supabase";
import { getStarsForGames, type Star } from "./three-stars";
import { getMilestonesForWeek, type Milestone } from "./milestones";
import { lineScoreFromGoals, type LineScore } from "@/app/components/final-scoreboard";
import { splitTimeRink, timeSortKey } from "@/app/components/next-game-card";

export type RecapGame = {
  id: string;
  time: string | null;
  rink: string | null;
  awayTeam: string;
  homeTeam: string;
  awayScore: number;
  homeScore: number;
  lineScore: LineScore | null;
  stars: Star[];
};

export type Recap = {
  date: string; // YYYY-MM-DD
  weekNumber: number | null; // index of this night in the season schedule (1-based)
  playoffs: boolean;
  games: RecapGame[];
  milestones: Milestone[];
};

export const isRecapDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Every game_date that has at least one final game, newest first. */
export async function getRecapDates(): Promise<string[]> {
  const supabase = createBrowserClient();
  const dates = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("games")
      .select("game_date")
      .eq("status", "final")
      .order("game_date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + 999);
    const rows = data ?? [];
    for (const r of rows) dates.add(r.game_date);
    if (rows.length < 1000) break;
  }
  return Array.from(dates).sort().reverse();
}

/** The full Wednesday Report for one game night, or null when that date has no final games. */
export async function getRecap(date: string): Promise<Recap | null> {
  if (!isRecapDate(date)) return null;
  const supabase = createBrowserClient();

  const { data: rows } = await supabase
    .from("games")
    .select("id,season_id,game_time,game_type,home_team_id,away_team_id,home_score,away_score")
    .eq("game_date", date)
    .eq("status", "final");
  const finals = (rows ?? []).filter((g) => g.home_score !== null && g.away_score !== null);
  if (!finals.length) return null;
  finals.sort((a, b) => timeSortKey(a.game_time) - timeSortKey(b.game_time));

  const gameIds = finals.map((g) => g.id);
  const teamIds = Array.from(new Set(finals.flatMap((g) => [g.home_team_id, g.away_team_id])));
  const seasonId = finals[0].season_id;
  const playoffs = finals.every((g) => g.game_type === "playoff");

  const [teamsRes, goalsRes, starsByGame, scheduleRes, milestones] = await Promise.all([
    supabase.from("teams").select("id,name").in("id", teamIds),
    supabase.from("goal_events").select("game_id,team_id,period").in("game_id", gameIds),
    getStarsForGames(gameIds),
    supabase.from("games").select("game_date").eq("season_id", seasonId).eq("game_type", "regular").limit(2000),
    getMilestonesForWeek(date),
  ]);
  const teamName = new Map((teamsRes.data ?? []).map((t) => [t.id, t.name]));

  const nights = Array.from(new Set((scheduleRes.data ?? []).map((g) => g.game_date))).sort();
  const idx = nights.indexOf(date);

  const games: RecapGame[] = finals.map((g) => {
    const goals = (goalsRes.data ?? [])
      .filter((e) => e.game_id === g.id)
      .map((e) => ({ teamId: e.team_id as string, period: (e.period ?? null) as number | null }));
    const { rink } = splitTimeRink(g.game_time);
    return {
      id: g.id,
      time: splitTimeRink(g.game_time).time,
      rink,
      awayTeam: teamName.get(g.away_team_id) ?? "TBD",
      homeTeam: teamName.get(g.home_team_id) ?? "TBD",
      awayScore: g.away_score as number,
      homeScore: g.home_score as number,
      lineScore: lineScoreFromGoals(goals, g.home_team_id),
      stars: starsByGame.get(g.id) ?? [],
    };
  });

  return { date, weekNumber: playoffs || idx < 0 ? null : idx + 1, playoffs, games, milestones };
}

/** "Oct 21" for a YYYY-MM-DD string. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** "Week 7" / "Playoffs" / "" kicker word for a recap. */
export function weekLabel(r: Pick<Recap, "weekNumber" | "playoffs">): string {
  return r.playoffs ? "Playoffs" : r.weekNumber ? `Week ${r.weekNumber}` : "";
}
