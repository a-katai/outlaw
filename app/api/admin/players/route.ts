import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import type { PlayerPosition } from "@/lib/draft-types";

type Body =
  | { action: "add"; name: string; position?: PlayerPosition | null; rank?: number | null }
  | { action: "bulk"; text: string }
  | { action: "delete"; id: string };

const POSITION_VALUES = new Set<PlayerPosition>(["F", "D", "G", "F/D"]);

/** Mirrors the `players_rank_check` DB constraint (1–20) so bad input 400s with a clear message instead of a raw Postgres error. */
function isValidRank(rank: number): boolean {
  return Number.isInteger(rank) && rank >= 1 && rank <= 20;
}

/** Parses "Name [position] [rank]" — trailing rank (integer) and/or trailing
 * position (F/D/G/F-D, case-insensitive) are both optional, in either
 * combination — e.g. "Mike Smith F 3", "Mike Smith 3", "Mike Smith F", "Sam Sample". */
function parseBulkLine(line: string): { name: string; position: PlayerPosition | null; rank: number | null } | null {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  let rank: number | null = null;
  if (tokens.length > 1 && /^\d+$/.test(tokens[tokens.length - 1])) {
    rank = Number(tokens.pop());
  }

  let position: PlayerPosition | null = null;
  if (tokens.length > 1) {
    const last = tokens[tokens.length - 1].toUpperCase() as PlayerPosition;
    if (POSITION_VALUES.has(last)) {
      position = last;
      tokens.pop();
    }
  }

  const name = tokens.join(" ").trim();
  if (!name) return null;
  return { name, position, rank };
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (body.action) {
    case "add": {
      if (!body.name?.trim()) return NextResponse.json({ ok: false, error: "Player name is required" }, { status: 400 });
      const rank = body.rank === null || body.rank === undefined ? null : Number(body.rank);
      if (rank !== null && !isValidRank(rank)) {
        return NextResponse.json({ ok: false, error: "Rank must be a whole number between 1 and 20" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("players")
        .insert({ name: body.name.trim(), position: body.position ?? null, rank })
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, player: data });
    }

    case "bulk": {
      const rows = (body.text ?? "")
        .split("\n")
        .map(parseBulkLine)
        .filter((row): row is { name: string; position: PlayerPosition | null; rank: number | null } => row !== null);
      if (rows.length === 0) {
        return NextResponse.json({ ok: false, error: "No player names found" }, { status: 400 });
      }
      const badRankRow = rows.find((r) => r.rank !== null && !isValidRank(r.rank));
      if (badRankRow) {
        return NextResponse.json(
          { ok: false, error: `"${badRankRow.name}" has an invalid rank — must be a whole number between 1 and 20` },
          { status: 400 },
        );
      }
      const { data, error } = await supabase
        .from("players")
        .insert(rows.map((r) => ({ name: r.name, position: r.position, rank: r.rank })))
        .select("*");
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, players: data, count: data?.length ?? 0 });
    }

    case "delete": {
      const { error } = await supabase.from("players").delete().eq("id", body.id);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }
}
