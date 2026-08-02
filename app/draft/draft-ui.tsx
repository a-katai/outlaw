import Link from "next/link";
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

export function RankBadge({ rank }: { rank: Player["rank"] }) {
  if (!rank) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
      R{rank}
    </span>
  );
}

/**
 * Quiet goalie-count hint — never a hard block (league rule unknown).
 * Neutral at 1, amber at 0 once the draft is past round 8, red at 2+.
 */
export function GoalieChip({ count, pastRound8 }: { count: number; pastRound8: boolean }) {
  const tone = count >= 2 ? "red" : count === 0 && pastRound8 ? "amber" : "quiet";
  const styles: Record<typeof tone, string> = {
    quiet: "border-black/10 bg-neutral-50 text-neutral-500",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styles[tone]}`}>
      G×{count}
    </span>
  );
}

/** Small quiet amber pill shown while last-good board data is being kept on-screen after a fetch error. */
export function ReconnectingPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Reconnecting…
    </span>
  );
}

/** Tiny neutral pill shown when realtime isn't confirmed subscribed (falling back to the 15s poll). */
export function PollingPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-500">
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
      Updating every 15s
    </span>
  );
}

/** Prominent status badge for the board header — visible at a glance from across the room. */
export function PausedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
      Paused
    </span>
  );
}

export function TeamRosterCard({
  team,
  picks,
  playerNameById,
  goalieCount,
  pastRound8,
}: {
  team: Team;
  picks: DraftPick[];
  playerNameById: Map<string, string>;
  goalieCount: number;
  pastRound8: boolean;
}) {
  const teamPicks = picks.filter((p) => p.team_id === team.id).sort((a, b) => a.pick_number - b.pick_number);
  return (
    <div className="glass-card rounded-3xl p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">{team.name}</h3>
        <span className="flex shrink-0 items-center gap-1.5">
          <GoalieChip count={goalieCount} pastRound8={pastRound8} />
          <span className="text-xs text-neutral-500">{teamPicks.length} picked</span>
        </span>
      </div>
      {teamPicks.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-500">No picks yet.</p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {teamPicks.map((pick) => (
            <li key={pick.id} className="flex items-baseline gap-2 text-sm text-neutral-700">
              <span className="w-6 shrink-0 text-xs font-medium text-neutral-400">R{pick.round}</span>
              <Link
                href={`/players/${pick.player_id}`}
                className="truncate transition hover:text-neutral-900 hover:underline hover:underline-offset-4"
              >
                {playerNameById.get(pick.player_id) ?? "Unknown player"}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
