"use client";

import { useMemo, useState } from "react";

import { getTeamColors, standings, topSkaters } from "@/lib/league-data";

type SortKey = "gamesPlayed" | "goals" | "assists" | "points" | "ppg";

export default function StatsPage() {
  const [sortKey, setSortKey] = useState<SortKey>("points");

  const { leaguePlayers, subPlayers } = useMemo(() => {
    const sortPlayers = <T extends (typeof topSkaters)[number]>(players: T[]) => {
      const copied = [...players];
      copied.sort((a, b) => {
        if (sortKey === "ppg") {
          return b.points / b.gamesPlayed - a.points / a.gamesPlayed;
        }
        return b[sortKey] - a[sortKey];
      });
      return copied;
    };

    const league = topSkaters.filter((player) => player.team !== "Sub");
    const subs = topSkaters.filter((player) => player.team === "Sub");

    return {
      leaguePlayers: sortPlayers(league),
      subPlayers: sortPlayers(subs),
    };
  }, [sortKey]);

  const sortButtonClass = (key: SortKey) =>
    `font-semibold transition hover:text-neutral-800 ${sortKey === key ? "text-neutral-900 underline underline-offset-4" : ""}`;

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">League Hub</p>
        <h1 className="mt-2 text-4xl font-semibold text-neutral-900">Stats</h1>
        <p className="mt-3 text-neutral-600">
          Updated with your current standings and top scorers. {leaguePlayers.length} league players and {subPlayers.length} subs tracked.
        </p>
      </div>

      <div className="grid gap-3 md:hidden">
        {standings.map((team) => (
          <article key={team.team} className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <span
                className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: getTeamColors(team.team).background,
                  color: getTeamColors(team.team).text,
                  borderColor: getTeamColors(team.team).border,
                }}
              >
                {team.team}
              </span>
              <span className={`text-sm font-semibold ${team.diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {team.diff >= 0 ? `+${team.diff}` : team.diff}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-neutral-600">
              <p>GP: {team.gp}</p>
              <p>W: {team.wins}</p>
              <p>L: {team.losses}</p>
              <p>T: {team.ties}</p>
              <p>PTS: {team.points}</p>
              <p>PTS%: {team.pct}</p>
              <p>GF: {team.goalsFor}</p>
              <p>GA: {team.goalsAgainst}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="glass-card hidden overflow-x-auto rounded-3xl md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-neutral-50/90 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">GP</th>
              <th className="px-4 py-3">W</th>
              <th className="px-4 py-3">L</th>
              <th className="px-4 py-3">T</th>
              <th className="px-4 py-3">PTS</th>
              <th className="px-4 py-3">PTS%</th>
              <th className="px-4 py-3">GF</th>
              <th className="px-4 py-3">GA</th>
              <th className="px-4 py-3">DIFF</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team) => (
              <tr key={team.team} className="border-t border-black/5 text-neutral-700">
                <td className="px-4 py-3 font-semibold text-neutral-900">
                  <span
                    className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: getTeamColors(team.team).background,
                      color: getTeamColors(team.team).text,
                      borderColor: getTeamColors(team.team).border,
                    }}
                  >
                    {team.team}
                  </span>
                </td>
                <td className="px-4 py-3">{team.gp}</td>
                <td className="px-4 py-3">{team.wins}</td>
                <td className="px-4 py-3">{team.losses}</td>
                <td className="px-4 py-3">{team.ties}</td>
                <td className="px-4 py-3">{team.points}</td>
                <td className="px-4 py-3">{team.pct}</td>
                <td className="px-4 py-3">{team.goalsFor}</td>
                <td className="px-4 py-3">{team.goalsAgainst}</td>
                <td className={`px-4 py-3 font-semibold ${team.diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {team.diff >= 0 ? `+${team.diff}` : team.diff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">League Players</h2>
      </div>

      <div className="grid gap-3 md:hidden">
        {leaguePlayers.map((player) => (
          <article key={player.player} className="glass-card rounded-2xl p-4">
            <p className="text-sm font-semibold text-neutral-900">{player.player}</p>
            <div className="mt-2">
              <span
                className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: getTeamColors(player.team).background,
                  color: getTeamColors(player.team).text,
                  borderColor: getTeamColors(player.team).border,
                }}
              >
                {player.team}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-neutral-600">
              <p>GP: {player.gamesPlayed}</p>
              <p>G: {player.goals}</p>
              <p>A: {player.assists}</p>
              <p>PTS: {player.points}</p>
              <p>PTS/GP: {(player.points / player.gamesPlayed).toFixed(2)}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="glass-card hidden overflow-x-auto rounded-3xl md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-neutral-50/90 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => setSortKey("gamesPlayed")} className={sortButtonClass("gamesPlayed")}>
                  GP
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSortKey("goals")}
                  className={sortButtonClass("goals")}
                >
                  Goals
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSortKey("assists")}
                  className={sortButtonClass("assists")}
                >
                  Assists
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => setSortKey("points")} className={sortButtonClass("points")}>
                  PTS
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => setSortKey("ppg")} className={sortButtonClass("ppg")}>
                  PTS/GP
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {leaguePlayers.map((player) => (
              <tr key={player.player} className="border-t border-black/5 text-neutral-700">
                <td className="px-4 py-3 font-semibold text-neutral-900">{player.player}</td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: getTeamColors(player.team).background,
                      color: getTeamColors(player.team).text,
                      borderColor: getTeamColors(player.team).border,
                    }}
                  >
                    {player.team}
                  </span>
                </td>
                <td className="px-4 py-3">{player.gamesPlayed}</td>
                <td className="px-4 py-3">{player.goals}</td>
                <td className="px-4 py-3">{player.assists}</td>
                <td className="px-4 py-3 font-semibold text-neutral-900">{player.points}</td>
                <td className="px-4 py-3 font-medium text-neutral-700">{(player.points / player.gamesPlayed).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Subs</h2>
      </div>

      <div className="grid gap-3 md:hidden">
        {subPlayers.map((player) => (
          <article key={player.player} className="glass-card rounded-2xl p-4">
            <p className="text-sm font-semibold text-neutral-900">{player.player}</p>
            <div className="mt-2">
              <span
                className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: getTeamColors(player.team).background,
                  color: getTeamColors(player.team).text,
                  borderColor: getTeamColors(player.team).border,
                }}
              >
                {player.team}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-neutral-600">
              <p>GP: {player.gamesPlayed}</p>
              <p>G: {player.goals}</p>
              <p>A: {player.assists}</p>
              <p>PTS: {player.points}</p>
              <p>PTS/GP: {(player.points / player.gamesPlayed).toFixed(2)}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="glass-card hidden overflow-x-auto rounded-3xl md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-neutral-50/90 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => setSortKey("gamesPlayed")} className={sortButtonClass("gamesPlayed")}>
                  GP
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => setSortKey("goals")} className={sortButtonClass("goals")}>
                  Goals
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => setSortKey("assists")} className={sortButtonClass("assists")}>
                  Assists
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => setSortKey("points")} className={sortButtonClass("points")}>
                  PTS
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => setSortKey("ppg")} className={sortButtonClass("ppg")}>
                  PTS/GP
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {subPlayers.map((player) => (
              <tr key={player.player} className="border-t border-black/5 text-neutral-700">
                <td className="px-4 py-3 font-semibold text-neutral-900">{player.player}</td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: getTeamColors(player.team).background,
                      color: getTeamColors(player.team).text,
                      borderColor: getTeamColors(player.team).border,
                    }}
                  >
                    {player.team}
                  </span>
                </td>
                <td className="px-4 py-3">{player.gamesPlayed}</td>
                <td className="px-4 py-3">{player.goals}</td>
                <td className="px-4 py-3">{player.assists}</td>
                <td className="px-4 py-3 font-semibold text-neutral-900">{player.points}</td>
                <td className="px-4 py-3 font-medium text-neutral-700">{(player.points / player.gamesPlayed).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500">Tip: click GP, Goals, Assists, PTS, or PTS/GP to sort players.</p>
    </section>
  );
}
