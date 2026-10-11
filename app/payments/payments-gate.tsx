"use client";

import { FormEvent, useState } from "react";

/** Stands in for the card form until this device enters the league's payment password. */
export function PaymentsGate() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Wrong password");
        return;
      }
      window.location.reload();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass-card h-fit space-y-4 rounded-3xl p-6 md:p-8">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Members only</h2>
        <p className="mt-2 text-sm text-neutral-600">Enter the league password to pay by card.</p>
      </div>
      <input
        aria-label="League password"
        className="w-full min-w-0 rounded-xl border border-black/10 bg-white px-4 py-4 text-center text-2xl font-semibold uppercase tracking-[0.3em] outline-none ring-blue-500/30 transition focus:ring-4"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="••••••"
        maxLength={12}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        required
      />
      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting || !code.trim()}
        className="w-full rounded-full bg-neutral-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-40"
      >
        {submitting ? "Checking…" : "Continue"}
      </button>
      <p className="text-xs text-neutral-500">Ask your captain or the commissioner for the password.</p>
    </form>
  );
}
