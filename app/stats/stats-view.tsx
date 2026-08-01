"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { jsPDF as JsPDF } from "jspdf";

import { getTeamColors, type SkaterStat, type TeamStanding } from "@/lib/league-data";
import type { LiveRosterPlayer, LiveTeam, SeasonSummary } from "@/lib/live-season";

type SortKey = "gamesPlayed" | "goals" | "assists" | "points" | "ppg";

export type StatsSeasonViewModel = {
  id: string;
  label: string;
  standings: TeamStanding[];
  skaters: SkaterStat[];
  teams?: LiveTeam[];
  rosters?: Record<string, LiveRosterPlayer[]>;
  hasFinalGames?: boolean;
};

export function StatsView({ season, catalogue }: { season: StatsSeasonViewModel; catalogue: SeasonSummary[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("points");

  const { leaguePlayers, subPlayers } = useMemo(() => {
    const sortPlayers = <T extends (typeof season.skaters)[number]>(players: T[]) => {
      const copied = [...players];
      copied.sort((a, b) => {
        if (sortKey === "ppg") {
          return b.points / b.gamesPlayed - a.points / a.gamesPlayed;
        }
        return b[sortKey] - a[sortKey];
      });
      return copied;
    };

    const league = season.skaters.filter((player) => player.team !== "Sub");
    const subs = season.skaters.filter((player) => player.team === "Sub");

    return {
      leaguePlayers: sortPlayers(league),
      subPlayers: sortPlayers(subs),
    };
  }, [season, sortKey]);

  const sortButtonClass = (key: SortKey) =>
    `font-semibold transition hover:text-neutral-800 ${sortKey === key ? "text-neutral-900 underline underline-offset-4" : ""}`;

  const hexToRgb = (hex: string) => {
    const normalized = hex.replace("#", "");
    const value = normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
    return [
      Number.parseInt(value.slice(0, 2), 16),
      Number.parseInt(value.slice(2, 4), 16),
      Number.parseInt(value.slice(4, 6), 16),
    ] as [number, number, number];
  };

  const downloadStandingsPdf = async () => {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Outlaw Hockey League Standings — ${season.label}`, 14, 18);
    doc.setFontSize(10);
    doc.text("League standings export", 14, 25);

    autoTable(doc, {
      startY: 32,
      head: [["Team", "GP", "W", "L", "T", "PTS", "PTS%", "GF", "GA", "DIFF"]],
      body: season.standings.map((team) => [
        team.team,
        team.gp,
        team.wins,
        team.losses,
        team.ties,
        team.points,
        team.pct,
        team.goalsFor,
        team.goalsAgainst,
        team.diff >= 0 ? `+${team.diff}` : `${team.diff}`,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [29, 29, 31] },
      didParseCell: (data) => {
        if (data.section !== "body" || data.column.index !== 0) return;
        const teamName = String(data.cell.raw ?? "");
        const colors = getTeamColors(teamName);
        data.cell.styles.fillColor = hexToRgb(colors.background);
        data.cell.styles.textColor = hexToRgb(colors.text);
        data.cell.styles.lineColor = hexToRgb(colors.border);
        data.cell.styles.lineWidth = 0.25;
      },
    });

    doc.save(`outlaw-standings-${season.id}.pdf`);
  };

  const downloadPlayerStatsPdf = async () => {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Outlaw Hockey League Player Stats — ${season.label}`, 14, 18);
    doc.setFontSize(10);
    doc.text("League players and subs export", 14, 25);

    autoTable(doc, {
      startY: 32,
      head: [["League Players", "Team", "GP", "G", "A", "PTS", "PTS/GP"]],
      body: leaguePlayers.map((player) => [
        player.player,
        player.team,
        player.gamesPlayed,
        player.goals,
        player.assists,
        player.points,
        (player.points / player.gamesPlayed).toFixed(2),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [29, 29, 31] },
      didParseCell: (data) => {
        if (data.section !== "body" || data.column.index !== 1) return;
        const teamName = String(data.cell.raw ?? "");
        const colors = getTeamColors(teamName);
        data.cell.styles.fillColor = hexToRgb(colors.background);
        data.cell.styles.textColor = hexToRgb(colors.text);
        data.cell.styles.lineColor = hexToRgb(colors.border);
        data.cell.styles.lineWidth = 0.25;
      },
    });

    if (subPlayers.length > 0) {
    autoTable(doc, {
      startY: (doc as JsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
        ? ((doc as JsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 0) + 10
        : 40,
      head: [["Subs", "Team", "GP", "G", "A", "PTS", "PTS/GP"]],
      body: subPlayers.map((player) => [
        player.player,
        player.team,
        player.gamesPlayed,
        player.goals,
        player.assists,
        player.points,
        (player.points / player.gamesPlayed).toFixed(2),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
      didParseCell: (data) => {
        if (data.section !== "body" || data.column.index !== 1) return;
        const teamName = String(data.cell.raw ?? "");
        const colors = getTeamColors(teamName);
        data.cell.styles.fillColor = hexToRgb(colors.background);
        data.cell.styles.textColor = hexToRgb(colors.text);
        data.cell.styles.lineColor = hexToRgb(colors.border);
        data.cell.styles.lineWidth = 0.25;
      },
    });
    }

    doc.save(`outlaw-player-stats-${season.id}.pdf`);
  };

  const hasData = season.hasFinalGames ?? (season.standings.length > 0 || season.skaters.length > 0);
  const rosterTeams = (season.teams ?? []).filter((t) => (season.rosters?.[t.name]?.length ?? 0) > 0);

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">League Hub</p>
        <h1 className="mt-2 text-4xl font-semibold text-neutral-900">Stats · {season.label}</h1>

        <div className="mt-5 inline-flex items-center gap-1 rounded-full border border-black/10 bg-neutral-100/80 p-1">
          {catalogue.map((s) => (
            <Link
              key={s.id}
              href={`/stats?season=${s.id}`}
              scroll={false}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                s.id === season.id ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>

        {hasData && (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <button type="button" onClick={downloadStandingsPdf} className="text-neutral-600 underline underline-offset-4 transition hover:text-neutral-900">
              Download standings PDF
            </button>
            <button type="button" onClick={downloadPlayerStatsPdf} className="text-neutral-600 underline underline-offset-4 transition hover:text-neutral-900">
              Download player stats PDF
            </button>
          </div>
        )}
      </div>

      {!hasData ? (
        <>
          <div className="glass-card rounded-3xl px-8 py-20 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{season.label} Season</p>
            <h2 className="mt-3 text-3xl font-semibold text-neutral-900">No stats yet</h2>
            <p className="mt-3 text-sm text-neutral-500">
              The {season.label} season starts after the draft.{" "}
              <Link href="/draft" className="text-neutral-700 underline underline-offset-4 transition hover:text-neutral-900">
                See the draft board
              </Link>
              .
            </p>
          </div>

          {rosterTeams.length > 0 ? (
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900">Rosters</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rosterTeams.map((team) => (
                  <div key={team.id} className="glass-card rounded-3xl p-5">
                    <span
                      className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                      style={{
                        backgroundColor: getTeamColors(team.name).background,
                        color: getTeamColors(team.name).text,
                        borderColor: getTeamColors(team.name).border,
                      }}
                    >
                      {team.name}
                    </span>
                    <ul className="mt-4 space-y-1.5 text-sm text-neutral-700">
                      {(season.rosters?.[team.name] ?? []).map((player) => (
                        <li key={player.id} className="flex items-center justify-between gap-2">
                          <span className="truncate">{player.name}</span>
                          {player.position ? (
                            <span className="shrink-0 text-xs font-medium text-neutral-400">{player.position}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="glass-card overflow-hidden rounded-3xl md:hidden">
            <div className="grid grid-cols-[minmax(0,1.5fr)_repeat(5,minmax(0,1fr))] gap-2 border-b border-black/5 bg-neutral-50/90 px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              <p>Team</p>
              <p className="text-center">GP</p>
              <p className="text-center">W</p>
              <p className="text-center">L</p>
              <p className="text-center">PTS</p>
              <p className="text-center">DIFF</p>
            </div>
            <div className="divide-y divide-black/5">
              {season.standings.map((team) => (
                <div key={team.team} className="grid grid-cols-[minmax(0,1.5fr)_repeat(5,minmax(0,1fr))] gap-2 px-3 py-3 text-xs text-neutral-700">
                  <div className="min-w-0">
                    <span
                      className="inline-flex max-w-full items-center rounded-full border px-2 py-1 text-[10px] font-semibold"
                      style={{
                        backgroundColor: getTeamColors(team.team).background,
                        color: getTeamColors(team.team).text,
                        borderColor: getTeamColors(team.team).border,
                      }}
                    >
                      <span className="truncate">{team.team}</span>
                    </span>
                  </div>
                  <p className="text-center">{team.gp}</p>
                  <p className="text-center">{team.wins}</p>
                  <p className="text-center">{team.losses}</p>
                  <p className="text-center font-semibold text-neutral-900">{team.points}</p>
                  <p className={`text-center font-semibold ${team.diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {team.diff >= 0 ? `+${team.diff}` : team.diff}
                  </p>
                </div>
              ))}
            </div>
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
                {season.standings.map((team) => (
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

          <div className="glass-card overflow-hidden rounded-3xl md:hidden">
            <div className="grid grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(0,1fr))] gap-2 border-b border-black/5 bg-neutral-50/90 px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              <p>Player</p>
              <p className="text-center">GP</p>
              <p className="text-center">G</p>
              <p className="text-center">A</p>
              <p className="text-center">PTS</p>
            </div>
            <div className="divide-y divide-black/5">
              {leaguePlayers.map((player) => (
                <div key={player.player} className="grid grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(0,1fr))] gap-2 px-3 py-3 text-xs text-neutral-700">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-neutral-900">{player.player}</p>
                    <span
                      className="mt-1 inline-flex max-w-full items-center rounded-full border px-2 py-1 text-[10px] font-semibold"
                      style={{
                        backgroundColor: getTeamColors(player.team).background,
                        color: getTeamColors(player.team).text,
                        borderColor: getTeamColors(player.team).border,
                      }}
                    >
                      <span className="truncate">{player.team}</span>
                    </span>
                  </div>
                  <p className="text-center">{player.gamesPlayed}</p>
                  <p className="text-center">{player.goals}</p>
                  <p className="text-center">{player.assists}</p>
                  <div className="text-center">
                    <p className="font-semibold text-neutral-900">{player.points}</p>
                    <p className="text-[10px] text-neutral-500">{(player.points / player.gamesPlayed).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
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

          {subPlayers.length > 0 ? (
          <>
          <div>
            <h2 className="text-2xl font-semibold text-neutral-900">Subs</h2>
          </div>

          <div className="glass-card overflow-hidden rounded-3xl md:hidden">
            <div className="grid grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(0,1fr))] gap-2 border-b border-black/5 bg-neutral-50/90 px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              <p>Sub</p>
              <p className="text-center">GP</p>
              <p className="text-center">G</p>
              <p className="text-center">A</p>
              <p className="text-center">PTS</p>
            </div>
            <div className="divide-y divide-black/5">
              {subPlayers.map((player) => (
                <div key={player.player} className="grid grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(0,1fr))] gap-2 px-3 py-3 text-xs text-neutral-700">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-neutral-900">{player.player}</p>
                    <span
                      className="mt-1 inline-flex max-w-full items-center rounded-full border px-2 py-1 text-[10px] font-semibold"
                      style={{
                        backgroundColor: getTeamColors(player.team).background,
                        color: getTeamColors(player.team).text,
                        borderColor: getTeamColors(player.team).border,
                      }}
                    >
                      <span className="truncate">{player.team}</span>
                    </span>
                  </div>
                  <p className="text-center">{player.gamesPlayed}</p>
                  <p className="text-center">{player.goals}</p>
                  <p className="text-center">{player.assists}</p>
                  <div className="text-center">
                    <p className="font-semibold text-neutral-900">{player.points}</p>
                    <p className="text-[10px] text-neutral-500">{(player.points / player.gamesPlayed).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
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
          </>
          ) : null}
          <p className="text-xs text-neutral-500">Tip: click GP, Goals, Assists, PTS, or PTS/GP to sort players.</p>
        </>
      )}
    </section>
  );
}
