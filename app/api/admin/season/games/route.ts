import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

type Body =
  | {
      action: "add";
      seasonId: string;
      date: string;
      time?: string | null;
      homeTeamId: string;
      awayTeamId: string;
      note?: string | null;
    }
  | { action: "set-score"; id: string; homeScore: number; awayScore: number }
  | { action: "revert"; id: string }
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
    case "add": {
      if (!body.seasonId || !body.date || !body.homeTeamId || !body.awayTeamId) {
        return NextResponse.json({ ok: false, error: "Date, home team, and away team are required" }, { status: 400 });
      }
      if (body.homeTeamId === body.awayTeamId) {
        return NextResponse.json({ ok: false, error: "Home and away teams must differ" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("games")
        .insert({
          season_id: body.seasonId,
          game_date: body.date,
          game_time: body.time ?? null,
          home_team_id: body.homeTeamId,
          away_team_id: body.awayTeamId,
          note: body.note ?? null,
        })
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, game: data });
    }

    case "set-score": {
      const homeScore = Number(body.homeScore);
      const awayScore = Number(body.awayScore);
      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || homeScore < 0 || awayScore < 0) {
        return NextResponse.json({ ok: false, error: "Scores must be non-negative numbers" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("games")
        .update({ home_score: homeScore, away_score: awayScore, status: "final" })
        .eq("id", body.id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, game: data });
    }

    case "revert": {
      const { data, error } = await supabase
        .from("games")
        .update({ status: "scheduled", home_score: null, away_score: null })
        .eq("id", body.id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, game: data });
    }

    case "delete": {
      const { error } = await supabase.from("games").delete().eq("id", body.id);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }
}
