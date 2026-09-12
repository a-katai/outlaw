import type { Metadata } from "next";
import Link from "next/link";
import { getActiveSeasonLive } from "@/lib/live-season";
import { teamIdForCode } from "@/lib/scorekeeper-auth";
import { teamNameFromSlug } from "@/lib/team-logos";
import { getSubLine } from "@/lib/sub-line";
import { LineupManager } from "./lineup-manager";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const name = teamNameFromSlug(slug);
  return { title: name ? `${name} lineup — Outlaw Hockey League` : "Lineup — Outlaw Hockey League", robots: { index: false } };
}

/**
 * Manager's page: /lineup/<team>?code=<team code>. Dress players for the
 * next game(s) before puck drop so the scorekeeper starts with a sheet, see
 * the full roster, and the sub line (paid subs first — call from the top).
 * The code is the team's own (team_codes) and never leaves the URL.
 */
export default async function LineupPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { slug } = await params;
  const { code } = await searchParams;
  const teamName = teamNameFromSlug(slug);
  const [season, subLine] = await Promise.all([getActiveSeasonLive(), getSubLine()]);
  const team = season?.teams.find((t) => t.name === teamName) ?? null;
  const codeTeamId = await teamIdForCode(code);
  const authed = Boolean(team && codeTeamId && codeTeamId === team.id);

  if (!teamName || !team || !authed) {
    return (
      <section className="mx-auto max-w-sm space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">League Hub</p>
        <h1 className="text-3xl font-semibold text-neutral-900">Lineup</h1>
        <p className="text-sm text-neutral-600">
          This page needs your team&rsquo;s link. Ask the commissioner for it.
        </p>
        <Link href="/schedule" className="text-sm font-medium text-neutral-600 underline underline-offset-4 hover:text-neutral-900">
          ← Schedule
        </Link>
      </section>
    );
  }

  const upcoming = (season?.games ?? [])
    .filter((g) => (g.homeTeamId === team.id || g.awayTeamId === team.id) && g.status !== "final")
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, 3)
    .map((g) => ({
      id: g.id,
      date: g.date,
      time: g.time,
      opponent: g.homeTeamId === team.id ? g.awayTeam : g.homeTeam,
      home: g.homeTeamId === team.id,
      status: g.status,
    }));

  return (
    <LineupManager
      teamId={team.id}
      teamName={team.name}
      teamCode={(code ?? "").trim().toUpperCase()}
      games={upcoming}
      roster={season?.rosters[team.name] ?? []}
      subs={subLine.map((s) => ({
        key: s.key,
        name: s.name,
        position: s.position,
        rank: s.rank,
        phone: s.phone,
        paid: s.paid,
        gamesCovered: s.gamesCovered,
      }))}
    />
  );
}
