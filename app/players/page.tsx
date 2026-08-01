import type { Metadata } from "next";
import { getPlayerPool } from "@/lib/players";
import { PlayersSearch } from "./players-search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Players — Outlaw Hockey League",
  description: "Browse the full Outlaw Hockey League player pool — ranks, positions, and teams.",
};

export default async function PlayersPage() {
  const players = await getPlayerPool();

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">League Hub</p>
        <h1 className="mt-2 text-4xl font-semibold text-neutral-900">Players</h1>
        <p className="mt-3 text-neutral-600">The 2026–27 player pool.</p>
      </div>

      <PlayersSearch players={players} />
    </section>
  );
}
