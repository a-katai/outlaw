"use client";

import { useState } from "react";

export type RosterPlayer = { id: string; name: string; dressed: boolean; jersey: number | null };
/** subRank = position in the paid sub line (1 = first call); null for unpaid subs and non-subs. */
export type PoolPlayer = { id: string; name: string; jersey: number | null; isSub: boolean; subRank: number | null };

/** Paid subs first, in line order; then the rest A–Z. */
export function sortSubs<T extends PoolPlayer>(subs: T[]): T[] {
  return [...subs].sort((a, b) => {
    if (a.subRank != null && b.subRank != null) return a.subRank - b.subRank;
    if (a.subRank != null) return -1;
    if (b.subRank != null) return 1;
    return a.name.localeCompare(b.name);
  });
}

/** "#55 Tony Katai" when a number is claimed; the bare name otherwise. */
export const label = (p: { name: string; jersey: number | null }) => (p.jersey == null ? p.name : `#${p.jersey} ${p.name}`);

export function authHeaders(code: string | null, teamCode: string | null = null): HeadersInit {
  const h: Record<string, string> = {};
  if (code) h["x-scorekeeper-code"] = code;
  if (teamCode) h["x-team-code"] = teamCode;
  return h;
}

/** One team's lineup for one game: tap to dress, pull from the pool, or add a name that isn't in the system yet. */
export function LineupColumn({
  teamName,
  roster,
  pool,
  busy,
  onToggle,
  onAddNew,
}: {
  teamName: string;
  roster: RosterPlayer[];
  pool: PoolPlayer[];
  busy: boolean;
  onToggle: (playerId: string, dressed: boolean) => void;
  onAddNew: (name: string) => Promise<boolean>;
}) {
  const [addId, setAddId] = useState("");
  const [newName, setNewName] = useState("");
  const dressed = roster.filter((p) => p.dressed).length;

  return (
    <div className="glass-card rounded-3xl p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
        {teamName} · {dressed} dressed
      </p>
      <div className="mt-3 space-y-1.5">
        {roster.length === 0 ? (
          <p className="text-sm text-neutral-500">No roster yet.</p>
        ) : (
          roster.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={busy}
              onClick={() => onToggle(p.id, !p.dressed)}
              className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:opacity-50 ${
                p.dressed
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-black/10 bg-white text-neutral-600"
              }`}
            >
              <span>
                {p.jersey != null ? <span className="mr-2 font-semibold tabular-nums text-neutral-500">#{p.jersey}</span> : null}
                {p.name}
              </span>
              <span className="text-xs font-semibold">{p.dressed ? "Dressed" : "Tap to dress"}</span>
            </button>
          ))
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <select
          value={addId}
          onChange={(e) => setAddId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-2 py-2 text-sm outline-none ring-blue-500/30 focus:ring-4"
        >
          <option value="">Add player…</option>
          {pool.some((p) => p.isSub) ? (
            <optgroup label="Subs · paid first">
              {sortSubs(pool.filter((p) => p.isSub)).map((p) => (
                <option key={p.id} value={p.id}>
                  {label(p)}
                  {p.subRank != null ? ` · paid #${p.subRank}` : ""}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="Rostered elsewhere">
            {pool
              .filter((p) => !p.isSub)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {label(p)}
                </option>
              ))}
          </optgroup>
        </select>
        <button
          type="button"
          disabled={!addId || busy}
          onClick={() => {
            onToggle(addId, true);
            setAddId("");
          }}
          className="shrink-0 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
        >
          Add
        </button>
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const name = newName.trim();
          if (!name) return;
          const ok = await onAddNew(name);
          if (ok) setNewName("");
        }}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Not listed? Type a name"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-2 py-2 text-sm outline-none ring-blue-500/30 focus:ring-4"
        />
        <button
          type="submit"
          disabled={!newName.trim() || busy}
          className="shrink-0 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
        >
          Add new
        </button>
      </form>
    </div>
  );
}
