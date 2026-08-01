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

function TeamPill({ name }: { name: string }) {
  const colors = getTeamColors(name);
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
    >
      {name}
    </span>
  );
}

function GameRow({ game, prominent }: { game: LiveGame; prominent?: boolean }) {
  const isFinal = game.status === "final" && game.homeScore !== null && game.awayScore !== null;
  const isLive = game.status === "live";
  const homeWins = isFinal && (game.homeScore as number) > (game.awayScore as number);
  const awayWins = isFinal && (game.awayScore as number) > (game.homeScore as number);

  return (
    <Link
      href={`/games/${game.id}`}
      className={`group flex flex-wrap items-center justify-between gap-4 px-5 transition hover:bg-neutral-50/80 ${prominent ? "py-6" : "py-4"}`}
    >
      <div className="flex flex-col gap-1">
        {prominent ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Next game</p> : null}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={awayWins ? "font-semibold text-neutral-900" : "text-neutral-700"}>
            <TeamPill name={game.awayTeam} />
          </span>
          <span className="text-neutral-400">at</span>
          <span className={homeWins ? "font-semibold text-neutral-900" : "text-neutral-700"}>
            <TeamPill name={game.homeTeam} />
          </span>
          {game.gameType === "playoff" ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              Playoff
            </span>
          ) : null}
        </div>
        {isLive ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-600" />
            </span>
            Live · {game.awayScore ?? 0}–{game.homeScore ?? 0}
          </p>
        ) : game.time ? (
          <p className="text-xs text-neutral-500">{game.time}</p>
        ) : null}
        {game.note ? <p className="text-xs text-neutral-500">{game.note}</p> : null}
      </div>

      {isFinal ? (
        <div className="flex items-center gap-3 text-right">
          <div className={`text-lg font-semibold ${awayWins ? "text-neutral-900" : "text-neutral-400"}`}>
            {game.awayScore}
          </div>
          <span className="text-neutral-300">–</span>
          <div className={`text-lg font-semibold ${homeWins ? "text-neutral-900" : "text-neutral-400"}`}>
            {game.homeScore}
          </div>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 transition group-hover:bg-neutral-200">
            Final
          </span>
        </div>
      ) : isLive ? (
        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700 transition group-hover:bg-rose-200">
          Live
        </span>
      ) : (
        <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 transition group-hover:border-black/20">
          Scheduled
        </span>
      )}
    </Link>
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
          <p className="mt-3 text-neutral-600">The 2026–27 schedule lands after the draft.</p>
        </div>

        <div className="glass-card rounded-3xl p-8 text-center md:p-12">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Coming soon</p>
          <h2 className="mt-3 text-2xl font-semibold text-neutral-900">Teams first, then games.</h2>
          <p className="mx-auto mt-3 max-w-md text-neutral-600">
            Once the draft sets the rosters, the schedule posts here.
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
  const upcoming = games.filter((g) => g.status === "scheduled").sort((a, b) => (a.date < b.date ? -1 : 1));
  const completed = games.filter((g) => g.status === "final").sort((a, b) => (a.date > b.date ? -1 : 1));

  const groupByDate = (list: LiveGame[]) => {
    const map = new Map<string, LiveGame[]>();
    for (const g of list) {
      const bucket = map.get(g.date) ?? [];
      bucket.push(g);
      map.set(g.date, bucket);
    }
    return Array.from(map.entries());
  };

  const upcomingByDate = groupByDate(upcoming);
  const completedByDate = groupByDate(completed);

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
              <GameRow key={g.id} game={g} />
            ))}
          </div>
        </div>
      ) : null}

      {upcomingByDate.length > 0 ? (
        <div className="space-y-5">
          <h2 className="text-2xl font-semibold text-neutral-900">Upcoming</h2>
          {upcomingByDate.map(([date, list], groupIdx) => (
            <div key={date}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                {formatGameDate(date)}
              </p>
              <div className="glass-card divide-y divide-black/5 overflow-hidden rounded-3xl">
                {list.map((g, idx) => (
                  <GameRow key={g.id} game={g} prominent={groupIdx === 0 && idx === 0} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {completedByDate.length > 0 ? (
        <div className="space-y-5">
          <h2 className="text-2xl font-semibold text-neutral-900">Results</h2>
          {completedByDate.map(([date, list]) => (
            <div key={date}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                {formatGameDate(date)}
              </p>
              <div className="glass-card divide-y divide-black/5 overflow-hidden rounded-3xl">
                {list.map((g) => (
                  <GameRow key={g.id} game={g} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
