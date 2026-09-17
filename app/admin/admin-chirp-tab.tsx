"use client";

import { useCallback, useEffect, useState } from "react";
import { chirpAge } from "@/lib/chirps";

type AdminChirp = { id: string; handle: string | null; body: string; hidden: boolean; createdAt: string };

/**
 * Chirp moderation. Hiding is the everyday lever — it pulls the chirp off the
 * home page but keeps the row, so a bad call can be put back. Delete is the
 * permanent one and stays confirm-gated.
 */
export function AdminChirpTab() {
  const [chirps, setChirps] = useState<AdminChirp[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/chirp");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data?.error === "string" ? data.error : "Could not load chirps.");
      setChirps([]);
      return;
    }
    setChirps(data.chirps ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, body: Record<string, unknown>) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/chirp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data?.error === "string" ? data.error : "That didn't work.");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (chirps === null) return <p className="text-sm text-neutral-500">Loading chirps…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">OHL Chirp</h2>
        <span className="text-xs text-neutral-500">{chirps.length} total</span>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {chirps.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing posted yet.</p>
      ) : (
        <ul className="divide-y divide-black/[0.07] border-y border-black/[0.07]">
          {chirps.map((chirp) => (
            <li key={chirp.id} className={`flex items-start gap-4 py-3 ${chirp.hidden ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-neutral-900">{chirp.handle ?? "Anonymous"}</span>
                  <span suppressHydrationWarning className="text-[11px] tabular-nums text-neutral-400">{chirpAge(chirp.createdAt)}</span>
                  {chirp.hidden ? (
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Hidden</span>
                  ) : null}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{chirp.body}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={busy === chirp.id}
                  onClick={() => act(chirp.id, { action: "set-hidden", hidden: !chirp.hidden })}
                  className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 disabled:opacity-40"
                >
                  {chirp.hidden ? "Restore" : "Hide"}
                </button>
                <button
                  type="button"
                  disabled={busy === chirp.id}
                  onClick={() => {
                    if (!confirm("Delete this chirp permanently?")) return;
                    void act(chirp.id, { action: "delete" });
                  }}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-400 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
