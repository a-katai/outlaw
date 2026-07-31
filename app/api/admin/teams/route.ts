import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

type Body =
  | { action: "add"; name: string; color?: string | null; draftOrder?: number | null; captainPlayerId?: string | null }
  | {
      action: "update";
      id: string;
      name?: string;
      color?: string | null;
      draftOrder?: number | null;
      captainPlayerId?: string | null;
    }
  | { action: "delete"; id: string }
  | { action: "generate-code"; id: string };

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

function generateCode(): string {
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
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
      if (!body.name?.trim()) return NextResponse.json({ ok: false, error: "Team name is required" }, { status: 400 });
      const { data, error } = await supabase
        .from("teams")
        .insert({
          name: body.name.trim(),
          color: body.color ?? null,
          draft_order: body.draftOrder ?? null,
          captain_player_id: body.captainPlayerId ?? null,
        })
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, team: data });
    }

    case "update": {
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = body.name.trim();
      if (body.color !== undefined) patch.color = body.color;
      if (body.draftOrder !== undefined) patch.draft_order = body.draftOrder;
      if (body.captainPlayerId !== undefined) patch.captain_player_id = body.captainPlayerId;
      const { data, error } = await supabase.from("teams").update(patch).eq("id", body.id).select("*").single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, team: data });
    }

    case "delete": {
      const { error } = await supabase.from("teams").delete().eq("id", body.id);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "generate-code": {
      const code = generateCode();
      const { data, error } = await supabase
        .from("team_codes")
        .upsert({ team_id: body.id, code }, { onConflict: "team_id" })
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, code: data.code });
    }

    default:
      return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }
}
