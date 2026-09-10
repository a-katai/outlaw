import type { GoalEventLine } from "@/lib/live-season";
import { periodLabel } from "@/lib/periods";

/** Goal-by-goal for a game page, grouped by period when periods were recorded. Renders nothing when empty. */
export function GoalList({ goals }: { goals: GoalEventLine[] }) {
  if (goals.length === 0) return null;
  const groups: { label: string | null; goals: GoalEventLine[] }[] = [];
  for (const g of goals) {
    const label = periodLabel(g.period);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.goals.push(g);
    else groups.push({ label, goals: [g] });
  }
  let ordinal = 0;
  return (
    <div>
      <h2 className="text-2xl font-semibold text-neutral-900">Scoring</h2>
      <div className="glass-card mt-4 overflow-hidden rounded-3xl">
        {groups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "border-t border-black/5" : undefined}>
            {group.label ? (
              <p className="bg-black/[0.03] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                {group.label} period
              </p>
            ) : null}
            <div className="divide-y divide-black/5">
              {group.goals.map((g) => {
                ordinal += 1;
                return (
                  <div key={g.id} className="flex items-center gap-4 px-5 py-4">
                    <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-neutral-400">{ordinal}</span>
                    <div>
                      <p className="font-semibold text-neutral-900">
                        {g.teamName} · {g.scorerName ?? "Unknown"}
                      </p>
                      {g.assistName ? (
                        <p className="text-sm text-neutral-500">
                          {g.assist2Name ? "Assists" : "Assist"}: {g.assistName}
                          {g.assist2Name ? `, ${g.assist2Name}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
