"use client";

import { Fragment, FormEvent, useMemo, useState } from "react";
import type { Payment, PaymentMethod, Player } from "@/lib/draft-types";
import { confidenceLabel, suggestPlayers } from "@/lib/name-match";
import { AdminState, formatCents, postJSON } from "./admin-api";

const METHODS: PaymentMethod[] = ["cash", "venmo", "zelle", "card", "check", "other"];

// Fall 2026 dues: $150 deposit due Aug 10 to hold a spot; full cost is $650
// skater / $100 goalie, with the deposit counting toward the total. A goalie's
// full cost ($100) IS their deposit milestone — there's no separate goalie
// deposit amount, so "deposit paid" for a goalie means paid-in-full.
const DEPOSIT_CENTS = 15000;
const GOALIE_TARGET_CENTS = 10000;
const SKATER_TARGET_CENTS = 65000;

function isGoalie(position: Player["position"]): boolean {
  return position === "G";
}

function targetCents(position: Player["position"]): number {
  return isGoalie(position) ? GOALIE_TARGET_CENTS : SKATER_TARGET_CENTS;
}

function depositThresholdCents(position: Player["position"]): number {
  return isGoalie(position) ? GOALIE_TARGET_CENTS : DEPOSIT_CENTS;
}

type DuesRow = {
  player: Player;
  paidCents: number;
  depositMet: boolean;
  balanceCents: number;
  paidInFull: boolean;
  paymentCount: number;
};

function buildDuesBoard(players: Player[], payments: Payment[]): DuesRow[] {
  const byPlayer = new Map<string, { totalCents: number; count: number }>();
  for (const p of payments) {
    if (!p.player_id) continue;
    const entry = byPlayer.get(p.player_id) ?? { totalCents: 0, count: 0 };
    entry.totalCents += p.amount_cents;
    entry.count += 1;
    byPlayer.set(p.player_id, entry);
  }

  return players.map((player) => {
    const entry = byPlayer.get(player.id);
    const paidCents = entry?.totalCents ?? 0;
    const target = targetCents(player.position);
    const balanceCents = Math.max(0, target - paidCents);
    return {
      player,
      paidCents,
      depositMet: paidCents >= depositThresholdCents(player.position),
      balanceCents,
      paidInFull: paidCents >= target,
      paymentCount: entry?.count ?? 0,
    };
  });
}

