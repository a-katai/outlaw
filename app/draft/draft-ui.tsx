import type { Draft, DraftPick, Player, Team } from "@/lib/draft-types";

export function FormatBadge({ format }: { format: Draft["format"] }) {
  return (
    <span className="inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">
      {format === "snake" ? "Snake" : "Linear"}
    </span>
  );
}

export function StatusBadge({ status }: { status: Draft["status"] }) {
  const styles: Record<Draft["status"], string> = {
    setup: "border-black/10 bg-neutral-100 text-neutral-600",
    live: "border-emerald-200 bg-emerald-50 text-emerald-700",
    paused: "border-amber-200 bg-amber-50 text-amber-700",
    complete: "border-black/10 bg-neutral-100 text-neutral-600",
  };
  const label: Record<Draft["status"], string> = {
    setup: "Setup",
    live: "Live",
    paused: "Paused",
    complete: "Complete",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${styles[status]}`}>
      {label[status]}
    </span>
  );
}

export function PositionBadge({ position }: { position: Player["position"] }) {
  if (!position) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-black/10 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
      {position}
    </span>
  );
}

export function TeamRosterCard({
  team,
  picks,
  playerNameById,
}: {
  team: Team;
  picks: DraftPick[];
  playerNameById: Map<string, string>;
}) {
  const teamPicks = picks.filter((p) => p.team_id === team.id).sort((a, b) => a.pick_number - b.pick_number);
  return (
    <div className="glass-card rounded-3xl p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">{team.name}</h3>
        <span className="text-xs text-neutral-500">{teamPicks.length} picked</span>
      </div>
      {teamPicks.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-500">No picks yet.</p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {teamPicks.map((pick) => (
            <li key={pick.id} className="flex items-baseline gap-2 text-sm text-neutral-700">
              <span className="w-6 shrink-0 text-xs font-medium text-neutral-400">R{pick.round}</span>
              <span className="truncate">{playerNameById.get(pick.player_id) ?? "Unknown player"}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
