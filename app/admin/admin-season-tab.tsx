"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { postJSON } from "./admin-api";
import type {
  SeasonAdminGame,
  SeasonAdminGameStat,
  SeasonAdminSeries,
  SeasonAdminState,
} from "./admin-season-api";

export function AdminSeasonTab({
  state,
  refetch,
}: {
  state: SeasonAdminState;
  refetch: () => Promise<void>;
}) {
  const { seasons, activeSeason, teams, players, draftPicks, games, gameStats, playoffSeries } = state;

  const seasonTeams = useMemo(
    () => teams.filter((t) => activeSeason && t.season_id === activeSeason.id).sort((a, b) => a.name.localeCompare(b.name)),
    [teams, activeSeason],
  );
  const draftTeamsNotAdopted = useMemo(
    () => teams.filter((t) => t.draft_order !== null && (!activeSeason || t.season_id !== activeSeason.id)),
    [teams, activeSeason],
  );
  const seasonSeries = useMemo(
    () => playoffSeries.filter((s) => activeSeason && s.season_id === activeSeason.id),
    [playoffSeries, activeSeason],
  );

  return (
    <div className="space-y-8">
      <SeasonHeader seasons={seasons} activeSeason={activeSeason} refetch={refetch} />
      <ScorekeeperAccess />
      {activeSeason ? (
        <>
          <TeamsForSeason
            activeSeasonId={activeSeason.id}
            seasonTeams={seasonTeams}
            draftTeamsNotAdopted={draftTeamsNotAdopted}
            refetch={refetch}
          />
          <GamesSection
            activeSeasonId={activeSeason.id}
            seasonTeams={seasonTeams}
            games={games}
            players={players}
            draftPicks={draftPicks}
            gameStats={gameStats}
            seasonSeries={seasonSeries}
            refetch={refetch}
          />
          <PlayoffsSection
            activeSeasonId={activeSeason.id}
            seasonTeams={seasonTeams}
            playoffSeries={seasonSeries}
            games={games}
            refetch={refetch}
          />
        </>
      ) : (
        <div className="glass-card rounded-3xl p-8 text-center text-sm text-neutral-500">
          No active season. Create one or set one active above.
        </div>
      )}
    </div>
  );
}

function ScorekeeperAccess() {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/season/access-code", { cache: "no-store" });
      const data = await res.json();
      setCode(data.ok ? (data.code ?? null) : null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    setBusy(true);
    setError(null);
    const data = await postJSON<{ ok: boolean; code?: string; error?: string }>("/api/admin/season/access-code", {
      action: "generate",
    });
    setBusy(false);
    if (!data.ok) return setError(data.error ?? "Couldn't generate a code");
    setCode(data.code ?? null);
  };

  return (
    <div className="glass-card rounded-3xl p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Scorekeeper access</p>
          <p className="mt-1 text-2xl font-semibold tracking-[0.3em] text-neutral-900">
            {loading ? "…" : (code ?? "None yet")}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={generate}
          className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {busy ? "Generating…" : "Generate new code"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}
      <p className="mt-3 text-xs text-neutral-500">
        Anyone with this code can sign in at /scorekeeper and log live goals. Generating a new code doesn&apos;t sign out
        devices already using the old one until they log out.
      </p>
    </div>
  );
}

