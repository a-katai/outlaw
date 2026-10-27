import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecap, getRecapDates, longDate, shortDate, weekLabel } from "@/lib/recap";
import { FinalScoreboard } from "@/app/components/final-scoreboard";
import { getTeamColors } from "@/lib/league-data";
import { TeamLogo, teamLogo } from "@/lib/team-logos";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  const recap = await getRecap(date);
  if (!recap) return { title: "Not found — Outlaw Hockey League" };
  const week = weekLabel(recap);
  const title = `The Wednesday Report${week ? ` · ${week}` : ""} — Outlaw Hockey League`;
  const description = recap.games
    .map((g) => `${g.awayTeam} ${g.awayScore}, ${g.homeTeam} ${g.homeScore}`)
    .join(" · ");
  const image = { url: `/recap/${date}/card`, width: 1080, height: 1350, alt: `The Wednesday Report, ${shortDate(date)}` };
  return {
    title,
    description,
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function RecapPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const [recap, dates] = await Promise.all([getRecap(date), getRecapDates()]);
  if (!recap) notFound();

  const week = weekLabel(recap);
  const i = dates.indexOf(date);
  const newer = i > 0 ? dates[i - 1] : null;
  const older = i >= 0 && i < dates.length - 1 ? dates[i + 1] : null;

  // Point streaks are many; fold each length into one line.
  const streakGroups = Array.from(
    recap.milestones
      .filter((m) => m.kind === "streak")
      .reduce((acc, m) => acc.set(m.label, [...(acc.get(m.label) ?? []), m]), new Map<string, typeof recap.milestones>()),
  );

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
          The Wednesday Report{week ? ` · ${week}` : ""}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-900 md:text-4xl">{longDate(date)}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium">
          {older ? (
            <Link href={`/recap/${older}`} className="text-neutral-500 underline underline-offset-4 transition hover:text-neutral-900">
              ← {shortDate(older)}
            </Link>
          ) : null}
          {newer ? (
            <Link href={`/recap/${newer}`} className="text-neutral-500 underline underline-offset-4 transition hover:text-neutral-900">
              {shortDate(newer)} →
            </Link>
          ) : null}
          <a
            href={`/recap/${date}/card`}
            download={`ohl-recap-${date}.png`}
            className="text-neutral-500 underline underline-offset-4 transition hover:text-neutral-900"
          >
            Download card
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {recap.games.map((g) => (
          <div key={g.id} className="glass-card rounded-3xl px-5 py-4 md:px-8 md:py-6">
            <FinalScoreboard
              gameId={g.id}
              awayTeam={g.awayTeam}
              homeTeam={g.homeTeam}
              awayScore={g.awayScore}
              homeScore={g.homeScore}
              stars={g.stars}
              lineScore={g.lineScore}
              meta={[g.rink, g.time].filter(Boolean).join(" · ") || null}
              large
            />
          </div>
        ))}
      </div>

      {recap.milestones.length ? (
        <div className="glass-card rounded-3xl px-5 py-4 md:px-8 md:py-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Milestones</p>
          <div className="mt-1 divide-y divide-black/[0.05]">
            {recap.milestones.filter((m) => m.kind !== "streak").map((m, n) => {
              const colors = getTeamColors(m.team);
              return (
                <Link
                  key={`${m.kind}-${m.playerId}-${n}`}
                  href={`/players/${m.playerId}`}
                  className="group flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {teamLogo(m.team) ? (
                      <TeamLogo name={m.team} size={20} />
                    ) : (
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors.border }} />
                    )}
                    <span className="truncate text-sm font-medium text-neutral-800 group-hover:text-neutral-900">{m.playerName}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-neutral-600">{m.label}</span>
                </Link>
              );
            })}
            {streakGroups.map(([label, list]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
                <span className="min-w-0 text-sm text-neutral-700">
                  {list.map((m, n) => (
                    <span key={m.playerId}>
                      {n ? ", " : ""}
                      <Link href={`/players/${m.playerId}`} className="font-medium text-neutral-800 transition hover:text-neutral-900">
                        {m.playerName}
                      </Link>
                    </span>
                  ))}
                </span>
                <span className="shrink-0 text-sm font-semibold text-neutral-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
