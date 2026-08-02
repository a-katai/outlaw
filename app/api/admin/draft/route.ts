import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { generateTeamCode } from "@/lib/team-code";
import type { DraftFormat } from "@/lib/draft-types";

type Body =
  | { action: "create"; name: string; format: DraftFormat; totalRounds: number }
  | { action: "start"; draftId: string }
  | { action: "pause"; draftId: string }
  | { action: "resume"; draftId: string }
  | { action: "undo"; draftId: string }
  | { action: "undo-to-pick"; draftId: string; targetPick: number; confirm?: boolean }
  | { action: "reset"; draftId: string; confirm?: boolean }
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
      const { data: liveDrafts, error: liveError } = await supabase
        .from("drafts")
        .select("id")
        .in("status", ["live", "paused"])
        .limit(1);
      if (liveError) return NextResponse.json({ ok: false, error: liveError.message }, { status: 500 });
      if (liveDrafts && liveDrafts.length > 0) {
        return NextResponse.json(
          { ok: false, error: "A draft is live — complete or reset it first." },
          { status: 400 },
        );
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

    case "undo-to-pick": {
      if (body.confirm !== true) {
        return NextResponse.json({ ok: false, error: "Undo-to-pick requires confirmation" }, { status: 400 });
      }
      const targetPick = Number(body.targetPick);
      if (!Number.isInteger(targetPick) || targetPick < 1) {
        return NextResponse.json({ ok: false, error: "targetPick must be a positive whole number" }, { status: 400 });
      }
      const { data: draft, error: fetchError } = await supabase
        .from("drafts")
        .select("current_pick")
        .eq("id", body.draftId)
        .single();
      if (fetchError || !draft) return NextResponse.json({ ok: false, error: "Draft not found" }, { status: 404 });
      if (targetPick >= draft.current_pick) {
        return NextResponse.json({ ok: false, error: "targetPick must be before the current pick" }, { status: 400 });
      }

      const CAP = 60;
      let current = draft.current_pick;
      let undone = 0;
      while (current > targetPick) {
        if (undone >= CAP) {
          return NextResponse.json(
            { ok: false, error: `Hit the ${CAP}-undo safety cap before reaching pick ${targetPick}`, undone },
            { status: 500 },
          );
        }
        const { data, error } = await supabase.rpc("undo_last_pick", { p_draft_id: body.draftId });
        if (error) {
          return NextResponse.json(
            { ok: false, error: `${error.message} — ${undone} pick(s) already undone, refresh`, undone },
            { status: 500 },
          );
        }
        if (!data?.ok) {
          return NextResponse.json(
            { ok: false, error: `${data?.error ?? "Undo failed"} — ${undone} pick(s) already undone, refresh`, undone },
            { status: 500 },
          );
        }
        undone++;
        current = data.undone_pick;
      }

      const { data: finalDraft, error: verifyError } = await supabase
        .from("drafts")
        .select("current_pick")
        .eq("id", body.draftId)
        .single();
      if (verifyError || !finalDraft || finalDraft.current_pick !== targetPick) {
        return NextResponse.json(
          { ok: false, error: "Undo-to-pick finished but current_pick didn't land on targetPick", undone },
          { status: 500 },
        );
      }

      return NextResponse.json({ ok: true, undone });
    }

    case "reset": {
      if (body.confirm !== true) {
        return NextResponse.json({ ok: false, error: "Reset requires confirmation" }, { status: 400 });
      }
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
      let { data: codeRow } = await supabase.from("team_codes").select("code").eq("team_id", teamId).maybeSingle();
      if (!codeRow) {
        // Rescue path: the on-clock team never generated a code. Mint one
        // server-side so the force-pick button never fails on this alone.
        const { data: minted, error: mintError } = await supabase
          .from("team_codes")
          .upsert({ team_id: teamId, code: generateTeamCode() }, { onConflict: "team_id" })
          .select("code")
          .single();
        if (mintError || !minted) {
          return NextResponse.json(
            { ok: false, error: mintError?.message ?? "Couldn't generate a pick code" },
            { status: 500 },
          );
        }
        codeRow = minted;
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
