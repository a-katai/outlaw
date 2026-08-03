import Image from "next/image";
import Link from "next/link";
import { getActiveSeasonLive, type LiveGame } from "@/lib/live-season";
import { getTeamColors, type TeamStanding } from "@/lib/league-data";
import { TeamLogo, teamLogo } from "@/lib/team-logos";
import { NextGameCard, formatGameDate, sortChronological } from "@/app/components/next-game-card";

const LOGO = "/ohl_logo_2.png";

export const dynamic = "force-dynamic";

function LatestResultCard({ game }: { game: LiveGame }) {
  const homeWins = (game.homeScore as number) > (game.awayScore as number);
  const awayWins = (game.awayScore as number) > (game.homeScore as number);

  return (
    <Link href={`/games/${game.id}`} className="group glass-card lift block overflow-hidden rounded-3xl p-6 md:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Latest result</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`truncate text-lg font-semibold ${awayWins ? "text-neutral-900" : "text-neutral-400"}`}>{game.awayTeam}</p>
          <p className={`text-3xl font-semibold tabular-nums ${awayWins ? "text-neutral-900" : "text-neutral-400"}`}>{game.awayScore}</p>
        </div>
        <span className="shrink-0 text-xl text-neutral-300">–</span>
        <div className="min-w-0 text-right">
          <p className={`truncate text-lg font-semibold ${homeWins ? "text-neutral-900" : "text-neutral-400"}`}>{game.homeTeam}</p>
          <p className={`text-3xl font-semibold tabular-nums ${homeWins ? "text-neutral-900" : "text-neutral-400"}`}>{game.homeScore}</p>
        </div>
      </div>
      <p className="mt-4 border-t border-black/5 pt-4 text-xs font-medium text-neutral-500">{formatGameDate(game.date)} · Final</p>
    </Link>
  );
}

function StandingsStrip({ standings }: { standings: TeamStanding[] }) {
  return (
    <div className="glass-card overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Standings</p>
        <Link href="/stats" className="text-xs font-medium text-neutral-500 underline underline-offset-4">
          Full stats
        </Link>
      </div>
      <div className="divide-y divide-black/5">
        {standings.map((team, i) => {
          const colors = getTeamColors(team.team);
          return (
            <Link
              key={team.team}
              href="/stats"
              className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm transition hover:bg-neutral-50/80"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-3 shrink-0 text-xs font-medium text-neutral-400">{i + 1}</span>
                {teamLogo(team.team) ? <TeamLogo name={team.team} size={22} /> : null}
                <span
                  className="inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                  style={{ background: colors.background, color: colors.text, borderColor: colors.border }}
                >
                  <span className="truncate">{team.team}</span>
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-xs text-neutral-500">
                <span className="tabular-nums">
                  {team.wins}-{team.losses}-{team.ties}
                </span>
                <span className="font-semibold text-neutral-900">{team.points} PTS</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function PreSeasonCards() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Link href="/draft" className="glass-card lift block rounded-3xl p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Draft night</p>
        <p className="mt-3 text-xl font-semibold text-neutral-900">Wednesday, August 26 · 8 PM</p>
        <p className="mt-1 text-sm text-neutral-600">Mr. Joe&rsquo;s, Southfield — free beer and pizza.</p>
      </Link>
      <Link href="/payments" className="glass-card lift block rounded-3xl p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Fall dues</p>
        <p className="mt-3 text-xl font-semibold text-neutral-900">$150 deposit due August 10</p>
        <p className="mt-1 text-sm text-neutral-600">Skaters $650, goalies $100. Pay by card on the site.</p>
      </Link>
    </div>
  );
}

export default async function Home() {
  const season = await getActiveSeasonLive();
  const games = season?.games ?? [];
  const upcoming = sortChronological(games.filter((g) => g.status !== "final"));
  const nextGame = upcoming[0] ?? null;
  const finals = games.filter((g) => g.status === "final" && g.gameType === "regular");
  const hasFinals = finals.length > 0;
  const latest = hasFinals ? sortChronological(finals)[finals.length - 1] : null;
  const recordsByTeam = hasFinals
    ? new Map((season?.standings ?? []).map((s) => [s.team, `${s.wins}-${s.losses}-${s.ties}`]))
    : null;

  return (
    <section className="space-y-8">
      <h1 className="sr-only">Outlaw Hockey League</h1>

      <div className="flex justify-center py-2 md:py-4">
        <Image
          src={LOGO}
          alt="Outlaw Hockey League"
          width={220}
          height={220}
          sizes="220px"
          className="h-auto w-44 object-contain sm:w-52"
          priority
        />
      </div>

      {nextGame ? <NextGameCard game={nextGame} recordsByTeam={recordsByTeam} /> : null}

      {hasFinals && latest ? (
        <div className="grid gap-5 md:grid-cols-2">
          <LatestResultCard game={latest} />
          <StandingsStrip standings={season?.standings ?? []} />
        </div>
      ) : (
        <PreSeasonCards />
      )}
    </section>
  );
}
