import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

type Body =
  | { action: "adopt-draft-teams"; seasonId: string }
  | { action: "add"; seasonId: string; name: string }
  | { action: "rename"; id: string; name: string }
  | { action: "remove"; id: string };

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
    case "adopt-draft-teams": {
      const { data, error } = await supabase
        .from("teams")
        .update({ season_id: body.seasonId })
        .not("draft_order", "is", null)
        .is("season_id", null)
        .select("*");
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, teams: data });
    }

    case "add": {
      if (!body.name?.trim()) return NextResponse.json({ ok: false, error: "Team name is required" }, { status: 400 });
      const { data, error } = await supabase
        .from("teams")
        .insert({ name: body.name.trim(), season_id: body.seasonId })
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, team: data });
    }

    case "rename": {
      if (!body.name?.trim()) return NextResponse.json({ ok: false, error: "Team name is required" }, { status: 400 });
      const { data, error } = await supabase
        .from("teams")
        .update({ name: body.name.trim() })
        .eq("id", body.id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, team: data });
    }

    case "remove": {
      const { error } = await supabase.from("teams").update({ season_id: null }).eq("id", body.id);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }
}
