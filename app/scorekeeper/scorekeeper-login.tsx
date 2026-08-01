"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function ScorekeeperLogin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/scorekeeper/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Invalid code");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-sm space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">League Hub</p>
        <h1 className="mt-2 text-4xl font-semibold text-neutral-900">Scorekeeper</h1>
        <p className="mt-3 text-sm text-neutral-600">Enter the rink code to log live goals.</p>
      </div>
      <form onSubmit={submit} className="glass-card space-y-4 rounded-3xl p-6 md:p-8">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Access code</span>
          <input
            className="min-w-0 rounded-xl border border-black/10 bg-white px-4 py-4 text-center text-2xl font-semibold uppercase tracking-[0.3em] outline-none ring-blue-500/30 transition focus:ring-4"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            autoComplete="off"
            autoFocus
            required
          />
        </label>
        {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-neutral-900 px-4 py-4 text-base font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {submitting ? "Checking…" : "Continue"}
        </button>
      </form>
    </section>
  );
}
