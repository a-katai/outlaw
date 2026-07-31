"use client";

import { Fragment, FormEvent, useMemo, useState } from "react";
import type { PaymentMethod } from "@/lib/draft-types";
import { AdminState, formatCents, postJSON } from "./admin-api";

const METHODS: PaymentMethod[] = ["cash", "venmo", "zelle", "card", "check", "other"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AdminPaymentsTab({ state, refetch }: { state: AdminState; refetch: () => Promise<void> }) {
  const { players, payments } = state;

  const [playerId, setPlayerId] = useState("");
  const [payerName, setPayerName] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [season, setSeason] = useState("Summer 2026");
  const [paidOn, setPaidOn] = useState(todayISO());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  const nameById = useMemo(() => new Map(players.map((p) => [p.id, p.name])), [players]);

  const totalCents = payments.reduce((sum, p) => sum + p.amount_cents, 0);
  const paidPlayerIds = new Set(payments.filter((p) => p.player_id).map((p) => p.player_id as string));

  const paymentsByPlayer = useMemo(() => {
    const map = new Map<string, typeof payments>();
    for (const p of payments) {
      if (!p.player_id) continue;
      const list = map.get(p.player_id) ?? [];
      list.push(p);
      map.set(p.player_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.paid_on < b.paid_on ? 1 : a.paid_on > b.paid_on ? -1 : 0));
    }
    return map;
  }, [payments]);

  const rollup = useMemo(() => {
    const byPlayer = new Map<string, number>();
    for (const p of payments) {
      if (!p.player_id) continue;
      byPlayer.set(p.player_id, (byPlayer.get(p.player_id) ?? 0) + p.amount_cents);
    }
    return players
      .map((p) => ({ id: p.id, name: p.name, totalCents: byPlayer.get(p.id) ?? 0, paid: byPlayer.has(p.id) }))
      .sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name));
  }, [players, payments]);

  const unmatchedPayments = useMemo(
    () => payments.filter((p) => !p.player_id).sort((a, b) => (a.paid_on < b.paid_on ? 1 : a.paid_on > b.paid_on ? -1 : 0)),
    [payments],
  );

  const addPayment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const amountCents = Math.round(Number(amount) * 100);
    const data = await postJSON<{ ok: boolean; error?: string }>("/api/admin/payments", {
      action: "add",
      playerId: playerId || null,
      payerName: playerId ? null : payerName,
      amountCents,
      method,
      season,
      paidOn,
      note,
    });
    setBusy(false);
    if (!data.ok) return setError(data.error ?? "Couldn't add payment");
    setAmount("");
    setPayerName("");
    setNote("");
    await refetch();
  };

  const deletePayment = async (id: string) => {
    await postJSON("/api/admin/payments", { action: "delete", id });
    setConfirmDeleteId(null);
    await refetch();
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass-card rounded-3xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Collected this season</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-900">{formatCents(totalCents)}</p>
        </div>
        <div className="glass-card rounded-3xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Players paid</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-900">
            {paidPlayerIds.size} <span className="text-lg font-normal text-neutral-500">/ {players.length}</span>
          </p>
        </div>
      </div>

      <form onSubmit={addPayment} className="glass-card space-y-4 rounded-3xl p-6 md:p-8">
        <h2 className="text-xl font-semibold text-neutral-900">Add payment</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Player</span>
            <select
              className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
            >
              <option value="">— Free-text payer —</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {!playerId ? (
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-neutral-700">Payer name</span>
              <input
                className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Name"
              />
            </label>
          ) : null}
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Amount (USD)</span>
            <input
              inputMode="decimal"
              className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="45.00"
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Method</span>
            <select
              className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m[0].toUpperCase() + m.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Season</span>
            <input
              className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Paid on</span>
            <input
              type="date"
              className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-2 lg:col-span-3">
            <span className="font-medium text-neutral-700">Note</span>
            <input
              className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>
        {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add payment"}
        </button>
      </form>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-neutral-900">Ledger</h2>
          <a
            href="/api/admin/payments/csv"
            className="text-sm font-medium text-neutral-600 underline underline-offset-4 transition hover:text-neutral-900"
          >
            Export CSV
          </a>
        </div>
        <div className="glass-card mt-4 overflow-x-auto rounded-3xl">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-neutral-50/90 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Payer</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Season</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-neutral-500">
                    No payments recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-t border-black/5 text-neutral-700">
                    <td className="px-4 py-3">{p.paid_on}</td>
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {p.player_id ? nameById.get(p.player_id) ?? "Unknown player" : p.payer_name}
                    </td>
                    <td className="px-4 py-3 font-semibold text-neutral-900">{formatCents(p.amount_cents)}</td>
                    <td className="px-4 py-3 capitalize">{p.method}</td>
                    <td className="px-4 py-3">{p.season ?? "—"}</td>
                    <td className="px-4 py-3 text-neutral-500">{p.note ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {confirmDeleteId === p.id ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => deletePayment(p.id)}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(p.id)}
                          className="text-xs font-medium text-neutral-500 hover:text-rose-600"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Per-player rollup</h2>
        <div className="glass-card mt-4 max-h-96 overflow-y-auto rounded-3xl">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-neutral-50/95 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Total paid</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rollup.map((r) => {
                const history = paymentsByPlayer.get(r.id) ?? [];
                const expanded = expandedPlayerId === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr className="border-t border-black/5 text-neutral-700">
                      <td className="px-4 py-3 font-medium text-neutral-900">{r.name}</td>
                      <td className="px-4 py-3">{formatCents(r.totalCents)}</td>
                      <td className="px-4 py-3">
                        {r.paid ? (
                          <span className="text-xs font-semibold text-emerald-700">Paid</span>
                        ) : (
                          <span className="text-xs font-semibold text-rose-600">Unpaid</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {history.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setExpandedPlayerId(expanded ? null : r.id)}
                            className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
                          >
                            {expanded ? "Hide" : `Details (${history.length})`}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-t border-black/5 bg-neutral-50/70">
                        <td colSpan={4} className="px-4 py-3">
                          <table className="w-full text-left text-xs">
                            <thead className="text-neutral-500">
                              <tr>
                                <th className="py-1 pr-4 font-medium uppercase tracking-wide">Date</th>
                                <th className="py-1 pr-4 font-medium uppercase tracking-wide">Amount</th>
                                <th className="py-1 pr-4 font-medium uppercase tracking-wide">Method</th>
                                <th className="py-1 font-medium uppercase tracking-wide">Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {history.map((p) => (
                                <tr key={p.id} className="border-t border-black/5 text-neutral-700">
                                  <td className="py-1.5 pr-4">{p.paid_on}</td>
                                  <td className="py-1.5 pr-4 font-medium text-neutral-900">
                                    {formatCents(p.amount_cents)}
                                  </td>
                                  <td className="py-1.5 pr-4 capitalize">{p.method}</td>
                                  <td className="py-1.5 text-neutral-500">{p.note ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {unmatchedPayments.length > 0 ? (
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Unmatched payments</h2>
          <p className="mt-1 text-sm text-neutral-500">Free-text payers not tied to a roster player.</p>
          <div className="glass-card mt-4 overflow-x-auto rounded-3xl">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-neutral-50/90 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Payer</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {unmatchedPayments.map((p) => (
                  <tr key={p.id} className="border-t border-black/5 text-neutral-700">
                    <td className="px-4 py-3">{p.paid_on}</td>
                    <td className="px-4 py-3 font-medium text-neutral-900">{p.payer_name ?? "Unknown"}</td>
                    <td className="px-4 py-3 font-semibold text-neutral-900">{formatCents(p.amount_cents)}</td>
                    <td className="px-4 py-3 capitalize">{p.method}</td>
                    <td className="px-4 py-3 text-neutral-500">{p.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
