import type { Metadata } from "next";
import { ShameWall } from "@/app/components/shame-wall";
import { SHAME_ENTRIES } from "./entries";

/**
 * The Wall of Shame. Gag booking photos of league guys — funny to the room,
 * less funny in a search result for someone's name, so the page is noindexed.
 * The home page shows the same cards; this is the full wall.
 */
export const metadata: Metadata = {
  title: "Wall of Shame — Outlaw Hockey League",
  description: "Booked, printed, and posted. The Outlaw Hockey League Wall of Shame.",
  robots: { index: false, follow: false },
};

export default function ShamePage() {
  return (
    <section className="space-y-8 pb-16">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">League Hub</p>
        <h1 className="nameplate mt-2 text-4xl text-neutral-900 sm:text-5xl">Wall of Shame</h1>
        <p className="mt-3 max-w-prose text-neutral-600">
          Booked, printed, and posted. No bail, no appeals. Court is in session every Wednesday.
        </p>
      </div>

      {SHAME_ENTRIES.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center text-sm text-neutral-500">
          Nobody has earned it yet. Give it a week.
        </div>
      ) : (
        <ShameWall entries={SHAME_ENTRIES} />
      )}

      <p className="text-xs text-neutral-400">
        All charges fictional. Everyone pictured is in on it. Want off the wall? Play better.
      </p>
    </section>
  );
}
