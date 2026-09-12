import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase-admin";
import { SUB_CHIPS, SUB_FEE_CENTS } from "@/lib/dues";
import { getActiveSeasonLive } from "@/lib/live-season";
import { getSubLine } from "@/lib/sub-line";
import { PaymentsForm } from "@/app/payments/payments-form";

export const metadata: Metadata = {
  title: "Sub Fees | Outlaw Hockey League",
  description: "Pay your sub fee and move to the front of the line.",
};

// The line changes with every payment — never bake it into a static build.
export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const EMPTY = { gamesPlayed: 0, goals: 0, assists: 0, points: 0, pim: 0 };

export default async function SubsPage() {
  const supabase = createAdminClient();
  const [line, subsRes, season] = await Promise.all([
    getSubLine(),
    supabase.from("players").select("id, name").eq("is_sub", true).order("name", { ascending: true }),
    getActiveSeasonLive(),
  ]);

  const players = (subsRes.data ?? []).map((p) => ({ id: p.id as string, name: p.name as string }));
  const publicToken = process.env.CLOVER_PUBLIC_TOKEN ?? "";
  const statsById = new Map((season?.subs ?? []).map((s) => [s.playerId, s]));
  const fee = SUB_FEE_CENTS / 100;
  const paidCount = line.filter((s) => s.paid).length;

  const paidRows = line.filter((s) => s.paid).map((s, i) => ({ ...s, place: i + 1 as number | null }));
  const waitingRows = line
    .filter((s) => !s.paid)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || a.name.localeCompare(b.name))
    .map((s) => ({ ...s, place: null as number | null }));
  const rows = [...paidRows, ...waitingRows].map((s) => ({
    ...s,
    stats: (s.playerId && statsById.get(s.playerId)) || EMPTY,
  }));

  return (
    <section className="space-y-10">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">League Hub</p>
        <h1 className="mt-2 text-4xl font-semibold text-neutral-900">Sub Fees</h1>
        <p className="mt-3 text-neutral-600">Pay ahead and skip the line. Paid subs get the first call, in the order they paid.</p>
        <p className="mt-1 text-sm text-neutral-500">${fee} per game. Separate from league dues.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.35fr_1fr]">
        <PaymentsForm
          publicToken={publicToken}
          players={players}
          kind="sub"
          chips={SUB_CHIPS}
          title="Pay a Sub Fee"
          namePlaceholder="Your name"
          amountPlaceholder={fee.toFixed(2)}
          receiptNote="You're in the paid line."
        />

        <aside className="glass-card h-fit rounded-3xl p-6 md:p-8">
          <h2 className="text-xl font-semibold text-neutral-900">Cash at the Rink</h2>
          <p className="mt-3 text-sm text-neutral-600">
            Cash works too. Your spot in the line starts when the league logs it.
          </p>
        </aside>
      </div>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold text-neutral-900">The Line</h2>
          <p className="text-sm text-neutral-500">
            {line.length} {line.length === 1 ? "sub" : "subs"} · {paidCount} paid · managers call from the top
          </p>
        </div>

        {line.length === 0 ? (
          <div className="glass-card mt-4 rounded-3xl p-8 text-center text-sm text-neutral-500">Nobody yet. Pay a fee to be first.</div>
        ) : (
          <div className="glass-card mt-4 overflow-x-auto rounded-3xl">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-neutral-50/90 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 w-10">#</th>
                  <th className="px-4 py-3">Sub</th>
                  <th className="px-3 py-3">Pos</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-3 py-3 text-right">GP</th>
                  <th className="px-3 py-3 text-right">G</th>
                  <th className="px-3 py-3 text-right">A</th>
                  <th className="px-3 py-3 text-right">PTS</th>
                  <th className="px-4 py-3 text-right">PIM</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.key} className={`border-t border-black/5 ${s.paid ? "text-neutral-700" : "text-neutral-500"}`}>
                    <td className="px-4 py-3 tabular-nums text-neutral-400">{s.place ?? "·"}</td>
                    <td className={`px-4 py-3 font-medium ${s.paid ? "text-neutral-900" : "text-neutral-600"}`}>
                      {s.playerId ? (
                        <Link href={`/players/${s.playerId}`} className="transition hover:text-neutral-900">
                          {s.name}
                        </Link>
                      ) : (
                        s.name
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-neutral-400">{s.position ?? ""}</td>
                    <td className="px-4 py-3 text-xs font-medium">
                      {s.paid ? (
                        <span className="text-emerald-700">Paid{s.firstPaidOn ? ` · ${formatDate(s.firstPaidOn)}` : ""}</span>
                      ) : (
                        <span className="text-neutral-400">Waiting</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{s.stats.gamesPlayed}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{s.stats.goals}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{s.stats.assists}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-neutral-900">{s.stats.points}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.stats.pim}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-neutral-500">Stats count games dressed for a team that didn&rsquo;t draft you.</p>
      </div>
    </section>
  );
}