function SeasonHeader({
  seasons,
  activeSeason,
  refetch,
}: {
  seasons: SeasonAdminState["seasons"];
  activeSeason: SeasonAdminState["activeSeason"];
  refetch: () => Promise<void>;
}) {
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmComplete, setConfirmComplete] = useState(false);

  const createSeason = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = await postJSON<{ ok: boolean; error?: string }>("/api/admin/season", { action: "create", id, label });
    setBusy(false);
    if (!data.ok) return setError(data.error ?? "Couldn't create season");
    setId("");
    setLabel("");
    await refetch();
  };

  const setActive = async (seasonId: string) => {
    setBusy(true);
    setError(null);
    const data = await postJSON<{ ok: boolean; error?: string }>("/api/admin/season", { action: "set-active", id: seasonId });
    setBusy(false);
    if (!data.ok) return setError(data.error ?? "Couldn't set active season");
    await refetch();
  };

  const markComplete = async (seasonId: string) => {
    setBusy(true);
    setError(null);
    const data = await postJSON<{ ok: boolean; error?: string }>("/api/admin/season", { action: "mark-complete", id: seasonId });
    setBusy(false);
    setConfirmComplete(false);
    if (!data.ok) return setError(data.error ?? "Couldn't mark season complete");
    await refetch();
  };

  return (
    <div className="glass-card rounded-3xl p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Active season</p>
          <h2 className="mt-1 text-2xl font-semibold text-neutral-900">
            {activeSeason ? activeSeason.label : "None active"}
          </h2>
        </div>
        {activeSeason ? (
          confirmComplete ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => markComplete(activeSeason.id)}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm mark complete
              </button>
              <button
                type="button"
                onClick={() => setConfirmComplete(false)}
                className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmComplete(true)}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
            >
              Mark complete
            </button>
          )
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}

      <div className="mt-5 glass-card overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-neutral-50/90 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Id</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => (
              <tr key={s.id} className="border-t border-black/5 text-neutral-700">
                <td className="px-4 py-3 font-mono text-xs">{s.id}</td>
                <td className="px-4 py-3 font-medium text-neutral-900">{s.label}</td>
                <td className="px-4 py-3 capitalize">{s.status}</td>
                <td className="px-4 py-3 text-right">
                  {s.status !== "active" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setActive(s.id)}
                      className="text-xs font-semibold text-neutral-600 hover:text-neutral-900"
                    >
                      Set active
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-700">Active</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={createSeason} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Season id</span>
          <input
            className="w-32 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="2027-28"
            required
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Label</span>
          <input
            className="w-32 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="2027–28"
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create season"}
        </button>
      </form>
    </div>
  );
}

function TeamsForSeason({
  activeSeasonId,
  seasonTeams,
  draftTeamsNotAdopted,
  refetch,
}: {
  activeSeasonId: string;
  seasonTeams: SeasonAdminState["teams"];
  draftTeamsNotAdopted: SeasonAdminState["teams"];
  refetch: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adopt = async () => {
    setBusy(true);
    setError(null);
    const data = await postJSON<{ ok: boolean; error?: string }>("/api/admin/season/teams", {
      action: "adopt-draft-teams",
      seasonId: activeSeasonId,
    });
    setBusy(false);
    if (!data.ok) return setError(data.error ?? "Couldn't adopt draft teams");
    await refetch();
  };

  const addTeam = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = await postJSON<{ ok: boolean; error?: string }>("/api/admin/season/teams", {
      action: "add",
      seasonId: activeSeasonId,
      name,
    });
    setBusy(false);
    if (!data.ok) return setError(data.error ?? "Couldn't add team");
    setName("");
    await refetch();
  };

  const renameTeam = async (id: string, newName: string) => {
    await postJSON("/api/admin/season/teams", { action: "rename", id, name: newName });
    await refetch();
  };

  const removeTeam = async (id: string) => {
    await postJSON("/api/admin/season/teams", { action: "remove", id });
    await refetch();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-neutral-900">Teams</h2>
        {draftTeamsNotAdopted.length > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={adopt}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
          >
            Adopt {draftTeamsNotAdopted.length} draft team{draftTeamsNotAdopted.length === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-sm font-medium text-rose-600">{error}</p> : null}

      <div className="glass-card mt-4 overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="bg-neutral-50/90 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {seasonTeams.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-neutral-500">
                  No teams in this season yet.
                </td>
              </tr>
            ) : (
              seasonTeams.map((team) => (
                <tr key={team.id} className="border-t border-black/5 text-neutral-700">
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      defaultValue={team.name}
                      onBlur={(e) => e.target.value !== team.name && e.target.value.trim() && renameTeam(team.id, e.target.value)}
                      className="w-48 rounded-lg border border-black/10 bg-white px-2 py-1 text-sm font-medium text-neutral-900 outline-none ring-blue-500/30 focus:ring-4"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeTeam(team.id)}
                      className="text-xs font-medium text-neutral-500 hover:text-rose-600"
                    >
                      Remove from season
                    </button>
                  </td>
                </tr>
              ))
            )}
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
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add team"}
        </button>
      </form>
    </div>
  );
}

