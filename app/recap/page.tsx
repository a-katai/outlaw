import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getRecapDates } from "@/lib/recap";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Wednesday Report — Outlaw Hockey League",
  description: "The weekly recap: finals, three stars, and milestones from every game night.",
};

export default async function RecapIndexPage() {
  const [latest] = await getRecapDates();
  if (latest) redirect(`/recap/${latest}`);
  return (
    <section className="space-y-8">
      <div className="glass-card rounded-3xl p-8 text-center md:p-12">
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">The Wednesday Report</p>
        <h1 className="mt-3 text-2xl font-semibold text-neutral-900">First report after the first final.</h1>
      </div>
    </section>
  );
}
