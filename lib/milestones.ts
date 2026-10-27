import { createBrowserClient } from "./supabase";
import { getArchiveSkaterLine } from "./league-data";
import { timeSortKey } from "@/app/components/next-game-card";

export type MilestoneKind = "hat_trick" | "first_goal" | "points" | "streak";

export type Milestone = {
  kind: MilestoneKind;
  playerId: string;
  playerName: string;
  team: string;
  /** Short headline, e.g. "Hat trick" or "50 career points". */
  label: string;
  /** Supporting line, e.g. "3 G vs Ghost Pirates"-style context; always plain text. */
  detail: string;
};

export const POINT_THRESHOLDS = [25, 50, 75, 100, 150, 200];
export const MIN_STREAK = 3;

type GameRow = { id: string; game_date: string; game_time: string | null; home_team_id: string; away_team_id: string };
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
 * stored state. Career = the 2025–26 archive totals (when the name matches)
 * plus every DB final before that night. The archive has no per-game data, so
 * it feeds threshold/first-goal totals only; streaks use DB games and count
 * only nights the player dressed (game_rosters or a game_stats row), so byes
 * and absences neither break nor extend one. Goalies are excluded.
 */
export async function getMilestonesForWeek(weekDate: string): Promise<Milestone[]> {
  const supabase = createBrowserClient();

  const games = await loadAll<GameRow>((f, t) =>
    supabase
      .from("games")
      .select("id,game_date,game_time,home_team_id,away_team_id")
      .eq("status", "final")
      .lte("game_date", weekDate)
      .order("game_date", { ascending: true })
      .order("id", { ascending: true })
      .range(f, t),
  );
  const weekGames = games.filter((g) => g.game_date === weekDate);
  if (!weekGames.length) return [];

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

    const archive = getArchiveSkaterLine(p.name);
    const goalsBefore = (archive?.goals ?? 0) + prior.reduce((n, d) => n + d.goals, 0);
    const pointsBefore = (archive?.points ?? 0) + prior.reduce((n, d) => n + d.goals + d.assists, 0);
    const weekGoals = week.reduce((n, d) => n + d.goals, 0);
    const weekPoints = week.reduce((n, d) => n + d.goals + d.assists, 0);

    // Hat tricks: 3+ goals in a single game.
    for (const d of week) {
      if (d.goals >= 3) {
        out.push({ ...base, kind: "hat_trick", label: d.goals === 3 ? "Hat trick" : `${d.goals}-goal game`, detail: `${d.goals} G` });
      }
    }

    // First career goal on record (archive + DB).
    if (goalsBefore === 0 && weekGoals > 0) {
      out.push({ ...base, kind: "first_goal", label: "First career goal", detail: weekGoals > 1 ? `${weekGoals} G on the night` : "1 G" });
    }

    // Career points: report the highest threshold crossed this night.
    const crossed = POINT_THRESHOLDS.filter((t) => pointsBefore < t && pointsBefore + weekPoints >= t);
    if (crossed.length) {
      const t = crossed[crossed.length - 1];
      out.push({ ...base, kind: "points", label: `${t} career points`, detail: `${pointsBefore + weekPoints} P` });
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
