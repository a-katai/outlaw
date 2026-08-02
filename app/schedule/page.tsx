import type { Metadata } from "next";
import Link from "next/link";
import { getActiveSeasonLive, type LiveGame } from "@/lib/live-season";
import { getTeamColors } from "@/lib/league-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Schedule — Outlaw Hockey League",
  description: "Upcoming and completed games for the current Outlaw Hockey League season.",
};

function formatGameDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
}

/** "10:30 PM · Rink A" -> { time: "10:30 PM", rink: "Rink A" }. Tolerates a bare time with no rink. */
function splitTimeRink(raw: string | null): { time: string | null; rink: string | null } {
  if (!raw) return { time: null, rink: null };
  const [time, ...rest] = raw.split("·").map((part) => part.trim());
  return { time: time || null, rink: rest.length ? rest.join(" · ") : null };
}

/** Minutes-since-midnight from a "10:30 PM"-style string, for same-date ordering. Unparseable times sort last. */
function timeSortKey(raw: string | null): number {
  const match = raw?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return Infinity;
  let hour = Number(match[1]) % 12;
  if (/PM/i.test(match[3])) hour += 12;
  return hour * 60 + Number(match[2]);
}

function sortChronological(list: LiveGame[]): LiveGame[] {
  return [...list].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : timeSortKey(a.time) - timeSortKey(b.time)));
}

function sortMostRecentFirst(list: LiveGame[]): LiveGame[] {
  return [...list].sort((a, b) => (a.date !== b.date ? (a.date > b.date ? -1 : 1) : timeSortKey(a.time) - timeSortKey(b.time)));
}

type MonthGroup = { monthKey: string; monthLabel: string; dates: [string, LiveGame[]][] };

/** Groups an already date-ordered list into month buckets, each with its dates in the same order. */
function groupByMonth(list: LiveGame[]): MonthGroup[] {
  const months: MonthGroup[] = [];
  const monthIndex = new Map<string, MonthGroup>();
  const dateIndex = new Map<string, Map<string, LiveGame[]>>();

  for (const game of list) {
    const monthKey = game.date.slice(0, 7);
    let month = monthIndex.get(monthKey);
    if (!month) {
      month = { monthKey, monthLabel: monthLabel(game.date), dates: [] };
      monthIndex.set(monthKey, month);
      dateIndex.set(monthKey, new Map());
      months.push(month);
    }
    const datesForMonth = dateIndex.get(monthKey)!;
    const bucket = datesForMonth.get(game.date);
    if (bucket) {
      bucket.push(game);
    } else {
      const fresh = [game];
      datesForMonth.set(game.date, fresh);
      month.dates.push([game.date, fresh]);
    }
  }

  return months;
}

function TeamDot({ name }: { name: string }) {
  const colors = getTeamColors(name);
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colors.border }} aria-hidden />;
}

function PlayoffBadge() {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
      Playoff
    </span>
  );
}

/** W-L-T for a team, or null if the league hasn't started keeping score yet. */
function recordFor(name: string, recordsByTeam: Map<string, string> | null): string | null {
  return recordsByTeam?.get(name) ?? null;
}

