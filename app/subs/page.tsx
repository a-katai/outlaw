import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase-admin";
import { SUB_CHIPS, SUB_FEE_CENTS } from "@/lib/dues";
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

export default async function SubsPage() {
  const supabase = createAdminClient();
  const [line, subsRes] = await Promise.all([
    getSubLine(),
    supabase.from("players").select("id, name").eq("is_sub", true).order("name", { ascending: true }),
  ]);

  const players = (subsRes.data ?? []).map((p) => ({ id: p.id as string, name: p.name as string }));
  const publicToken = process.env.CLOVER_PUBLIC_TOKEN ?? "";
  const paid = line.filter((s) => s.paid);
  const waiting = line.filter((s) => !s.paid);
  const fee = SUB_FEE_CENTS / 100;

  return (
    <section className="space-y-8">
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

        <div className="space-y-6">
          <aside className="glass-card rounded-3xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-neutral-900">The Line</h2>
            <p className="mt-1 text-sm text-neutral-500">Managers call from the top.</p>

            {line.length === 0 ? (
              <p className="mt-6 text-sm text-neutral-500">Nobody yet. Pay a fee to be first.</p>
            ) : (
              <ol className="mt-6 divide-y divide-black/[0.07]">
                {paid.map((s, i) => (
                  <li key={s.key} className="flex items-baseline justify-between gap-4 py-3">
                    <span className="flex items-baseline gap-3">
                      <span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-neutral-400">{i + 1}</span>
                      <span className="font-medium text-neutral-900">{s.name}</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-emerald-700">
                      Paid{s.firstPaidOn ? ` · ${formatDate(s.firstPaidOn)}` : ""}
                    </span>
                  </li>
                ))}
                {waiting.map((s) => (
                  <li key={s.key} className="flex items-baseline justify-between gap-4 py-3">
                    <span className="flex items-baseline gap-3">
                      <span className="w-5 shrink-0 text-xs text-neutral-300">·</span>
                      <span className="text-neutral-600">{s.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-neutral-400">Waiting</span>
                  </li>
                ))}
              </ol>
            )}
          </aside>

          <aside className="glass-card rounded-3xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-neutral-900">Cash at the Rink</h2>
            <p className="mt-3 text-sm text-neutral-600">
              Cash works too. Your spot in the line starts when the league logs it.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
