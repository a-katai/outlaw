import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Not found — Outlaw Hockey League",
  description: "This game doesn't exist or the link is wrong.",
};

export default function GameNotFound() {
  return (
    <section className="space-y-8">
      <div className="glass-card rounded-3xl p-8 text-center md:p-12">
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Not found</p>
        <h1 className="mt-3 text-2xl font-semibold text-neutral-900">That game doesn&apos;t exist.</h1>
        <p className="mx-auto mt-3 max-w-md text-neutral-600">It may have been deleted, or the link is wrong.</p>
        <Link
          href="/schedule"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-black"
        >
          Back to schedule
        </Link>
      </div>
    </section>
  );
}
