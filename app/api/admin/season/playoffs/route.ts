import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

type Body =
  | {
      action: "create";
      seasonId: string;
      round: number;
      name: string;
      position?: number;
      bestOf?: number;
      teamA?: string | null;
      teamB?: string | null;
    }
  | { action: "edit-teams"; id: string; teamA: string | null; teamB: string | null }
  | { action: "set-winner"; id: string; winnerTeamId: string }
  | { action: "clear-winner"; id: string }
  | { action: "delete"; id: string };

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
    case "create": {
      if (!body.seasonId || !body.name?.trim() || !Number.isFinite(body.round)) {
        return NextResponse.json({ ok: false, error: "Season, round, and name are required" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("playoff_series")
        .insert({
          season_id: body.seasonId,
          round: body.round,
          name: body.name.trim(),
          position: body.position ?? 1,
          best_of: body.bestOf ?? 3,
          team_a: body.teamA ?? null,
          team_b: body.teamB ?? null,
        })
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, series: data });
    }

    case "edit-teams": {
      const { data, error } = await supabase
        .from("playoff_series")
        .update({ team_a: body.teamA ?? null, team_b: body.teamB ?? null })
        .eq("id", body.id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, series: data });
    }

    case "set-winner": {
      if (!body.winnerTeamId) {
        return NextResponse.json({ ok: false, error: "winnerTeamId is required" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("playoff_series")
        .update({ winner_team_id: body.winnerTeamId })
        .eq("id", body.id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, series: data });
    }

    case "clear-winner": {
      const { data, error } = await supabase
        .from("playoff_series")
        .update({ winner_team_id: null })
        .eq("id", body.id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, series: data });
    }

    case "delete": {
      const { error } = await supabase.from("playoff_series").delete().eq("id", body.id);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }
}
