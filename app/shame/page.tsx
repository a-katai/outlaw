import type { Metadata } from "next";
import Image from "next/image";
import { SHAME_ENTRIES, type ShameEntry } from "./entries";

/**
 * The Wall of Shame. Gag booking photos of league guys — funny to the room,
 * less funny in a search result for someone's name, so the page is noindexed.
 */
export const metadata: Metadata = {
  title: "Wall of Shame — Outlaw Hockey League",
  description: "Booked, printed, and posted. The Outlaw Hockey League Wall of Shame.",
  robots: { index: false, follow: false },
};

function formatBooked(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Case number is cosmetic — derived from the date so it never shuffles. */
function caseNumber(entry: ShameEntry, index: number): string {
  return `OHL-${entry.bookedOn.replaceAll("-", "").slice(2)}-${String(index + 1).padStart(3, "0")}`;
}

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
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SHAME_ENTRIES.map((entry, i) => (
            <li key={entry.id} className="glass-card lift overflow-hidden rounded-3xl">
              <div className="relative aspect-[3/4] bg-neutral-200">
                <Image
                  src={`/shame/${entry.id}.jpg`}
                  alt={`Booking photo of ${entry.name}`}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                  priority={i === 0}
                />
                <div className="absolute inset-x-0 bottom-0 bg-neutral-900/92 px-4 py-3 text-white backdrop-blur-sm">
                  <p className="nameplate text-lg leading-tight">{entry.name}</p>
                  <p className="mt-0.5 text-sm text-white/70">{entry.charge}</p>
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-3 px-4 py-3 text-xs text-neutral-500">
                <span className="font-semibold tracking-[0.14em] uppercase">
                  Booked {formatBooked(entry.bookedOn)}
                </span>
                <span className="tabular-nums">{caseNumber(entry, i)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-neutral-400">
        All charges fictional. Everyone pictured is in on it. Want off the wall? Play better.
      </p>
    </section>
  );
}
