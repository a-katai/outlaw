import type { PenaltyEventLine } from "@/lib/live-season";

/** Penalty log for a game page — same card language as the goal feed. Renders nothing when empty. */
export function PenaltyList({ penalties }: { penalties: PenaltyEventLine[] }) {
  if (penalties.length === 0) return null;
  return (
    <div>
      <h2 className="text-2xl font-semibold text-neutral-900">Penalties</h2>
      <div className="glass-card mt-4 divide-y divide-black/5 overflow-hidden rounded-3xl">
        {penalties.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="font-semibold text-neutral-900">
                {p.teamName} · {p.playerName ?? "Bench"}
              </p>
              <p className="text-sm text-neutral-500">{p.infraction}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-500">{p.minutes} min</span>
          </div>
        ))}
      </div>
    </div>
  );
}
