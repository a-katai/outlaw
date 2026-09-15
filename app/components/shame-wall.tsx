import Image from "next/image";
import type { ShameEntry } from "@/app/shame/entries";

function formatBooked(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * One booking card: the photo, a black placard across the bottom carrying the
 * name and the charge, and the week it was earned. Sized by its column, so
 * the same card works in the home strip and on the full wall.
 */
export function ShameCard({ entry, priority }: { entry: ShameEntry; priority?: boolean }) {
  return (
    <div className="glass-card lift overflow-hidden rounded-2xl">
      <div className="relative aspect-[3/4] bg-neutral-200">
        <Image
          src={`/shame/${entry.id}.jpg`}
          alt={`Booking photo of ${entry.name}`}
          fill
          sizes="(min-width: 1024px) 240px, (min-width: 640px) 33vw, 45vw"
          className="object-cover"
          priority={priority}
        />
        <div className="absolute inset-x-0 bottom-0 bg-neutral-900/92 px-3 py-2 text-white backdrop-blur-sm">
          <p className="nameplate text-sm leading-tight">{entry.name}</p>
          <p className="mt-0.5 text-xs leading-snug text-white/70">{entry.charge}</p>
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2 px-3 py-2 text-[11px] text-neutral-500">
        <span className="font-semibold tracking-[0.14em] uppercase">Week {entry.week}</span>
        <span className="tabular-nums text-neutral-400">{formatBooked(entry.bookedOn)}</span>
      </div>
    </div>
  );
}

/** The wall itself — newest first, flowing left to right as the weeks stack up. */
export function ShameWall({ entries }: { entries: ShameEntry[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {entries.map((entry, i) => (
        <li key={`${entry.week}-${entry.id}`}>
          <ShameCard entry={entry} priority={i === 0} />
        </li>
      ))}
    </ul>
  );
}