function GamesSection({
  activeSeasonId,
  seasonTeams,
  games,
  players,
  draftPicks,
  gameStats,
  seasonSeries,
  refetch,
}: {
  activeSeasonId: string;
  seasonTeams: SeasonAdminState["teams"];
  games: SeasonAdminGame[];
  players: SeasonAdminState["players"];
  draftPicks: SeasonAdminState["draftPicks"];
  gameStats: SeasonAdminGameStat[];
  seasonSeries: SeasonAdminSeries[];
  refetch: () => Promise<void>;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [gameType, setGameType] = useState<"regular" | "playoff">("regular");
  const [seriesId, setSeriesId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);

  const nameByTeamId = useMemo(() => new Map(seasonTeams.map((t) => [t.id, t.name])), [seasonTeams]);
  const sortedGames = useMemo(() => [...games].sort((a, b) => (a.game_date < b.game_date ? -1 : 1)), [games]);

  const addGame = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (homeTeamId === awayTeamId) {
      setError("Home and away teams must differ");
      return;
    }
    setBusy(true);
    setError(null);
    const data = await postJSON<{ ok: boolean; error?: string }>("/api/admin/season/games", {
      action: "add",
      seasonId: activeSeasonId,
      date,
      time: time || null,
      homeTeamId,
      awayTeamId,
      gameType,
      seriesId: gameType === "playoff" && seriesId ? seriesId : null,
    });
    setBusy(false);
    if (!data.ok) return setError(data.error ?? "Couldn't add game");
    setDate("");
    setTime("");
    setHomeTeamId("");
    setAwayTeamId("");
    setGameType("regular");
    setSeriesId("");
    await refetch();
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900">Games</h2>

      <form onSubmit={addGame} className="glass-card mt-4 flex flex-wrap items-end gap-3 rounded-3xl p-5">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Date</span>
          <input
            type="date"
            className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Time</span>
          <input
            type="text"
            placeholder="7:30 PM"
            className="w-28 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Away</span>
          <select
            className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
            value={awayTeamId}
            onChange={(e) => setAwayTeamId(e.target.value)}
            required
          >
            <option value="">Select team</option>
            {seasonTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Home</span>
          <select
            className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
            value={homeTeamId}
            onChange={(e) => setHomeTeamId(e.target.value)}
            required
          >
            <option value="">Select team</option>
            {seasonTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Type</span>
          <div className="inline-flex rounded-xl border border-black/10 bg-white p-1">
            <button
              type="button"
              onClick={() => setGameType("regular")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                gameType === "regular" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Regular
            </button>
            <button
              type="button"
              onClick={() => setGameType("playoff")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                gameType === "playoff" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Playoff
            </button>
          </div>
        </label>
        {gameType === "playoff" ? (
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Series</span>
            <select
              className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
              value={seriesId}
              onChange={(e) => setSeriesId(e.target.value)}
            >
              <option value="">No series</option>
              {seasonSeries.map((s) => (
                <option key={s.id} value={s.id}>
                  Round {s.round} · {s.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add game"}
        </button>
        {error ? <p className="w-full text-sm font-medium text-rose-600">{error}</p> : null}
      </form>

      <div className="glass-card mt-4 overflow-hidden rounded-3xl">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-neutral-50/90 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Matchup</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sortedGames.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  No games scheduled yet.
                </td>
              </tr>
            ) : (
              sortedGames.map((game) => (
                <GameRow
                  key={game.id}
                  game={game}
                  homeTeamName={nameByTeamId.get(game.home_team_id) ?? "Unknown"}
                  awayTeamName={nameByTeamId.get(game.away_team_id) ?? "Unknown"}
                  expanded={expandedGameId === game.id}
                  onToggleExpand={() => setExpandedGameId(expandedGameId === game.id ? null : game.id)}
                  players={players}
                  draftPicks={draftPicks}
                  gameStats={gameStats.filter((s) => s.game_id === game.id)}
                  seasonSeries={seasonSeries}
                  refetch={refetch}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GameRow({
  game,
  homeTeamName,
  awayTeamName,
  expanded,
  onToggleExpand,
  players,
  draftPicks,
  gameStats,
  seasonSeries,
  refetch,
}: {
  game: SeasonAdminGame;
  homeTeamName: string;
  awayTeamName: string;
  expanded: boolean;
  onToggleExpand: () => void;
  players: SeasonAdminState["players"];
  draftPicks: SeasonAdminState["draftPicks"];
  gameStats: SeasonAdminGameStat[];
  seasonSeries: SeasonAdminSeries[];
  refetch: () => Promise<void>;
}) {
  const [homeScore, setHomeScore] = useState(game.home_score?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(game.away_score?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [seriesBusy, setSeriesBusy] = useState(false);

  const assignSeries = async (nextSeriesId: string) => {
    setSeriesBusy(true);
    await postJSON("/api/admin/season/games", { action: "assign-series", id: game.id, seriesId: nextSeriesId || null });
    setSeriesBusy(false);
    await refetch();
  };

  const saveScore = async () => {
    setBusy(true);
    await postJSON("/api/admin/season/games", {
      action: "set-score",
      id: game.id,
      homeScore: Number(homeScore) || 0,
      awayScore: Number(awayScore) || 0,
    });
    setBusy(false);
    await refetch();
  };

  const revert = async () => {
    setBusy(true);
    await postJSON("/api/admin/season/games", { action: "revert", id: game.id });
    setBusy(false);
    await refetch();
  };

  const deleteGame = async () => {
    setBusy(true);
    await postJSON("/api/admin/season/games", { action: "delete", id: game.id });
    setBusy(false);
    setConfirmDelete(false);
    await refetch();
  };

  return (
    <>
      <tr className="border-t border-black/5 text-neutral-700">
        <td className="px-4 py-3 whitespace-nowrap">
          {game.game_date}
          {game.game_time ? <span className="ml-1 text-xs text-neutral-500">{game.game_time}</span> : null}
        </td>
        <td className="px-4 py-3 font-medium text-neutral-900">
          <div className="flex items-center gap-2">
            <span>
              {awayTeamName} @ {homeTeamName}
            </span>
            {game.game_type === "playoff" ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                Playoff
              </span>
            ) : null}
          </div>
          {game.game_type === "playoff" ? (
            <select
              disabled={seriesBusy}
              value={game.series_id ?? ""}
              onChange={(e) => assignSeries(e.target.value)}
              className="mt-1.5 rounded-lg border border-black/10 bg-white px-2 py-1 text-xs font-normal text-neutral-600 outline-none ring-blue-500/30 focus:ring-4"
            >
              <option value="">No series</option>
              {seasonSeries.map((s) => (
                <option key={s.id} value={s.id}>
                  Round {s.round} · {s.name}
                </option>
              ))}
            </select>
          ) : null}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              className="w-14 rounded-lg border border-black/10 bg-white px-2 py-1 text-sm outline-none ring-blue-500/30 focus:ring-4"
            />
            <span className="text-neutral-400">–</span>
            <input
              type="number"
              min={0}
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              className="w-14 rounded-lg border border-black/10 bg-white px-2 py-1 text-sm outline-none ring-blue-500/30 focus:ring-4"
            />
            <button
              type="button"
              disabled={busy || homeScore === "" || awayScore === ""}
              onClick={saveScore}
              className="ml-1 rounded-lg border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </td>
        <td className="px-4 py-3">
          {game.status === "final" ? (
            <span className="text-xs font-semibold text-emerald-700">Final</span>
          ) : game.status === "live" ? (
            <span className="text-xs font-semibold text-rose-600">Live</span>
          ) : (
            <span className="text-xs font-semibold text-neutral-500">Scheduled</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onToggleExpand} className="text-xs font-medium text-neutral-500 hover:text-neutral-900">
              {expanded ? "Hide stats" : "Player stats"}
            </button>
            {game.status === "final" ? (
              <button type="button" disabled={busy} onClick={revert} className="text-xs font-medium text-neutral-500 hover:text-neutral-900">
                Revert
              </button>
            ) : null}
            {confirmDelete ? (
              <>
                <button type="button" onClick={deleteGame} className="text-xs font-semibold text-rose-600 hover:text-rose-800">
                  Confirm
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs font-medium text-neutral-500 hover:text-neutral-800">
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="text-xs font-medium text-neutral-500 hover:text-rose-600">
                Delete
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-t border-black/5 bg-neutral-50/70">
          <td colSpan={5} className="px-4 py-4">
            <GameStatsEditor
              game={game}
              players={players}
              draftPicks={draftPicks}
              gameStats={gameStats}
              refetch={refetch}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

type StatDraftRow = { playerId: string; teamId: string; goals: string; assists: string; played: boolean };

function GameStatsEditor({
  game,
  players,
  draftPicks,
  gameStats,
  refetch,
}: {
  game: SeasonAdminGame;
  players: SeasonAdminState["players"];
  draftPicks: SeasonAdminState["draftPicks"];
  gameStats: SeasonAdminGameStat[];
  refetch: () => Promise<void>;
}) {
  const nameByPlayerId = useMemo(() => new Map(players.map((p) => [p.id, p.name])), [players]);

  const rosterPlayerIds = useMemo(() => {
    const ids = new Map<string, string>(); // playerId -> teamId
    for (const pick of draftPicks) {
      if (pick.team_id === game.home_team_id || pick.team_id === game.away_team_id) {
        ids.set(pick.player_id, pick.team_id);
      }
    }
    return ids;
  }, [draftPicks, game.home_team_id, game.away_team_id]);

  const initialRows = useMemo<StatDraftRow[]>(() => {
    const existingByPlayer = new Map(gameStats.map((s) => [s.player_id, s]));
    const rows: StatDraftRow[] = [];
    for (const [playerId, teamId] of rosterPlayerIds.entries()) {
      const existing = existingByPlayer.get(playerId);
      rows.push({
        playerId,
        teamId: existing?.team_id ?? teamId,
        goals: (existing?.goals ?? 0).toString(),
        assists: (existing?.assists ?? 0).toString(),
        played: Boolean(existing),
      });
    }
    // Any existing stat rows for players not on either roster (subs / trades)
    for (const s of gameStats) {
      if (!rosterPlayerIds.has(s.player_id)) {
        rows.push({
          playerId: s.player_id,
          teamId: s.team_id,
          goals: s.goals.toString(),
          assists: s.assists.toString(),
          played: true,
        });
      }
    }
    rows.sort((a, b) => (nameByPlayerId.get(a.playerId) ?? "").localeCompare(nameByPlayerId.get(b.playerId) ?? ""));
    return rows;
  }, [rosterPlayerIds, gameStats, nameByPlayerId]);

  const [rows, setRows] = useState<StatDraftRow[]>(initialRows);
  const [fallbackPlayerId, setFallbackPlayerId] = useState("");
  const [fallbackTeamId, setFallbackTeamId] = useState(game.home_team_id);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rowPlayerIds = new Set(rows.map((r) => r.playerId));
  const availableFallback = players.filter((p) => !rowPlayerIds.has(p.id));

  const updateRow = (playerId: string, patch: Partial<StatDraftRow>) => {
    setRows((prev) => prev.map((r) => (r.playerId === playerId ? { ...r, ...patch } : r)));
  };

  const addFallbackPlayer = () => {
    if (!fallbackPlayerId) return;
    setRows((prev) => [
      ...prev,
      { playerId: fallbackPlayerId, teamId: fallbackTeamId, goals: "0", assists: "0", played: true },
    ]);
    setFallbackPlayerId("");
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const payload = rows
      .filter((r) => r.played)
      .map((r) => ({ playerId: r.playerId, teamId: r.teamId, goals: Number(r.goals) || 0, assists: Number(r.assists) || 0 }));
    const data = await postJSON<{ ok: boolean; error?: string }>("/api/admin/season/stats", {
      action: "save",
      gameId: game.id,
      rows: payload,
    });
    setBusy(false);
    if (!data.ok) {
      setMessage(data.error ?? "Couldn't save stats");
      return;
    }
    setMessage("Saved.");
    await refetch();
  };

  return (
    <div className="space-y-3">
      <div className="glass-card overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="bg-neutral-50/90 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Played</th>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2">G</th>
              <th className="px-3 py-2">A</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-neutral-500">
                  No roster found for these teams — use the picker below to add players.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.playerId} className="border-t border-black/5">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={r.played}
                      onChange={(e) => updateRow(r.playerId, { played: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-neutral-900">{nameByPlayerId.get(r.playerId) ?? "Unknown"}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      value={r.goals}
                      onChange={(e) => updateRow(r.playerId, { goals: e.target.value })}
                      className="w-14 rounded-lg border border-black/10 bg-white px-2 py-1 text-sm outline-none ring-blue-500/30 focus:ring-4"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      value={r.assists}
                      onChange={(e) => updateRow(r.playerId, { assists: e.target.value })}
                      className="w-14 rounded-lg border border-black/10 bg-white px-2 py-1 text-sm outline-none ring-blue-500/30 focus:ring-4"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={fallbackPlayerId}
          onChange={(e) => setFallbackPlayerId(e.target.value)}
          className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm outline-none ring-blue-500/30 focus:ring-4"
        >
          <option value="">Add any player…</option>
          {availableFallback.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={fallbackTeamId}
          onChange={(e) => setFallbackTeamId(e.target.value)}
          className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm outline-none ring-blue-500/30 focus:ring-4"
        >
          <option value={game.home_team_id}>Home</option>
          <option value={game.away_team_id}>Away</option>
        </select>
        <button
          type="button"
          onClick={addFallbackPlayer}
          disabled={!fallbackPlayerId}
          className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
        >
          Add
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="ml-auto rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save stats"}
        </button>
        {message ? <p className="text-xs font-medium text-neutral-600">{message}</p> : null}
      </div>
    </div>
  );
}

function PlayoffsSection({
  activeSeasonId,
  seasonTeams,
  playoffSeries,
  games,
  refetch,
}: {
  activeSeasonId: string;
  seasonTeams: SeasonAdminState["teams"];
  playoffSeries: SeasonAdminSeries[];
  games: SeasonAdminGame[];
  refetch: () => Promise<void>;
}) {
  const nameByTeamId = useMemo(() => new Map(seasonTeams.map((t) => [t.id, t.name])), [seasonTeams]);
  const linkedGameCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of games) {
      if (!g.series_id) continue;
      map.set(g.series_id, (map.get(g.series_id) ?? 0) + 1);
    }
    return map;
  }, [games]);

  const [round, setRound] = useState("1");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("1");
  const [bestOf, setBestOf] = useState("3");
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedSeries = useMemo(
    () => [...playoffSeries].sort((a, b) => a.round - b.round || a.position - b.position),
    [playoffSeries],
  );

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = await postJSON<{ ok: boolean; error?: string }>("/api/admin/season/playoffs", {
      action: "create",
      seasonId: activeSeasonId,
      round: Number(round) || 1,
      name,
      position: Number(position) || 1,
      bestOf: Number(bestOf) || 3,
      teamA: teamA || null,
      teamB: teamB || null,
    });
    setBusy(false);
    if (!data.ok) return setError(data.error ?? "Couldn't create series");
    setName("");
    setTeamA("");
    setTeamB("");
    await refetch();
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900">Playoffs</h2>

      <form onSubmit={create} className="glass-card mt-4 flex flex-wrap items-end gap-3 rounded-3xl p-5">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Round</span>
          <input
            type="number"
            min={1}
            value={round}
            onChange={(e) => setRound(e.target.value)}
            className="w-20 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
            required
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Name</span>
          <input
            type="text"
            placeholder="Semifinals"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-40 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
            required
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Position</span>
          <input
            type="number"
            min={1}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="w-20 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Best of</span>
          <input
            type="number"
            min={1}
            value={bestOf}
            onChange={(e) => setBestOf(e.target.value)}
            className="w-20 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Team A</span>
          <select
            value={teamA}
            onChange={(e) => setTeamA(e.target.value)}
            className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
          >
            <option value="">TBD</option>
            {seasonTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Team B</span>
          <select
            value={teamB}
            onChange={(e) => setTeamB(e.target.value)}
            className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4"
          >
            <option value="">TBD</option>
            {seasonTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create series"}
        </button>
        {error ? <p className="w-full text-sm font-medium text-rose-600">{error}</p> : null}
      </form>

      <div className="glass-card mt-4 overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-neutral-50/90 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Round</th>
              <th className="px-4 py-3">Series</th>
              <th className="px-4 py-3">Teams</th>
              <th className="px-4 py-3">Games</th>
              <th className="px-4 py-3">Winner</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sortedSeries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  No playoff series yet.
                </td>
              </tr>
            ) : (
              sortedSeries.map((s) => (
                <SeriesRow
                  key={s.id}
                  series={s}
                  seasonTeams={seasonTeams}
                  nameByTeamId={nameByTeamId}
                  linkedGameCount={linkedGameCount.get(s.id) ?? 0}
                  refetch={refetch}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SeriesRow({
  series,
  seasonTeams,
  nameByTeamId,
  linkedGameCount,
  refetch,
}: {
  series: SeasonAdminSeries;
  seasonTeams: SeasonAdminState["teams"];
  nameByTeamId: Map<string, string>;
  linkedGameCount: number;
  refetch: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [teamA, setTeamA] = useState(series.team_a ?? "");
  const [teamB, setTeamB] = useState(series.team_b ?? "");
  const [winnerTeamId, setWinnerTeamId] = useState(series.winner_team_id ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveTeams = async () => {
    setBusy(true);
    await postJSON("/api/admin/season/playoffs", {
      action: "edit-teams",
      id: series.id,
      teamA: teamA || null,
      teamB: teamB || null,
    });
    setBusy(false);
    setEditing(false);
    await refetch();
  };

  const saveWinner = async () => {
    setBusy(true);
    if (winnerTeamId) {
      await postJSON("/api/admin/season/playoffs", { action: "set-winner", id: series.id, winnerTeamId });
    } else {
      await postJSON("/api/admin/season/playoffs", { action: "clear-winner", id: series.id });
    }
    setBusy(false);
    await refetch();
  };

  const remove = async () => {
    setBusy(true);
    await postJSON("/api/admin/season/playoffs", { action: "delete", id: series.id });
    setBusy(false);
    setConfirmDelete(false);
    await refetch();
  };

  const teamOptions = [series.team_a, series.team_b].filter((id): id is string => Boolean(id));

  return (
    <tr className="border-t border-black/5 text-neutral-700">
      <td className="px-4 py-3">{series.round}</td>
      <td className="px-4 py-3 font-medium text-neutral-900">{series.name}</td>
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <select
              value={teamA}
              onChange={(e) => setTeamA(e.target.value)}
              className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs"
            >
              <option value="">TBD</option>
              {seasonTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <span className="text-neutral-400">vs</span>
            <select
              value={teamB}
              onChange={(e) => setTeamB(e.target.value)}
              className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs"
            >
              <option value="">TBD</option>
              {seasonTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button type="button" disabled={busy} onClick={saveTeams} className="text-xs font-semibold text-neutral-700 hover:text-neutral-900">
              Save
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="text-left hover:underline">
            {(series.team_a ? nameByTeamId.get(series.team_a) : null) ?? "TBD"} vs{" "}
            {(series.team_b ? nameByTeamId.get(series.team_b) : null) ?? "TBD"}
          </button>
        )}
      </td>
      <td className="px-4 py-3">{linkedGameCount}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <select
            value={winnerTeamId}
            onChange={(e) => setWinnerTeamId(e.target.value)}
            className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs"
          >
            <option value="">None</option>
            {teamOptions.map((id) => (
              <option key={id} value={id}>
                {nameByTeamId.get(id) ?? "Unknown"}
              </option>
            ))}
          </select>
          <button type="button" disabled={busy} onClick={saveWinner} className="text-xs font-semibold text-neutral-700 hover:text-neutral-900">
            Set
          </button>
        </div>
        {series.winner_team_id ? (
          <p className="mt-1 text-xs font-semibold text-amber-700">{nameByTeamId.get(series.winner_team_id) ?? "Unknown"} wins</p>
        ) : null}
      </td>
      <td className="px-4 py-3 text-right">
        {confirmDelete ? (
          <>
            <button type="button" onClick={remove} className="text-xs font-semibold text-rose-600 hover:text-rose-800">
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="ml-2 text-xs font-medium text-neutral-500 hover:text-neutral-800"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-xs font-medium text-neutral-500 hover:text-rose-600"
          >
            Delete
          </button>
        )}
      </td>
    </tr>
  );
}
