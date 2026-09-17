"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ShameEntry } from "@/app/shame/entries";

function formatBooked(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The placard line — the name on the full wall, the team everywhere else. */
function placard(entry: ShameEntry): string {
  return entry.name ?? entry.team ?? "Booked";
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
          alt={`Wall of Shame card — ${entry.charge}`}
          fill
          sizes="(min-width: 1024px) 240px, (min-width: 640px) 33vw, 45vw"
          className="object-cover"
          priority={priority}
        />
        <div className="absolute inset-x-0 bottom-0 bg-neutral-900/92 px-3 py-2 text-white backdrop-blur-sm">
          <p className="nameplate text-sm leading-tight">{placard(entry)}</p>
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

/**
 * The enlarged view. The cards crop to a booking-photo shape, but the evidence
 * is often a full sheet, so here it gets the whole frame uncropped. On a phone
 * that sheet is taller than the screen — the dialog scrolls and the image runs
 * full width so the small print is actually readable; on a wide screen it
 * fits to the viewport instead.
 */
function ShameModal({ entry, onClose }: { entry: ShameEntry; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Wall of Shame — ${entry.charge}`}
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-neutral-950/90 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="fixed top-4 right-4 z-10 rounded-full bg-white/15 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
      >
        Close
      </button>

      <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-8">
        <figure
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl space-y-4"
        >
          <div className="relative mx-auto w-full">
            {/* The full sheet is a big file; hold its shape so the dialog
                doesn't open as an empty box while it lands. */}
            {loaded ? null : (
              <div className="mx-auto aspect-[2/3] w-full animate-pulse rounded-xl bg-white/10 sm:max-h-[80vh]" />
            )}
            <Image
              src={`/shame/${entry.id}.jpg`}
              alt={`Wall of Shame card — ${entry.charge}`}
              width={1024}
              height={1536}
              sizes="(min-width: 768px) 768px, 100vw"
              priority
              onLoad={() => setLoaded(true)}
              className={`mx-auto h-auto w-full rounded-xl transition-opacity duration-200 sm:max-h-[80vh] sm:w-auto sm:max-w-full ${
                loaded ? "opacity-100" : "absolute inset-0 opacity-0"
              }`}
            />
          </div>
          <figcaption className="pb-2 text-center">
            <p className="nameplate text-lg text-white">{placard(entry)}</p>
            <p className="mt-1 text-sm text-white/70">{entry.charge}</p>
            <p className="mt-2 text-[11px] font-semibold tracking-[0.14em] text-white/40 uppercase">
              Week {entry.week} · {formatBooked(entry.bookedOn)}
            </p>
          </figcaption>
        </figure>
      </div>
    </div>
  );
}

/** The wall itself — newest first, flowing left to right as the weeks stack up. */
export function ShameWall({ entries }: { entries: ShameEntry[] }) {
  const [open, setOpen] = useState<ShameEntry | null>(null);
  return (
    <>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {entries.map((entry, i) => (
          <li key={`${entry.week}-${entry.id}`}>
            <button
              type="button"
              onClick={() => setOpen(entry)}
              aria-label={`Enlarge: ${entry.charge}`}
              className="block w-full cursor-zoom-in text-left"
            >
              <ShameCard entry={entry} priority={i === 0} />
            </button>
          </li>
        ))}
      </ul>
      {open ? <ShameModal entry={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
