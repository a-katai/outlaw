import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase-admin";
import { PaymentsForm } from "./payments-form";

export const metadata: Metadata = {
  title: "League Dues | Outlaw Hockey League",
  description: "Pay your Outlaw Hockey League dues by card.",
};

// Keep the player list live (players are added via /admin over the season) —
// a static build would bake in whatever roster existed at deploy time.
export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("players")
    .select("id, name")
    .order("name", { ascending: true });

  const players = (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
  }));

  const publicToken = process.env.CLOVER_PUBLIC_TOKEN ?? "";

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">League Hub</p>
        <h1 className="mt-2 text-4xl font-semibold text-neutral-900">League Dues</h1>
        <p className="mt-3 text-neutral-600">Pay your dues by card. Payments are recorded automatically.</p>
        <p className="mt-1 text-sm text-neutral-500">
          Fall season: $150 deposit due August 10. Skaters $650, goalies $100.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.35fr_1fr]">
        <PaymentsForm publicToken={publicToken} players={players} />

        <aside className="glass-card h-fit rounded-3xl p-6 md:p-8">
          <h2 className="text-xl font-semibold text-neutral-900">Cash or Check</h2>
          <p className="mt-3 text-sm text-neutral-600">
            Prefer cash or a check? Bring it to the rink — the league logs it for you.
          </p>
        </aside>
      </div>
    </section>
  );
}
