import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import type { DraftFormat } from "@/lib/draft-types";

type Body =
  | { action: "create"; name: string; format: DraftFormat; totalRounds: number }
  | { action: "start"; draftId: string }
  | { action: "pause"; draftId: string }
  | { action: "resume"; draftId: string }
  | { action: "undo"; draftId: string }
  | { action: "reset"; draftId: string }
  | { action: "force-pick"; draftId: string; playerId: string };

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
      const name = body.name?.trim() || "Draft";
      const totalRounds = Number(body.totalRounds);
      if (!Number.isFinite(totalRounds) || totalRounds < 1) {
        return NextResponse.json({ ok: false, error: "total_rounds must be a positive number" }, { status: 400 });
      }
      if (body.format !== "snake" && body.format !== "linear") {
        return NextResponse.json({ ok: false, error: "format must be snake or linear" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("drafts")
        .insert({ name, format: body.format, total_rounds: totalRounds })
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, draft: data });
    }

    case "start": {
      const { data: draft, error: fetchError } = await supabase
        .from("drafts")
        .select("*")
        .eq("id", body.draftId)
        .single();
      if (fetchError || !draft) return NextResponse.json({ ok: false, error: "Draft not found" }, { status: 404 });
      if (draft.status !== "setup") {
        return NextResponse.json({ ok: false, error: `Draft is already ${draft.status}` }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("drafts")
        .update({ status: "live" })
        .eq("id", body.draftId)
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, draft: data });
    }

    case "pause": {
      const { data, error } = await supabase
        .from("drafts")
        .update({ status: "paused" })
        .eq("id", body.draftId)
        .eq("status", "live")
        .select("*")
        .single();
      if (error || !data) return NextResponse.json({ ok: false, error: "Draft is not live" }, { status: 400 });
      return NextResponse.json({ ok: true, draft: data });
    }

    case "resume": {
      const { data, error } = await supabase
        .from("drafts")
        .update({ status: "live" })
        .eq("id", body.draftId)
        .eq("status", "paused")
        .select("*")
        .single();
      if (error || !data) return NextResponse.json({ ok: false, error: "Draft is not paused" }, { status: 400 });
      return NextResponse.json({ ok: true, draft: data });
    }

    case "undo": {
      const { data, error } = await supabase.rpc("undo_last_pick", { p_draft_id: body.draftId });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    case "reset": {
      const { error: deleteError } = await supabase.from("draft_picks").delete().eq("draft_id", body.draftId);
      if (deleteError) return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
      const { data, error } = await supabase
        .from("drafts")
        .update({ current_pick: 1, status: "setup" })
        .eq("id", body.draftId)
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, draft: data });
    }

    case "force-pick": {
      const { data: teamId, error: clockError } = await supabase.rpc("team_on_clock", {
        p_draft_id: body.draftId,
      });
      if (clockError || !teamId) {
        return NextResponse.json({ ok: false, error: clockError?.message ?? "No team on the clock" }, { status: 400 });
      }
      const { data: codeRow, error: codeError } = await supabase
        .from("team_codes")
        .select("code")
        .eq("team_id", teamId)
        .single();
      if (codeError || !codeRow) {
        return NextResponse.json({ ok: false, error: "On-clock team has no pick code" }, { status: 400 });
      }
      const { data, error } = await supabase.rpc("make_pick", {
        p_draft_id: body.draftId,
        p_code: codeRow.code,
        p_player_id: body.playerId,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    default:
      return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }
}
