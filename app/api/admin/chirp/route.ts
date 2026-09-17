import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

type Body = { action: "set-hidden"; id: string; hidden: boolean } | { action: "delete"; id: string };

type Row = { id: string; handle: string | null; body: string; hidden: boolean; created_at: string };

/** The moderation view — hidden chirps included, so a takedown can be undone. */
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("chirps")
    .select("id, handle, body, hidden, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    chirps: ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      handle: r.handle,
      body: r.body,
      hidden: r.hidden,
      createdAt: r.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!body || typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "Missing chirp id" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (body.action === "set-hidden") {
    const { error } = await supabase.from("chirps").update({ hidden: !!body.hidden }).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete") {
    const { error } = await supabase.from("chirps").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