function sortDuesBoard(rows: DuesRow[]): DuesRow[] {
  // Chase list for Aug 10: unpaid-deposit players first, then partial
  // (deposit met but not paid in full), then paid-in-full — alphabetical
  // within each bucket.
  const bucket = (r: DuesRow) => (r.paidInFull ? 2 : r.depositMet ? 1 : 0);
  return [...rows].sort((a, b) => bucket(a) - bucket(b) || a.player.name.localeCompare(b.player.name));
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadDuesCsv(rows: DuesRow[]): void {
  const header = ["Name", "Position", "Paid", "Deposit", "Balance"];
  const csvRows = rows.map((r) => [
    r.player.name,
    r.player.position ?? "",
    (r.paidCents / 100).toFixed(2),
    r.depositMet ? "Y" : "N",
    (r.balanceCents / 100).toFixed(2),
  ]);
  const csv = [header, ...csvRows].map((row) => row.map((cell) => csvCell(String(cell))).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "outlaw-fall-2026-dues.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AdminPaymentsTab({ state, refetch }: { state: AdminState; refetch: () => Promise<void> }) {
  const { players, payments } = state;

  const [playerId, setPlayerId] = useState("");
  const [payerName, setPayerName] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [season, setSeason] = useState("Fall 2026");
  const [paidOn, setPaidOn] = useState(todayISO());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [duesSearch, setDuesSearch] = useState("");
  const [linkSelections, setLinkSelections] = useState<Record<string, string>>({});
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);

  const nameById = useMemo(() => new Map(players.map((p) => [p.id, p.name])), [players]);
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => a.name.localeCompare(b.name)), [players]);

  const totalCents = payments.reduce((sum, p) => sum + p.amount_cents, 0);

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

  const duesBoard = useMemo(() => buildDuesBoard(players, payments), [players, payments]);

  const duesSummary = useMemo(() => {
    const depositsIn = duesBoard.filter((r) => r.depositMet).length;
    const paidInFull = duesBoard.filter((r) => r.paidInFull).length;
    const outstandingCents = duesBoard.reduce((sum, r) => sum + r.balanceCents, 0);
    return { depositsIn, paidInFull, outstandingCents };
  }, [duesBoard]);

  const visibleDuesRows = useMemo(() => {
    const q = duesSearch.trim().toLowerCase();
    const filtered = q ? duesBoard.filter((r) => r.player.name.toLowerCase().includes(q)) : duesBoard;
    return sortDuesBoard(filtered);
  }, [duesBoard, duesSearch]);

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

  const linkPayment = async (paymentId: string, playerId: string) => {
    if (!playerId) return setError("Choose a player to link");
    setLinkBusyId(paymentId);
    setError(null);
    const data = await postJSON<{ ok: boolean; error?: string }>("/api/admin/payments", {
      action: "link",
      paymentId,
      playerId,
    });
    setLinkBusyId(null);
    if (!data.ok) return setError(data.error ?? "Couldn't link payment");
    setLinkSelections((prev) => {
      const next = { ...prev };
      delete next[paymentId];
      return next;
    });
    await refetch();
  };

  const unlinkPayment = async (paymentId: string) => {
    setLinkBusyId(paymentId);
    setError(null);
    const data = await postJSON<{ ok: boolean; error?: string }>("/api/admin/payments", {
      action: "unlink",
      paymentId,
    });
    setLinkBusyId(null);
    if (!data.ok) return setError(data.error ?? "Couldn't unlink payment");
    await refetch();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Fall 2026 dues</h1>
        <p className="mt-1 text-sm text-neutral-500">$150 deposit due August 10 · $650 skater / $100 goalie full cost.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card rounded-3xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Total collected</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-900">{formatCents(totalCents)}</p>
        </div>
        <div className="glass-card rounded-3xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Deposits in</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-900">
            {duesSummary.depositsIn} <span className="text-lg font-normal text-neutral-500">/ {players.length}</span>
          </p>
        </div>
        <div className="glass-card rounded-3xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Paid in full</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-900">
            {duesSummary.paidInFull} <span className="text-lg font-normal text-neutral-500">/ {players.length}</span>
          </p>
        </div>
        <div className="glass-card rounded-3xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Outstanding</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-900">{formatCents(duesSummary.outstandingCents)}</p>
        </div>
      </div>
      <p className="-mt-4 text-xs text-neutral-500">All recorded payments count toward fall dues.</p>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-neutral-900">Dues board</h2>
          <div className="flex items-center gap-3">
            <input
              type="search"
              value={duesSearch}
              onChange={(e) => setDuesSearch(e.target.value)}
              placeholder="Search name…"
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
            />
            <button
              type="button"
              onClick={() => downloadDuesCsv(visibleDuesRows)}
              className="text-sm font-medium text-neutral-600 underline underline-offset-4 transition hover:text-neutral-900"
            >
              Export CSV
            </button>
          </div>
        </div>
        <div className="glass-card mt-4 max-h-[32rem] overflow-y-auto rounded-3xl">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-neutral-50/95 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Paid to date</th>
                <th className="px-4 py-3">Deposit</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Payments</th>
              </tr>
            </thead>
            <tbody>
              {visibleDuesRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    No players match “{duesSearch}”.
                  </td>
                </tr>
              ) : (
                visibleDuesRows.map((r) => {
                  const history = paymentsByPlayer.get(r.player.id) ?? [];
                  const expanded = expandedPlayerId === r.player.id;
                  return (
                    <Fragment key={r.player.id}>
                      <tr className="border-t border-black/5 text-neutral-700">
                        <td className="px-4 py-3">
                          <span className="font-medium text-neutral-900">{r.player.name}</span>
                          <span className="ml-2 inline-flex gap-1 align-middle">
                            {r.player.position ? (
                              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                                {r.player.position}
                              </span>
                            ) : null}
                            {r.player.rank ? (
                              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                                #{r.player.rank}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="px-4 py-3">{formatCents(r.paidCents)}</td>
                        <td className="px-4 py-3">
                          {r.depositMet ? (
                            <span className="text-sm font-semibold text-emerald-700">✓</span>
                          ) : (
                            <span className="text-sm font-semibold text-rose-400">✗</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.paidInFull ? (
                            <span className="text-xs font-semibold text-emerald-700">Paid in full</span>
                          ) : (
                            <span className="font-medium text-neutral-900">{formatCents(r.balanceCents)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {history.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setExpandedPlayerId(expanded ? null : r.player.id)}
                              className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
                            >
                              {expanded ? "Hide" : `${history.length}`}
                            </button>
                          ) : (
                            <span className="text-xs text-neutral-400">0</span>
                          )}
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-t border-black/5 bg-neutral-50/70">
                          <td colSpan={5} className="px-4 py-3">
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
                })
              )}
            </tbody>
          </table>
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
                        <div className="flex justify-end gap-3">
                          {p.player_id ? (
                            <button
                              type="button"
                              disabled={linkBusyId === p.id}
                              onClick={() => unlinkPayment(p.id)}
                              className="text-xs font-medium text-neutral-500 hover:text-neutral-800 disabled:opacity-50"
                            >
                              {linkBusyId === p.id ? "Unlinking…" : "Unlink"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(p.id)}
                            className="text-xs font-medium text-neutral-500 hover:text-rose-600"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {unmatchedPayments.length > 0 ? (
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Unmatched payments</h2>
          <p className="mt-1 text-sm text-neutral-500">Free-text payers not tied to a roster player.</p>
          <div className="glass-card mt-4 overflow-x-auto rounded-3xl">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-neutral-50/90 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Payer</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3">Link to player</th>
                </tr>
              </thead>
              <tbody>
                {unmatchedPayments.map((p) => {
                  const suggestions = suggestPlayers(p.payer_name ?? "", players, 5);
                  const suggestedIds = new Set(suggestions.map((s) => s.player.id));
                  const rest = sortedPlayers.filter((pl) => !suggestedIds.has(pl.id));
                  // Only pre-fill a confident match. A merely "possible" guess has
                  // to be chosen deliberately — this binds real money to a player.
                  const top = suggestions[0];
                  const presumed = top && top.score >= 0.75 ? top.player.id : "";
                  const selected = linkSelections[p.id] ?? presumed;
                  return (
                    <tr key={p.id} className="border-t border-black/5 text-neutral-700">
                      <td className="px-4 py-3">{p.paid_on}</td>
                      <td className="px-4 py-3 font-medium text-neutral-900">{p.payer_name ?? "Unknown"}</td>
                      <td className="px-4 py-3 font-semibold text-neutral-900">{formatCents(p.amount_cents)}</td>
                      <td className="px-4 py-3 capitalize">{p.method}</td>
                      <td className="px-4 py-3 text-neutral-500">{p.note ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            className="rounded-xl border border-black/10 bg-white px-2.5 py-2 text-xs outline-none ring-blue-500/30 transition focus:ring-4"
                            value={selected}
                            onChange={(e) => setLinkSelections((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          >
                            <option value="">— Select player —</option>
                            {suggestions.length > 0 ? (
                              <optgroup label="Suggested">
                                {suggestions.map((s) => {
                                  const label = confidenceLabel(s.score);
                                  return (
                                    <option key={s.player.id} value={s.player.id}>
                                      {s.player.name}
                                      {label ? ` — ${label}` : ""}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            ) : null}
                            <optgroup label="All players">
                              {rest.map((pl) => (
                                <option key={pl.id} value={pl.id}>
                                  {pl.name}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                          <button
                            type="button"
                            disabled={!selected || linkBusyId === p.id}
                            onClick={() => linkPayment(p.id, selected)}
                            className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-50"
                          >
                            {linkBusyId === p.id ? "Linking…" : "Link"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
