"use client";

import { useState } from "react";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Final games only. Fetches this game's own opengraph-image as a PNG blob,
 * then shares it (mobile, when the Web Share API supports file attachments)
 * or falls back to a plain download — no server round-trip beyond the image
 * route that already exists for link previews.
 */
export function ShareScoreButton({ gameId, awayTeam, homeTeam }: { gameId: string; awayTeam: string; homeTeam: string }) {
  const [busy, setBusy] = useState(false);

  async function handleShare() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/games/${gameId}/opengraph-image`);
      const blob = await res.blob();
      const filename = `${slugify(awayTeam)}-at-${slugify(homeTeam)}-final.png`;
      const file = new File([blob], filename, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${awayTeam} at ${homeTeam} — Final` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch {
      // User cancelled the share sheet, or the fetch failed — quiet no-op,
      // nothing else on the page depends on this succeeding.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs font-medium text-neutral-600 shadow-sm transition hover:bg-white hover:text-neutral-900 disabled:opacity-50"
    >
      {busy ? "Preparing…" : "Share score"}
    </button>
  );
}
