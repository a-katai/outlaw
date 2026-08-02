"use client";

import { FormEvent, useMemo, useState } from "react";
import { draftOrderOnClock, roundAndSlot, sortByRankThenName } from "@/lib/draft-logic";
import type { DraftFormat, PlayerPosition } from "@/lib/draft-types";
import { AdminState, postJSON } from "./admin-api";

export function AdminDraftTab({ state, refetch }: { state: AdminState; refetch: () => Promise<void> }) {
  const { draft, teams, players, picks } = state;

  const orderedTeams = useMemo(
    () => [...teams].sort((a, b) => (a.draft_order ?? 999) - (b.draft_order ?? 999)),
    [teams],
  );
  const teamCount = teams.filter((t) => t.draft_order !== null).length;
  const draftedPlayerIds = useMemo(() => new Set(picks.map((p) => p.player_id)), [picks]);
  const availablePlayers = useMemo(
    () => sortByRankThenName(players.filter((p) => !draftedPlayerIds.has(p.id))),
    [players, draftedPlayerIds],
  );

  return (
    <div className="space-y-8">
      <DraftControlCard
        draft={draft}
        teamCount={teamCount}
        availablePlayers={availablePlayers}
        refetch={refetch}
      />
      <TeamManagement teams={orderedTeams} players={players} refetch={refetch} />
      <PlayerPool players={players} draftedPlayerIds={draftedPlayerIds} refetch={refetch} />
    </div>
  );
}

