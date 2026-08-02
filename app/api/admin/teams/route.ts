import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { generateTeamCode } from "@/lib/team-code";

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
      if (body.draftOrder !== undefined) {
        const { data: latestDraft } = await supabase
          .from("drafts")
          .select("status")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestDraft && (latestDraft.status === "live" || latestDraft.status === "paused")) {
          return NextResponse.json(
            { ok: false, error: "Can't change draft order during a live draft" },
            { status: 400 },
          );
        }

        if (body.draftOrder !== null) {
          if (!Number.isInteger(body.draftOrder) || body.draftOrder < 1 || body.draftOrder > 20) {
            return NextResponse.json(
              { ok: false, error: "Draft order must be a whole number between 1 and 20" },
              { status: 400 },
            );
          }
          const { data: clash } = await supabase
            .from("teams")
            .select("name")
            .eq("draft_order", body.draftOrder)
            .neq("id", body.id)
            .maybeSingle();
          if (clash) {
            return NextResponse.json(
              { ok: false, error: `${clash.name} already has draft order ${body.draftOrder}` },
              { status: 400 },
            );
          }
        }
      }

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
      const code = generateTeamCode();
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
