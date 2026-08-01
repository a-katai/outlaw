import type { Metadata } from "next";
import Link from "next/link";
import { isScorekeeperAuthed } from "@/lib/scorekeeper-auth";
import { getActiveSeasonLive, type LiveGame } from "@/lib/live-season";
import { getTeamColors } from "@/lib/league-data";
import { ScorekeeperLogin } from "./scorekeeper-login";
import { ScorekeeperSignOut } from "./sign-out-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scorekeeper — Outlaw Hockey League",
  description: "Sign in to score live Outlaw Hockey League games from the bench.",
};

function formatGameDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
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

export default async function ScorekeeperIndexPage() {
  const authed = await isScorekeeperAuthed();
  if (!authed) return <ScorekeeperLogin />;

  const season = await getActiveSeasonLive();
  const games = (season?.games ?? [])
    .filter((g) => g.status === "scheduled" || g.status === "live")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "live" ? -1 : 1;
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">League Hub</p>
          <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Scorekeeper</h1>
        </div>
        <ScorekeeperSignOut />
      </div>

      {!season || games.length === 0 ? (
        <div className="glass-card rounded-3xl p-8 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Nothing to score</p>
          <h2 className="mt-3 text-xl font-semibold text-neutral-900">No scheduled or live games right now.</h2>
        </div>
      ) : (
        <div className="space-y-3">
          {games.map((g: LiveGame) => (
            <Link
              key={g.id}
              href={`/scorekeeper/${g.id}`}
              className="glass-card lift flex items-center justify-between gap-4 rounded-3xl p-5"
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <TeamPill name={g.awayTeam} />
                  <span className="text-neutral-400">at</span>
                  <TeamPill name={g.homeTeam} />
                </div>
                <p className="text-xs text-neutral-500">
                  {formatGameDate(g.date)}
                  {g.time ? ` · ${g.time}` : ""}
                </p>
              </div>
              {g.status === "live" ? (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-600" />
                  </span>
                  {g.homeScore ?? 0}–{g.awayScore ?? 0}
                </span>
              ) : (
                <span className="shrink-0 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Scheduled
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
