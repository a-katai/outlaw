import { splitTimeRink } from "@/app/components/next-game-card";

// Shared by /pickem (server + client) and /api/pickem. Pure: no env, no DB.

export type PickChoice = "home" | "away" | "tie";

export const PICK_CHOICES: PickChoice[] = ["home", "away", "tie"];

export function isPickChoice(value: unknown): value is PickChoice {
  return value === "home" || value === "away" || value === "tie";
}

export const PICKEM_TZ = "America/Detroit";

/** Minutes the zone is ahead of UTC at the given instant (EDT = -240, EST = -300). */
function zoneOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PICKEM_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/**
 * Puck drop as an instant. `gameDate` is games.game_date ("2026-10-28"),
 * `gameTime` is games.game_time ("10:00 PM · Rink B") — wall-clock time in
 * America/Detroit. Returns null when the time can't be read; callers treat
 * that as locked (fail closed).
 */
export function gameLockAt(gameDate: string, gameTime: string | null): Date | null {
  const { time } = splitTimeRink(gameTime);
  const match = time?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const date = gameDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match || !date) return null;
  const hour12 = Number(match[1]);
  const minute = Number(match[2]);
  if (hour12 < 1 || hour12 > 12 || minute > 59) return null;
  const hour = (hour12 % 12) + (/PM/i.test(match[3]) ? 12 : 0);
  const wall = Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3]), hour, minute);
  // Wall time -> instant: guess with the offset at the naive instant, then
  // re-check the offset at the result (handles the DST boundary).
  const first = wall - zoneOffsetMinutes(new Date(wall)) * 60000;
  const second = wall - zoneOffsetMinutes(new Date(first)) * 60000;
  return new Date(second);
}

export function isLocked(gameDate: string, gameTime: string | null, now: Date = new Date()): boolean {
  const lock = gameLockAt(gameDate, gameTime);
  return !lock || now.getTime() >= lock.getTime();
}

/** What actually happened, from a final score. */
export function resultOf(homeScore: number, awayScore: number): PickChoice {
  return homeScore > awayScore ? "home" : awayScore > homeScore ? "away" : "tie";
}

export function detroitDateISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PICKEM_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type LeaderRow = {
  pickerId: string;
  name: string;
  correct: number;
  total: number;
  joinedAt: string;
  rank: number;
};

/** Most correct, then earliest join. 1 point per correct pick; only final games are passed in. */
export function rankPickers(
  pickers: { id: string; name: string; created_at: string }[],
  picks: { picker_id: string; game_id: string; pick: PickChoice }[],
  finals: Map<string, PickChoice>,
): LeaderRow[] {
  const tally = new Map<string, { correct: number; total: number }>();
  for (const p of picks) {
    const result = finals.get(p.game_id);
    if (!result) continue;
    const t = tally.get(p.picker_id) ?? { correct: 0, total: 0 };
    t.total += 1;
    if (p.pick === result) t.correct += 1;
    tally.set(p.picker_id, t);
  }
  return pickers
    .map((p) => ({
      pickerId: p.id,
      name: p.name,
      correct: tally.get(p.id)?.correct ?? 0,
      total: tally.get(p.id)?.total ?? 0,
      joinedAt: p.created_at,
    }))
    .sort((a, b) => b.correct - a.correct || (a.joinedAt < b.joinedAt ? -1 : a.joinedAt > b.joinedAt ? 1 : 0))
    .map((row, i) => ({ ...row, rank: i + 1 }));
}
