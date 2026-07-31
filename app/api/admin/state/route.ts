import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const [draftsRes, teamsRes, codesRes, playersRes, paymentsRes] = await Promise.all([
    supabase.from("drafts").select("*").order("created_at", { ascending: false }),
    supabase.from("teams").select("*").order("draft_order", { ascending: true, nullsFirst: false }),
    supabase.from("team_codes").select("*"),
    supabase.from("players").select("*").order("name", { ascending: true }),
    supabase.from("payments").select("*").order("paid_on", { ascending: false }),
  ]);

  for (const res of [draftsRes, teamsRes, codesRes, playersRes, paymentsRes]) {
    if (res.error) {
      return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
    }
  }

  const draft = draftsRes.data?.[0] ?? null;
  let picks: unknown[] = [];
  if (draft) {
    const picksRes = await supabase
      .from("draft_picks")
      .select("*")
      .eq("draft_id", draft.id)
      .order("pick_number", { ascending: true });
    if (picksRes.error) {
      return NextResponse.json({ ok: false, error: picksRes.error.message }, { status: 500 });
    }
    picks = picksRes.data ?? [];
  }

  const codeByTeam = new Map((codesRes.data ?? []).map((c) => [c.team_id, c.code]));
  const teams = (teamsRes.data ?? []).map((t) => ({ ...t, code: codeByTeam.get(t.id) ?? null }));

  return NextResponse.json({
    ok: true,
    draft,
    drafts: draftsRes.data ?? [],
    teams,
    players: playersRes.data ?? [],
    picks,
    payments: paymentsRes.data ?? [],
  });
}
