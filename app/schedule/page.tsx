import type { Metadata } from "next";
import Link from "next/link";
import { getActiveSeasonLive, type LiveGame } from "@/lib/live-season";
import {
  formatGameDate,
  PlayoffBadge,
  recordFor,
  sortChronological,
  splitTimeRink,
  TeamMarker,
  timeSortKey,
} from "@/app/components/next-game-card";
import { NightSlate } from "@/app/components/night-slate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Schedule — Outlaw Hockey League",
  description: "Upcoming and completed games for the current Outlaw Hockey League season.",
};

function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
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

function TeamLine({
  name,
  prefix,
  record,
  score,
  dim,
}: {
  name: string;
  prefix: string;
  record: string | null;
  score: number | null;
  dim: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-4 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{prefix}</span>
      <TeamMarker name={name} size={18} dotSize={8} />
      <span className={`truncate ${dim ? "text-neutral-400" : "font-medium text-neutral-900"}`}>{name}</span>
      {record ? <span className="hidden shrink-0 text-xs text-neutral-400 sm:inline">{record}</span> : null}
      {score !== null ? (
        <span className={`ml-auto w-6 shrink-0 text-right text-base font-semibold tabular-nums ${dim ? "text-neutral-400" : "text-neutral-900"}`}>
          {score}
        </span>
      ) : null}
    </div>
  );
}

/** One game on one hairline row: when/where on the left, both teams stacked, scores on the right once final. */
function ScheduleRow({ game, recordsByTeam }: { game: LiveGame; recordsByTeam: Map<string, string> | null }) {
  const isFinal = game.status === "final" && game.homeScore !== null && game.awayScore !== null;
  const isLive = game.status === "live";
  const homeWins = isFinal && (game.homeScore as number) > (game.awayScore as number);
  const awayWins = isFinal && (game.awayScore as number) > (game.homeScore as number);
  const tie = isFinal && game.homeScore === game.awayScore;
  const { time, rink } = splitTimeRink(game.time);
  const rinkShort = rink?.replace(/^rink\s+/i, "") ?? null;

  return (
    <Link href={`/games/${game.id}`} className="group flex items-center gap-4 py-2.5 transition hover:bg-black/[0.02]">
      <div className="w-[4.5rem] shrink-0 text-xs leading-tight">
        {isFinal ? (
          <>
            <span className="font-semibold uppercase tracking-[0.15em] text-neutral-500">Final</span>
            {tie ? <span className="block text-neutral-400">Tie</span> : null}
          </>
        ) : isLive ? (
          <span className="flex items-center gap-1.5 font-semibold text-rose-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-600" />
            </span>
            Live
          </span>
        ) : (
          <>
            <span className="font-semibold tabular-nums text-neutral-900">{time ?? "TBD"}</span>
            {rinkShort ? <span className="block text-neutral-400">Rink {rinkShort}</span> : null}
          </>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <TeamLine
          name={game.awayTeam}
          prefix=""
          record={isFinal ? null : recordFor(game.awayTeam, recordsByTeam)}
          score={isFinal ? (game.awayScore as number) : isLive ? (game.awayScore ?? 0) : null}
          dim={isFinal && !awayWins && !tie}
        />
        <TeamLine
          name={game.homeTeam}
          prefix="at"
          record={isFinal ? null : recordFor(game.homeTeam, recordsByTeam)}
          score={isFinal ? (game.homeScore as number) : isLive ? (game.homeScore ?? 0) : null}
          dim={isFinal && !homeWins && !tie}
        />
        {game.gameType === "playoff" ? <PlayoffBadge /> : null}
        {game.note ? <p className="text-xs text-neutral-500">{game.note}</p> : null}
      </div>
    </Link>
  );
}

function MonthSchedule({ months, recordsByTeam }: { months: MonthGroup[]; recordsByTeam: Map<string, string> | null }) {
  return (
    <div className="max-w-3xl space-y-7">
      {months.map((month) => (
        <div key={month.monthKey}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{month.monthLabel}</p>
          {month.dates.map(([date, list]) => (
            <div key={date} className="mt-3">
              <p className="pb-1.5 text-sm font-medium text-neutral-700">{formatGameDate(date)}</p>
              <div className="divide-y divide-black/[0.06] border-y border-black/[0.07]">
                {list.map((g) => (
                  <ScheduleRow key={g.id} game={g} recordsByTeam={recordsByTeam} />
                ))}
              </div>
            </div>
          ))}
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

  // Two games every Wednesday: feature the whole next night, then list the rest.
  const nextNight = upcoming.length ? upcoming.filter((g) => g.date === upcoming[0].date) : [];
  const rest = upcoming.filter((g) => g.date !== upcoming[0]?.date);
  const upcomingMonths = groupByMonth(rest);
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
          <div className="divide-y divide-black/[0.06] border-y border-black/[0.07]">
            {live.map((g) => (
              <ScheduleRow key={g.id} game={g} recordsByTeam={recordsByTeam} />
            ))}
          </div>
        </div>
      ) : null}

      {nextNight.length ? (
        <div>
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Next up</h2>
            <span className="text-xs text-neutral-400">{formatGameDate(nextNight[0].date)}</span>
          </div>
          <div className="mt-2 border-y border-black/[0.07]">
            <NightSlate games={nextNight} />
          </div>
        </div>
      ) : null}

      {completedMonths.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-neutral-900">Results</h2>
          <MonthSchedule months={completedMonths} recordsByTeam={recordsByTeam} />
        </div>
      ) : null}

      {upcomingMonths.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-neutral-900">Upcoming</h2>
          <MonthSchedule months={upcomingMonths} recordsByTeam={recordsByTeam} />
        </div>
      ) : null}
    </section>
  );
}
