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
  | { action: "complete"; draftId: string; confirm?: boolean }
  | { action: "reopen"; draftId: string; confirm?: boolean }
  | { action: "undo"; draftId: string }
  | { action: "undo-to-pick"; draftId: string; targetPick: number; confirm?: boolean }
  | { action: "reset"; draftId: string; confirm?: boolean }
  | { action: "delete-draft"; draftId: string; confirm?: boolean }
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
      // Only one non-complete draft may exist. A second 'setup' draft would
      // shadow the live one everywhere "latest draft" is resolved, silently
      // bypassing the live-draft guards.
      const { data: liveDrafts, error: liveError } = await supabase
        .from("drafts")
        .select("id")
        .in("status", ["setup", "live", "paused"])
        .limit(1);
      if (liveError) return NextResponse.json({ ok: false, error: liveError.message }, { status: 500 });
      if (liveDrafts && liveDrafts.length > 0) {
        return NextResponse.json(
          { ok: false, error: "A draft already exists — complete or delete it first." },
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

    // End the draft by hand. make_pick only flips status to 'complete' when a
    // pick is actually made, so a draft whose pool runs dry before the last
    // slot (59 players into 60 picks) would otherwise sit on the clock forever
    // — never completing, never releasing the season-phase pill.
    case "complete": {
      if (body.confirm !== true) {
        return NextResponse.json({ ok: false, error: "Ending the draft requires confirmation" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("drafts")
        .update({ status: "complete" })
        .eq("id", body.draftId)
        .in("status", ["live", "paused"])
        .select("*")
        .single();
      if (error || !data) {
        return NextResponse.json({ ok: false, error: "Only a live or paused draft can be ended" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, draft: data });
    }

    // Undo an early/accidental end. Comes back paused, never straight to live,
    // so picking can't resume until the commissioner deliberately resumes.
    case "reopen": {
      if (body.confirm !== true) {
        return NextResponse.json({ ok: false, error: "Reopening the draft requires confirmation" }, { status: 400 });
      }
      // Same shadow-draft guard as create: if a newer draft was started after
      // this one ended, reopening would put two non-complete drafts in play.
      const { data: openDrafts, error: openError } = await supabase
        .from("drafts")
        .select("id")
        .in("status", ["setup", "live", "paused"])
        .limit(1);
      if (openError) return NextResponse.json({ ok: false, error: openError.message }, { status: 500 });
      if (openDrafts && openDrafts.length > 0) {
        return NextResponse.json(
          { ok: false, error: "Another draft is already open — complete or delete it first." },
          { status: 400 },
        );
      }
      const { data, error } = await supabase
        .from("drafts")
        .update({ status: "paused" })
        .eq("id", body.draftId)
        .eq("status", "complete")
        .select("*")
        .single();
      if (error || !data) {
        return NextResponse.json({ ok: false, error: "Draft is not complete" }, { status: 400 });
      }
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

    case "delete-draft": {
      if (body.confirm !== true) {
        return NextResponse.json({ ok: false, error: "Delete requires confirmation" }, { status: 400 });
      }
      // Picks cascade via FK; this also frees the create guard for a fresh draft.
      const { error } = await supabase.from("drafts").delete().eq("id", body.draftId);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
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
