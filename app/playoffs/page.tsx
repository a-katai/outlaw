import type { Metadata } from "next";
import { getPlayoffBracket } from "@/lib/live-season";
import { PlayoffBracketView } from "./bracket";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Playoffs — Outlaw Hockey League",
  description: "Live playoff bracket and series results for the Outlaw Hockey League.",
};

export default async function PlayoffsPage() {
  const bracket = await getPlayoffBracket();

  return (
    <section className="space-y-10">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">League Hub</p>
        <h1 className="mt-2 text-4xl font-semibold text-neutral-900">
          Playoffs{bracket?.seasonLabel ? ` · ${bracket.seasonLabel}` : ""}
        </h1>
        <p className="mt-2 text-neutral-600">Four make it. One takes it.</p>
        <p className="mt-1 text-sm text-neutral-500">
          4th and 5th play in. Semifinals are one game. The final is best of three.
        </p>
      </div>

      <PlayoffBracketView bracket={bracket} />
    </section>
  );
}
