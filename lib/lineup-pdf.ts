/**
 * The final lineup as a printable game sheet.
 *
 * One primitive, shared by the manager's lineup page and the admin season tab
 * (and shaped to take any number of benches, so a both-teams sheet is the same
 * call). Rows carry only jersey, name and position — phone numbers are
 * deliberately not part of the type, because a PDF gets forwarded and printed
 * and phones only ever render on the code-gated manager page.
 */
import type { jsPDF as JsPDF } from "jspdf";

export type LineupRow = { jersey: number | null; name: string; position: string | null };
export type LineupTeam = { teamName: string; players: LineupRow[] };

export type LineupSheet = {
  /** "Toe Dragons" for one bench, "Toe Dragons at Tank Fillers" for both. */
  title: string;
  /** "Wed, Sep 16 · 10:00 PM · Rink B" — the game, in one line. */
  subtitle: string;
  teams: LineupTeam[];
  fileName: string;
};

/** Goalie last, then by jersey, then A–Z — the order a bench reads in. */
export function sortLineup(rows: LineupRow[]): LineupRow[] {
  return [...rows].sort((a, b) => {
    const ag = a.position === "G" ? 1 : 0;
    const bg = b.position === "G" ? 1 : 0;
    if (ag !== bg) return ag - bg;
    if (a.jersey != null && b.jersey != null) return a.jersey - b.jersey;
    if (a.jersey != null) return -1;
    if (b.jersey != null) return 1;
    return a.name.localeCompare(b.name);
  });
}

/** "Wed, Sep 16" from a YYYY-MM-DD date, parsed local so it never slips a day. */
export function formatSheetDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Slug for a filename: "Toe Dragons" → "toe-dragons". */
export function fileSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const lastY = (doc: JsPDF) =>
  (doc as JsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 0;

export async function downloadLineupPdf(sheet: LineupSheet): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(`Outlaw Hockey League — ${sheet.title}`, 14, 18);
  doc.setFontSize(10);
  doc.text(sheet.subtitle, 14, 25);

  let startY = 34;
  for (const team of sheet.teams) {
    const players = sortLineup(team.players);
    doc.setFontSize(12);
    doc.text(`${team.teamName} · ${players.length} dressed`, 14, startY);

    autoTable(doc, {
      startY: startY + 3,
      head: [["#", "Player", "Pos"]],
      // A blank number or position reads as blank, never "None" or a guess —
      // most of the league has never claimed a jersey, and one player has no
      // position on file.
      body: players.length
        ? players.map((p) => [p.jersey != null ? String(p.jersey) : "", p.name, p.position ?? ""])
        : [["", "No one dressed yet", ""]],
      styles: { fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: [29, 29, 31] },
      columnStyles: {
        0: { cellWidth: 14, halign: "center", fontStyle: "bold" },
        2: { cellWidth: 16, halign: "center" },
      },
    });

    startY = lastY(doc) + 12;
  }

  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text(`Generated ${new Date().toLocaleString("en-US")} · outlawhl.com`, 14, Math.min(startY, 285));

  doc.save(sheet.fileName);
}
