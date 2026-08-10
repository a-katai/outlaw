import Image from "next/image";
import Link from "next/link";
import { getActiveSeasonLive, type LiveGame } from "@/lib/live-season";
import { getTeamColors, type TeamStanding } from "@/lib/league-data";
import { TeamLogo, teamLogo, teamSlug } from "@/lib/team-logos";
import { formatGameDate, sortChronological, splitTimeRink } from "@/app/components/next-game-card";

const LOGO = "/ohl_logo_2.png";

export const dynamic = "force-dynamic";

/**
 * Center-ice hero: the badge sits at the center-ice dot inside a faint
 * face-off circle; the matchup reads like jersey nameplates around it.
 */
function CenterIceHero({ game }: { game: LiveGame }) {
  const { time, rink } = splitTimeRink(game.time);
  const away = { name: game.awayTeam, colors: getTeamColors(game.awayTeam) };
  const home = { name: game.homeTeam, colors: getTeamColors(game.homeTeam) };

  return (
    <Link href={`/games/${game.id}`} className="hero-rise group relative block overflow-hidden py-10 text-center md:py-16">
      {/* face-off circle */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[0.06] md:h-[680px] md:w-[680px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[0.045] md:h-[440px] md:w-[440px]"
      />

      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">Next game</p>

      <div className="mt-8 flex items-center justify-center gap-6 sm:gap-10 md:gap-16">
        <div className="flex w-32 flex-col items-center gap-4 sm:w-44 md:w-56">
          {teamLogo(away.name) ? (
            <>
              <div className="md:hidden"><TeamLogo name={away.name} size={104} /></div>
              <div className="hidden md:block"><TeamLogo name={away.name} size={148} /></div>
            </>
          ) : null}
          <p
            className="nameplate text-2xl leading-none text-neutral-900 sm:text-3xl md:text-4xl"
            style={{ borderBottom: `3px solid ${away.colors.border}`, paddingBottom: "0.4rem" }}
          >
            {away.name}
          </p>
        </div>

        <span className="nameplate self-center pb-8 text-xl text-neutral-300 md:text-2xl">at</span>

        <div className="flex w-32 flex-col items-center gap-4 sm:w-44 md:w-56">
          {teamLogo(home.name) ? (
            <>
              <div className="md:hidden"><TeamLogo name={home.name} size={104} /></div>
              <div className="hidden md:block"><TeamLogo name={home.name} size={148} /></div>
            </>
          ) : null}
          <p
            className="nameplate text-2xl leading-none text-neutral-900 sm:text-3xl md:text-4xl"
            style={{ borderBottom: `3px solid ${home.colors.border}`, paddingBottom: "0.4rem" }}
          >
            {home.name}
          </p>
        </div>
      </div>

      <p className="mt-10 text-base font-medium text-neutral-600 md:text-lg">
        {formatGameDate(game.date)}
        {time ? <span className="text-neutral-900"> · {time}</span> : null}
        {rink ? <span className="text-neutral-500"> · {rink}</span> : null}
      </p>
      <p className="mt-5 text-sm font-medium text-neutral-400 transition group-hover:text-neutral-700">
        Full schedule →
      </p>
    </Link>
  );
}

/** Quiet single-line facts under the hero — hairlines, not cards. */
function PhaseStrip() {
  const rows = [
    { href: "/draft", label: "Draft night", value: "Wednesday, August 26 · 8 PM · Mr. Joe's" },
    { href: "/payments", label: "Fall dues", value: "$150 deposit · skaters $650 · goalies $100" },
  ];
  return (
    <div className="hero-rise-late mx-auto max-w-2xl divide-y divide-black/[0.07] border-y border-black/[0.07]">
      {rows.map((row) => (
        <Link key={row.href} href={row.href} className="group flex items-baseline justify-between gap-6 py-4">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{row.label}</span>
          <span className="text-right text-sm font-medium text-neutral-700 transition group-hover:text-neutral-900">
            {row.value} <span className="text-neutral-300 transition group-hover:text-neutral-500">→</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function LatestResultRow({ game }: { game: LiveGame }) {
  const homeWins = (game.homeScore as number) > (game.awayScore as number);
  return (
    <Link href={`/games/${game.id}`} className="group flex items-baseline justify-between gap-6 py-4">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Latest</span>
      <span className="text-right text-sm font-medium text-neutral-700 transition group-hover:text-neutral-900">
        <span className={homeWins ? "text-neutral-500" : "font-semibold text-neutral-900"}>
          {game.awayTeam} {game.awayScore}
        </span>
        <span className="text-neutral-300"> – </span>
        <span className={homeWins ? "font-semibold text-neutral-900" : "text-neutral-500"}>
          {game.homeScore} {game.homeTeam}
        </span>
        <span className="text-neutral-400"> · Final</span>{" "}
        <span className="text-neutral-300 transition group-hover:text-neutral-500">→</span>
      </span>
    </Link>
  );
}

function StandingsStrip({ standings }: { standings: TeamStanding[] }) {
  return (
    <div className="hero-rise-late mx-auto max-w-2xl">
      <div className="divide-y divide-black/[0.07] border-y border-black/[0.07]">
        {standings.map((team, i) => (
          <Link
            key={team.team}
            href={teamLogo(team.team) ? `/teams/${teamSlug(team.team)}` : "/stats"}
            className="group flex items-center justify-between gap-4 py-3"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="w-4 shrink-0 text-xs font-medium tabular-nums text-neutral-400">{i + 1}</span>
              {teamLogo(team.team) ? <TeamLogo name={team.team} size={22} /> : null}
              <span className="truncate text-sm font-medium text-neutral-800 transition group-hover:text-neutral-900">
                {team.team}
              </span>
            </span>
            <span className="flex shrink-0 items-baseline gap-4 text-xs text-neutral-500">
              <span className="tabular-nums">
                {team.wins}-{team.losses}-{team.ties}
              </span>
              <span className="text-sm font-semibold tabular-nums text-neutral-900">{team.points}</span>
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-3 text-right">
        <Link href="/stats" className="text-xs font-medium text-neutral-400 transition hover:text-neutral-700">
          Full stats →
        </Link>
      </div>
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

  return (
    <section className="space-y-6">
      <h1 className="sr-only">Outlaw Hockey League</h1>

      {nextGame ? (
        <CenterIceHero game={nextGame} />
      ) : (
        <div className="flex justify-center py-10">
          <Image src={LOGO} alt="Outlaw Hockey League" width={220} height={220} sizes="220px" className="h-auto w-44 object-contain sm:w-52" priority />
        </div>
      )}

      {hasFinals && latest ? (
        <div className="mx-auto max-w-2xl">
          <div className="divide-y divide-black/[0.07] border-y border-black/[0.07]">
            <LatestResultRow game={latest} />
          </div>
          <div className="mt-8">
            <StandingsStrip standings={season?.standings ?? []} />
          </div>
        </div>
      ) : (
        <PhaseStrip />
      )}
    </section>
  );
}
