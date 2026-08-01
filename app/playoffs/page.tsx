import type { Metadata } from "next";
import Link from "next/link";
import { getPlayoffBracket, type PlayoffSeriesView } from "@/lib/live-season";
import { getTeamColors } from "@/lib/league-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Playoffs — Outlaw Hockey League",
  description: "Live playoff bracket and series results for the Outlaw Hockey League.",
};

function formatChipDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const date = new Date(2000, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TeamRow({ name, wins, isWinner }: { name: string | null; wins: number; isWinner: boolean }) {
  const colors = name ? getTeamColors(name) : null;
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${
        isWinner ? "border border-amber-200 bg-amber-50" : "bg-neutral-50/70"
      }`}
    >
      <span
        className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
        style={name ? { backgroundColor: colors!.background, color: colors!.text, borderColor: colors!.border } : undefined}
      >
        {name ?? "TBD"}
      </span>
      <span className={`text-sm font-semibold ${isWinner ? "text-amber-700" : "text-neutral-700"}`}>{wins}</span>
    </div>
  );
}

function SeriesCard({ series }: { series: PlayoffSeriesView }) {
  return (
    <div className="glass-card w-72 shrink-0 rounded-3xl p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Best of {series.bestOf}</p>
      <div className="mt-3 space-y-2">
        <TeamRow name={series.teamAName} wins={series.teamAWins} isWinner={Boolean(series.winnerTeamId) && series.winnerTeamId === series.teamAId} />
        <TeamRow name={series.teamBName} wins={series.teamBWins} isWinner={Boolean(series.winnerTeamId) && series.winnerTeamId === series.teamBId} />
      </div>

      {series.games.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {series.games.map((g, i) => (
            <Link
              key={g.id}
              href={`/games/${g.id}`}
              className="rounded-full border border-black/10 bg-white px-2 py-1 text-[10px] font-semibold text-neutral-600 transition hover:border-black/20 hover:text-neutral-900"
            >
              G{i + 1} · {formatChipDate(g.date)}
              {g.status === "final" ? ` ${g.awayScore}–${g.homeScore}` : ""}
            </Link>
          ))}
        </div>
      ) : null}

      {series.winnerTeamId ? (
        <p className="mt-3 text-xs font-semibold text-amber-700">{series.winnerTeamName} wins</p>
      ) : null}
    </div>
  );
}

export default async function PlayoffsPage() {
  const bracket = await getPlayoffBracket();

  if (!bracket || bracket.rounds.length === 0) {
    return (
      <section className="space-y-8">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">League Hub</p>
          <h1 className="mt-2 text-4xl font-semibold text-neutral-900">Playoffs</h1>
        </div>

        <div className="glass-card rounded-3xl p-8 text-center md:p-12">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Coming soon</p>
          <h2 className="mt-3 text-2xl font-semibold text-neutral-900">Playoffs begin after the regular season.</h2>
          <Link
            href="/stats"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-black"
          >
            See stats
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-10">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">League Hub</p>
        <h1 className="mt-2 text-4xl font-semibold text-neutral-900">Playoffs · {bracket.seasonLabel}</h1>
      </div>

      {bracket.champion ? (
        <div className="glass-card rounded-3xl bg-gradient-to-br from-amber-50 to-white p-8 text-center md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">{bracket.seasonLabel} Champions</p>
          <h2 className="mt-2 text-3xl font-semibold text-neutral-900 md:text-4xl">{bracket.champion.teamName}</h2>
        </div>
      ) : null}

      <div className="-mx-6 overflow-x-auto px-6 md:-mx-8 md:px-8">
        <div className="flex gap-6" style={{ minWidth: "max-content" }}>
          {bracket.rounds.map((round) => (
            <div key={round.round} className="w-72 shrink-0 space-y-4">
              <h2 className="text-lg font-semibold text-neutral-900">{round.name}</h2>
              <div className="space-y-4">
                {round.series.map((s) => (
                  <SeriesCard key={s.id} series={s} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
