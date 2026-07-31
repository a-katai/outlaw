import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import type { PlayerPosition } from "@/lib/draft-types";

type Body =
  | { action: "add"; name: string; position?: PlayerPosition | null }
  | { action: "bulk"; text: string }
  | { action: "delete"; id: string };

const POSITION_RE = /^(.*\S)\s+([FDG])$/i;

function parseBulkLine(line: string): { name: string; position: PlayerPosition | null } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const match = trimmed.match(POSITION_RE);
  if (match) {
    return { name: match[1].trim(), position: match[2].toUpperCase() as PlayerPosition };
  }
  return { name: trimmed, position: null };
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
      const { data, error } = await supabase
        .from("players")
        .insert({ name: body.name.trim(), position: body.position ?? null })
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, player: data });
    }

    case "bulk": {
      const rows = (body.text ?? "")
        .split("\n")
        .map(parseBulkLine)
        .filter((row): row is { name: string; position: PlayerPosition | null } => row !== null);
      if (rows.length === 0) {
        return NextResponse.json({ ok: false, error: "No player names found" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("players")
        .insert(rows.map((r) => ({ name: r.name, position: r.position })))
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
