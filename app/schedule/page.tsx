import Link from "next/link";

export default function SchedulePage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">League Hub</p>
        <h1 className="mt-2 text-4xl font-semibold text-neutral-900">Schedule</h1>
        <p className="mt-3 text-neutral-600">The 2026–27 schedule lands after the draft.</p>
      </div>

      <div className="glass-card rounded-3xl p-8 text-center md:p-12">
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Coming soon</p>
        <h2 className="mt-3 text-2xl font-semibold text-neutral-900">Teams first, then games.</h2>
        <p className="mx-auto mt-3 max-w-md text-neutral-600">
          Once the draft sets the rosters, the schedule posts here.
        </p>
        <Link
          href="/draft"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-black"
        >
          Go to the draft
        </Link>
      </div>
    </section>
  );
}
