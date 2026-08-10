import type { Metadata } from "next";
import Link from "next/link";
import { getActiveSeasonLive } from "@/lib/live-season";
import { TEAM_SLUG_LIST, TeamLogo, teamNameFromSlug } from "@/lib/team-logos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Teams — Outlaw Hockey League",
  description: "The five teams competing in the Outlaw Hockey League.",
};

export default async function TeamsPage() {
  const season = await getActiveSeasonLive();
  const standings = season?.standings ?? [];
  // Records show up next to team names only once the season has real finals
  // on the board — pre-season every team reads 0-0-0, which is noise, not
  // information (same rule as /schedule and the home page).
  const hasFinals = standings.some((s) => s.gp > 0);
  const recordsByTeam = hasFinals ? new Map(standings.map((s) => [s.team, s])) : null;

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">League Hub</p>
        <h1 className="mt-2 text-4xl font-semibold text-neutral-900">Teams</h1>
        <p className="mt-3 text-neutral-600">The five teams of the {season?.label ?? "2026–27"} season.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TEAM_SLUG_LIST.map((slug) => {
          const name = teamNameFromSlug(slug);
          if (!name) return null;
          const record = recordsByTeam?.get(name);
          return (
            <Link
              key={slug}
              href={`/teams/${slug}`}
              className="glass-card lift flex flex-col items-center gap-4 rounded-3xl p-8 text-center"
            >
              <TeamLogo name={name} size={96} />
              <div>
                <p className="text-xl font-semibold text-neutral-900">{name}</p>
                {record ? (
                  <p className="mt-1 text-sm font-medium text-neutral-500">
                    {record.wins}-{record.losses}-{record.ties} · {record.points} PTS
                  </p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