function DraftControlCard({
  draft,
  teamCount,
  availablePlayers,
  refetch,
}: {
  draft: AdminState["draft"];
  teamCount: number;
  availablePlayers: AdminState["players"];
  refetch: () => Promise<void>;
}) {
  const [name, setName] = useState("Draft");
  const [format, setFormat] = useState<DraftFormat>("snake");
  const [totalRounds, setTotalRounds] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [forcePickId, setForcePickId] = useState<string | null>(null);
  const [forceSearch, setForceSearch] = useState("");

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const data = await postJSON<{ ok: boolean; error?: string }>("/api/admin/draft", body);
      if (!data.ok) {
        setError(data.error ?? "Action failed");
        return;
      }
      await refetch();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const createDraft = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await act({ action: "create", name, format, totalRounds });
  };

  if (!draft || draft.status === "complete") {
    return (
      <div className="glass-card rounded-3xl p-6 md:p-8">
        <h2 className="text-xl font-semibold text-neutral-900">
          {draft ? "Start a new draft" : "Create a draft"}
        </h2>
        {draft ? (
          <p className="mt-1 text-sm text-neutral-500">
            &ldquo;{draft.name}&rdquo; is complete. Starting a new one replaces it as the live draft.
          </p>
        ) : null}
        <form onSubmit={createDraft} className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="grid gap-1.5 text-sm sm:col-span-1">
            <span className="font-medium text-neutral-700">Name</span>
            <input
              className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-1">
            <span className="font-medium text-neutral-700">Format</span>
            <select
              className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
              value={format}
              onChange={(e) => setFormat(e.target.value as DraftFormat)}
            >
              <option value="snake">Snake</option>
              <option value="linear">Linear</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-1">
            <span className="font-medium text-neutral-700">Total rounds</span>
            <input
              type="number"
              min={1}
              className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
              value={totalRounds}
              onChange={(e) => setTotalRounds(Number(e.target.value))}
              required
            />
          </label>
          {error ? <p className="text-sm font-medium text-rose-600 sm:col-span-3">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50 sm:col-span-3"
          >
            {busy ? "Creating…" : "Create draft"}
          </button>
        </form>
      </div>
    );
  }

  const { round } = teamCount > 0 ? roundAndSlot(draft.current_pick, teamCount) : { round: 1 };
  const onClockOrder = teamCount > 0 ? draftOrderOnClock(draft.current_pick, teamCount, draft.format) : null;

  const filteredForcePick = availablePlayers.filter((p) =>
    p.name.toLowerCase().includes(forceSearch.trim().toLowerCase()),
  );

  return (
    <div className="glass-card rounded-3xl p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">{draft.name}</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {draft.status.toUpperCase()} · Round {round} of {draft.total_rounds} · Pick #{draft.current_pick} ·{" "}
            {draft.format === "snake" ? "Snake" : "Linear"}
            {onClockOrder ? ` · Slot ${onClockOrder} on the clock` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {draft.status === "setup" ? (
            <button
              type="button"
              disabled={busy || teamCount < 2}
              onClick={() => act({ action: "start", draftId: draft.id })}
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
            >
              Start draft
            </button>
          ) : null}
          {draft.status === "live" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => act({ action: "pause", draftId: draft.id })}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              Pause
            </button>
          ) : null}
          {draft.status === "paused" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => act({ action: "resume", draftId: draft.id })}
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
            >
              Resume
            </button>
          ) : null}
          {draft.status !== "setup" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => act({ action: "undo", draftId: draft.id })}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              Undo last pick
            </button>
          ) : null}
          {resetConfirm ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  await act({ action: "reset", draftId: draft.id, confirm: true });
                  setResetConfirm(false);
                }}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm reset — deletes all picks
              </button>
              <button
                type="button"
                onClick={() => setResetConfirm(false)}
                className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setResetConfirm(true)}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
            >
              Reset draft
            </button>
          )}
        </div>
      </div>

      {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}

      {draft.status === "live" ? (
        <div className="mt-6 border-t border-black/5 pt-6">
          <h3 className="text-sm font-semibold text-neutral-900">Commissioner force-pick</h3>
          <p className="mt-1 text-xs text-neutral-500">Pick on behalf of the on-clock team (stuck captains).</p>
          <input
            className="mt-3 w-full max-w-xs rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
            value={forceSearch}
            onChange={(e) => setForceSearch(e.target.value)}
            placeholder="Search players"
          />
          <div className="mt-3 max-h-64 overflow-y-auto rounded-2xl border border-black/5">
            {filteredForcePick.map((player) => (
              <div key={player.id} className="flex items-center justify-between gap-3 border-b border-black/5 px-3 py-2 last:border-b-0">
                <span className="truncate text-sm text-neutral-800">{player.name}</span>
                {forcePickId === player.id ? (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        await act({ action: "force-pick", draftId: draft.id, playerId: player.id });
                        setForcePickId(null);
                      }}
                      className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-50"
                    >
                      Confirm force-pick
                    </button>
                    <button
                      type="button"
                      onClick={() => setForcePickId(null)}
                      className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setForcePickId(player.id)}
                    className="shrink-0 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                  >
                    Force pick
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TeamManagement({
  teams,
  players,
  refetch,
}: {
  teams: AdminState["teams"];
  players: AdminState["players"];
  refetch: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [draftOrder, setDraftOrder] = useState(teams.length + 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const addTeam = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = await postJSON<{ ok: boolean; error?: string }>("/api/admin/teams", {
      action: "add",
      name,
      draftOrder,
    });
    setBusy(false);
    if (!data.ok) return setError(data.error ?? "Couldn't add team");
    setName("");
    setDraftOrder(teams.length + 2);
    await refetch();
  };

  const updateTeam = async (id: string, patch: Record<string, unknown>) => {
    await postJSON("/api/admin/teams", { action: "update", id, ...patch });
    await refetch();
  };

  const deleteTeam = async (id: string) => {
    await postJSON("/api/admin/teams", { action: "delete", id });
    setConfirmDeleteId(null);
    await refetch();
  };

  const generateCode = async (id: string) => {
    await postJSON("/api/admin/teams", { action: "generate-code", id });
    await refetch();
  };

  const copyCode = (id: string, code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900">Teams</h2>
      <div className="glass-card mt-4 overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-neutral-50/90 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Captain</th>
              <th className="px-4 py-3">Pick code</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id} className="border-t border-black/5 text-neutral-700">
                <td className="px-4 py-3">
                  <input
                    type="number"
                    defaultValue={team.draft_order ?? ""}
                    onBlur={(e) => updateTeam(team.id, { draftOrder: Number(e.target.value) || null })}
                    className="w-16 rounded-lg border border-black/10 bg-white px-2 py-1 text-sm outline-none ring-blue-500/30 focus:ring-4"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    defaultValue={team.name}
                    onBlur={(e) => e.target.value !== team.name && updateTeam(team.id, { name: e.target.value })}
                    className="w-40 rounded-lg border border-black/10 bg-white px-2 py-1 text-sm font-medium text-neutral-900 outline-none ring-blue-500/30 focus:ring-4"
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    defaultValue={team.captain_player_id ?? ""}
                    onChange={(e) => updateTeam(team.id, { captainPlayerId: e.target.value || null })}
                    className="rounded-lg border border-black/10 bg-white px-2 py-1 text-sm outline-none ring-blue-500/30 focus:ring-4"
                  >
                    <option value="">—</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {team.code ? (
                    <div className="flex items-center gap-2">
                      <code className="rounded-lg bg-neutral-100 px-2 py-1 text-xs font-semibold tracking-widest">
                        {team.code}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyCode(team.id, team.code as string)}
                        className="text-xs font-medium text-neutral-500 underline underline-offset-4 hover:text-neutral-900"
                      >
                        {copiedId === team.id ? "Copied" : "Copy"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => generateCode(team.id)}
                      className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                    >
                      Generate code
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {confirmDeleteId === team.id ? (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => deleteTeam(team.id)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                      >
                        Confirm delete
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
                      onClick={() => setConfirmDeleteId(team.id)}
                      className="text-xs font-medium text-neutral-500 hover:text-rose-600"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={addTeam} className="glass-card mt-4 flex flex-wrap items-end gap-3 rounded-3xl p-5">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Team name</span>
          <input
            className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Draft order</span>
          <input
            type="number"
            min={1}
            className="w-24 rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
            value={draftOrder}
            onChange={(e) => setDraftOrder(Number(e.target.value))}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add team"}
        </button>
        {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      </form>
    </div>
  );
}

function PlayerPool({
  players,
  draftedPlayerIds,
  refetch,
}: {
  players: AdminState["players"];
  draftedPlayerIds: Set<string>;
  refetch: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [position, setPosition] = useState<PlayerPosition | "">("");
  const [rank, setRank] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sortedPlayers = useMemo(() => sortByRankThenName(players), [players]);

  const addPlayer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = await postJSON<{ ok: boolean; error?: string }>("/api/admin/players", {
      action: "add",
      name,
      position: position || null,
      rank: rank.trim() ? Number(rank) : null,
    });
    setBusy(false);
    if (!data.ok) return setError(data.error ?? "Couldn't add player");
    setName("");
    setPosition("");
    setRank("");
    await refetch();
  };

  const importBulk = async () => {
    setBulkBusy(true);
    setError(null);
    setBulkMessage(null);
    const data = await postJSON<{ ok: boolean; error?: string; count?: number }>("/api/admin/players", {
      action: "bulk",
      text: bulkText,
    });
    setBulkBusy(false);
    if (!data.ok) return setError(data.error ?? "Import failed");
    setBulkText("");
    setBulkMessage(`Imported ${data.count} player${data.count === 1 ? "" : "s"}.`);
    await refetch();
  };

  const deletePlayer = async (id: string) => {
    await postJSON("/api/admin/players", { action: "delete", id });
    setConfirmDeleteId(null);
    await refetch();
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900">Player pool</h2>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <form onSubmit={addPlayer} className="glass-card space-y-3 rounded-3xl p-5">
          <h3 className="text-sm font-semibold text-neutral-900">Add one</h3>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Player name"
              required
            />
            <select
              className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
              value={position}
              onChange={(e) => setPosition(e.target.value as PlayerPosition | "")}
            >
              <option value="">Pos</option>
              <option value="F">F</option>
              <option value="D">D</option>
              <option value="F/D">F/D</option>
              <option value="G">G</option>
            </select>
            <input
              type="number"
              min={1}
              className="w-20 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              placeholder="Rank"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add player"}
          </button>
        </form>

        <div className="glass-card space-y-3 rounded-3xl p-5">
          <h3 className="text-sm font-semibold text-neutral-900">Bulk import</h3>
          <p className="text-xs text-neutral-500">
            One per line, optional trailing position (F, D, G, or F/D) and rank — e.g. &ldquo;Mike Smith F 3&rdquo;.
          </p>
          <textarea
            className="h-28 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"Mike Smith F\nJoe Blow D\nSam Sample"}
          />
          <button
            type="button"
            onClick={importBulk}
            disabled={bulkBusy || !bulkText.trim()}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
          >
            {bulkBusy ? "Importing…" : "Import"}
          </button>
          {bulkMessage ? <p className="text-sm font-medium text-emerald-700">{bulkMessage}</p> : null}
        </div>
      </div>

      {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}

      <div className="glass-card mt-4 max-h-96 overflow-y-auto rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-neutral-50/95 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Pos</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player) => (
              <tr key={player.id} className="border-t border-black/5 text-neutral-700">
                <td className="px-4 py-3 text-neutral-500">{player.rank ?? "—"}</td>
                <td className="px-4 py-3 font-medium text-neutral-900">{player.name}</td>
                <td className="px-4 py-3">{player.position ?? "—"}</td>
                <td className="px-4 py-3">
                  {draftedPlayerIds.has(player.id) ? (
                    <span className="text-xs font-semibold text-neutral-500">Drafted</span>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-700">Available</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {confirmDeleteId === player.id ? (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => deletePlayer(player.id)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                      >
                        Confirm delete
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
                      onClick={() => setConfirmDeleteId(player.id)}
                      className="text-xs font-medium text-neutral-500 hover:text-rose-600"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
