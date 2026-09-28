import Image from "next/image";
import Link from "next/link";
import { getActiveSeasonLive, type LiveGame } from "@/lib/live-season";
import { getStarsForGames } from "@/lib/three-stars";
import { FinalScoreboard } from "@/app/components/final-scoreboard";
import { type TeamStanding } from "@/lib/league-data";
import { TeamLogo, teamLogo, teamSlug } from "@/lib/team-logos";
import { formatGameDate, sortChronological, splitTimeRink } from "@/app/components/next-game-card";
import { NightSlate } from "@/app/components/night-slate";

const LOGO = "/ohl_logo_2.png";

export const dynamic = "force-dynamic";

/**
 * Center-ice hero: the league mark sits at the center-ice dot inside a faint
 * face-off circle, with the whole night's slate — both Wednesday games —
 * stacked beneath it.
 */
function CenterIceHero({ games }: { games: LiveGame[] }) {
  return (
    <div className="hero-rise relative overflow-hidden py-10 text-center md:py-14">
      {/* Face-off circles are centered on the mark itself — the logo is the
          center-ice dot — so they track it across breakpoints. */}
      <div className="relative flex justify-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[272px] w-[272px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[0.06] md:h-[384px] md:w-[384px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[228px] w-[228px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[0.045] md:h-[324px] md:w-[324px]"
        />
        <Image
          src={LOGO}
          alt="Outlaw Hockey League"
          width={480}
          height={480}
          sizes="(min-width: 768px) 320px, 224px"
          className="relative h-auto w-56 object-contain md:w-80"
          priority
        />
      </div>

      <p className="relative mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">
        {formatGameDate(games[0].date)}
      </p>

      {/* Both Wednesday games on one line; they stack only on the narrowest
          phones, where two nameplates side by side would collide. */}
      <div className="relative mx-auto mt-2 max-w-3xl">
        <NightSlate games={games} />
      </div>

      <Link
        href="/schedule"
        className="relative mt-6 inline-block text-sm font-medium text-neutral-400 transition hover:text-neutral-700"
      >
        Full schedule →
      </Link>
    </div>
  );
}

/** Quiet single-line facts under the hero — hairlines, not cards. */
function PhaseStrip() {
  const rows = [
    { href: "/draft", label: "Draft night", value: "Wednesday, August 26 · 8 PM · Mr. Joe's" },
    { href: "/payments", label: "Fall dues", value: "$150 deposit · skaters $650 · goalies $100" },
    { href: "/subs", label: "Subs", value: "$25 per game · paid subs get the first call" },
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
  // The league plays two games every Wednesday, so the hero shows the whole
  // night — every game sharing the next date, not just the earliest one.
  const nextNight = upcoming.length ? upcoming.filter((g) => g.date === upcoming[0].date) : [];
  const finals = games.filter((g) => g.status === "final" && g.gameType === "regular");
  const hasFinals = finals.length > 0;
  const played = sortChronological(finals);
  const latestNight = hasFinals
    ? played.filter((g) => g.date === played[played.length - 1].date)
    : [];
  const starsByGame = await getStarsForGames(latestNight.map((g) => g.id));

  return (
    <section className="space-y-6">
      <h1 className="sr-only">Outlaw Hockey League</h1>

      {nextNight.length ? (
        <CenterIceHero games={nextNight} />
      ) : (
        <div className="flex justify-center py-10">
          <Image src={LOGO} alt="Outlaw Hockey League" width={220} height={220} sizes="220px" className="h-auto w-44 object-contain sm:w-52" priority />
        </div>
      )}

      {hasFinals && latestNight.length ? (
        <div className="hero-rise-late mx-auto max-w-3xl">
          <div className="flex items-baseline justify-between px-1 pb-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Latest</span>
            <span className="text-xs text-neutral-400">{formatGameDate(latestNight[0].date)}</span>
          </div>
          <div className="grid grid-cols-1 gap-y-8 border-y border-black/[0.07] py-5 sm:grid-cols-2 sm:gap-y-0">
            {latestNight.map((game) => (
              <div key={game.id} className="sm:first:pr-8 sm:last:border-l sm:last:border-black/[0.07] sm:last:pl-8">
                <FinalScoreboard
                  gameId={game.id}
                  awayTeam={game.awayTeam}
                  homeTeam={game.homeTeam}
                  awayScore={game.awayScore as number}
                  homeScore={game.homeScore as number}
                  stars={starsByGame.get(game.id) ?? []}
                  meta={splitTimeRink(game.time).rink}
                />
              </div>
            ))}
          </div>
          <div className="mx-auto mt-8 max-w-2xl">
            <StandingsStrip standings={season?.standings ?? []} />
          </div>
        </div>
      ) : (
        <PhaseStrip />
      )}
    </section>
  );
}
