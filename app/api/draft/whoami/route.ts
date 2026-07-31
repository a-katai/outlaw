import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const code = body.code?.trim().toUpperCase();
  if (!code) return NextResponse.json({ ok: false, error: "Enter your team code" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: codeRow, error: codeError } = await supabase
    .from("team_codes")
    .select("team_id")
    .eq("code", code)
    .maybeSingle();

  if (codeError) return NextResponse.json({ ok: false, error: codeError.message }, { status: 500 });
  if (!codeRow) return NextResponse.json({ ok: false, error: "Invalid code" }, { status: 404 });

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name, draft_order")
    .eq("id", codeRow.team_id)
    .single();

  if (teamError || !team) return NextResponse.json({ ok: false, error: "Team not found" }, { status: 404 });

  return NextResponse.json({ ok: true, team });
}