function NextGameCard({ game, recordsByTeam }: { game: LiveGame; recordsByTeam: Map<string, string> | null }) {
  const { time, rink } = splitTimeRink(game.time);
  const awayColors = getTeamColors(game.awayTeam);
  const homeColors = getTeamColors(game.homeTeam);
  const awayRecord = recordFor(game.awayTeam, recordsByTeam);
  const homeRecord = recordFor(game.homeTeam, recordsByTeam);

  return (
    <Link href={`/games/${game.id}`} className="group glass-card lift block overflow-hidden rounded-3xl">
      <div className="p-6 sm:p-8 md:p-10">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Next game</p>
          {game.gameType === "playoff" ? <PlayoffBadge /> : null}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="flex items-center gap-2.5">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: awayColors.border }} aria-hidden />
            <span className="text-3xl font-semibold text-neutral-900 md:text-4xl">{game.awayTeam}</span>
            {awayRecord ? <span className="text-sm font-medium text-neutral-400">{awayRecord}</span> : null}
          </div>
          <span className="text-lg font-normal text-neutral-400 sm:text-xl">at</span>
          <div className="flex items-center gap-2.5">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: homeColors.border }} aria-hidden />
            <span className="text-3xl font-semibold text-neutral-900 md:text-4xl">{game.homeTeam}</span>
            {homeRecord ? <span className="text-sm font-medium text-neutral-400">{homeRecord}</span> : null}
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-end justify-between gap-6 border-t border-black/5 pt-6">
          <p className="text-sm font-medium text-neutral-500">{formatGameDate(game.date)}</p>
          <div className="text-right">
            {time ? (
              <p className="text-2xl font-semibold tabular-nums text-neutral-900 md:text-3xl">{time}</p>
            ) : (
              <p className="text-2xl font-semibold text-neutral-400 md:text-3xl">TBD</p>
            )}
            {rink ? <p className="mt-1 text-sm text-neutral-500">{rink}</p> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

function GameRow({ game, recordsByTeam }: { game: LiveGame; recordsByTeam: Map<string, string> | null }) {
  const isFinal = game.status === "final" && game.homeScore !== null && game.awayScore !== null;
  const isLive = game.status === "live";
  const homeWins = isFinal && (game.homeScore as number) > (game.awayScore as number);
  const awayWins = isFinal && (game.awayScore as number) > (game.homeScore as number);

  const { time, rink } = splitTimeRink(game.time);
  const awayRecord = recordFor(game.awayTeam, recordsByTeam);
  const homeRecord = recordFor(game.homeTeam, recordsByTeam);

  const awayNameClass = isFinal ? (awayWins ? "font-semibold text-neutral-900" : "font-medium text-neutral-400") : "font-medium text-neutral-900";
  const homeNameClass = isFinal ? (homeWins ? "font-semibold text-neutral-900" : "font-medium text-neutral-400") : "font-medium text-neutral-900";

  return (
    <Link href={`/games/${game.id}`} className="group flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-neutral-50/80">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-2 text-base">
          <TeamDot name={game.awayTeam} />
          <span className={`${awayNameClass} truncate`}>{game.awayTeam}</span>
          {awayRecord ? <span className="shrink-0 text-xs font-medium text-neutral-400">{awayRecord}</span> : null}
        </div>
        <div className="flex items-center gap-2 text-base">
          <span className="w-2.5 shrink-0 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-400">at</span>
          <span className={`${homeNameClass} truncate`}>{game.homeTeam}</span>
          {homeRecord ? <span className="shrink-0 text-xs font-medium text-neutral-400">{homeRecord}</span> : null}
        </div>
        {game.gameType === "playoff" ? <PlayoffBadge /> : null}
        {game.note ? <p className="text-xs text-neutral-500">{game.note}</p> : null}
      </div>

      <div className="shrink-0 text-right">
        {isFinal ? (
          <>
            <div className="flex items-center justify-end gap-2 text-xl font-semibold tabular-nums sm:text-2xl">
              <span className={awayWins ? "text-neutral-900" : "text-neutral-400"}>{game.awayScore}</span>
              <span className="text-neutral-300">–</span>
              <span className={homeWins ? "text-neutral-900" : "text-neutral-400"}>{game.homeScore}</span>
            </div>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Final</p>
          </>
        ) : isLive ? (
          <>
            <p className="flex items-center justify-end gap-1.5 text-xs font-semibold text-rose-600">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-600" />
              </span>
              Live
            </p>
            <div className="mt-1 flex items-center justify-end gap-2 text-xl font-semibold tabular-nums text-neutral-900 sm:text-2xl">
              {game.awayScore ?? 0}–{game.homeScore ?? 0}
            </div>
          </>
        ) : (
          <>
            {time ? (
              <p className="text-lg font-semibold tabular-nums text-neutral-900 sm:text-xl">{time}</p>
            ) : (
              <p className="text-lg font-semibold text-neutral-400 sm:text-xl">TBD</p>
            )}
            {rink ? <p className="mt-0.5 text-xs text-neutral-500">{rink}</p> : null}
          </>
        )}
      </div>
    </Link>
  );
}

function MonthSchedule({ months, recordsByTeam }: { months: MonthGroup[]; recordsByTeam: Map<string, string> | null }) {
  return (
    <div className="space-y-8">
      {months.map((month) => (
        <div key={month.monthKey} className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{month.monthLabel}</p>
          <div className="space-y-5">
            {month.dates.map(([date, list]) => (
              <div key={date}>
                <p className="mb-2 text-sm font-medium text-neutral-500">{formatGameDate(date)}</p>
                <div className="glass-card divide-y divide-black/5 overflow-hidden rounded-3xl">
                  {list.map((g) => (
                    <GameRow key={g.id} game={g} recordsByTeam={recordsByTeam} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function SchedulePage() {
  const season = await getActiveSeasonLive();
  const games = season?.games ?? [];

  if (!season || games.length === 0) {
    return (
      <section className="space-y-8">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">League Hub</p>
          <h1 className="mt-2 text-4xl font-semibold text-neutral-900">Schedule</h1>
          <p className="mt-3 text-neutral-600">Wednesdays at DSC · first game September 9.</p>
        </div>

        <div className="glass-card rounded-3xl p-8 text-center md:p-12">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Coming soon</p>
          <h2 className="mt-3 text-2xl font-semibold text-neutral-900">Teams first, then games.</h2>
          <p className="mx-auto mt-3 max-w-md text-neutral-600">
            First game September 9. Wednesdays at DSC — 10:00 PM Rink B, 10:30 PM Rink A. The full schedule posts
            after the draft.
          </p>
          <Link
            href="/draft"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-black"
          >
            Go to the draft
          </Link>
        </div>
      </section>
    );
  }

  const live = games.filter((g) => g.status === "live");
  const upcoming = sortChronological(games.filter((g) => g.status === "scheduled"));
  const completed = sortMostRecentFirst(games.filter((g) => g.status === "final"));

  // Records show up next to team names only once the season has real finals on the board —
  // pre-season every team reads 0-0-0, which is noise, not information.
  const seasonHasFinals = season.standings.some((s) => s.gp > 0);
  const recordsByTeam = seasonHasFinals ? new Map(season.standings.map((s) => [s.team, `${s.wins}-${s.losses}-${s.ties}`])) : null;

  const nextGame = upcoming[0] ?? null;
  const upcomingMonths = groupByMonth(upcoming);
  const completedMonths = groupByMonth(completed);

  return (
    <section className="space-y-10">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">League Hub</p>
        <h1 className="mt-2 text-4xl font-semibold text-neutral-900">Schedule · {season.label}</h1>
      </div>

      {live.length > 0 ? (
        <div className="space-y-5">
          <h2 className="text-2xl font-semibold text-neutral-900">Live now</h2>
          <div className="glass-card divide-y divide-black/5 overflow-hidden rounded-3xl">
            {live.map((g) => (
              <GameRow key={g.id} game={g} recordsByTeam={recordsByTeam} />
            ))}
          </div>
        </div>
      ) : null}

      {nextGame ? <NextGameCard game={nextGame} recordsByTeam={recordsByTeam} /> : null}

      {upcomingMonths.length > 0 ? (
        <div className="space-y-5">
          <h2 className="text-2xl font-semibold text-neutral-900">Upcoming</h2>
          <MonthSchedule months={upcomingMonths} recordsByTeam={recordsByTeam} />
        </div>
      ) : null}

      {completedMonths.length > 0 ? (
        <div className="space-y-5">
          <h2 className="text-2xl font-semibold text-neutral-900">Results</h2>
          <MonthSchedule months={completedMonths} recordsByTeam={recordsByTeam} />
        </div>
      ) : null}
    </section>
  );
}
