import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import type { PaymentMethod } from "@/lib/draft-types";

type Body =
  | {
      action: "add";
      playerId?: string | null;
      payerName?: string | null;
      amountCents: number;
      method: PaymentMethod;
      season?: string | null;
      note?: string | null;
      paidOn?: string | null;
    }
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
      const amountCents = Number(body.amountCents);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        return NextResponse.json({ ok: false, error: "Amount must be greater than $0" }, { status: 400 });
      }
      if (!body.playerId && !body.payerName?.trim()) {
        return NextResponse.json({ ok: false, error: "Choose a player or enter a payer name" }, { status: 400 });
      }
      const insert: Record<string, unknown> = {
        player_id: body.playerId || null,
        payer_name: body.playerId ? null : body.payerName?.trim(),
        amount_cents: Math.round(amountCents),
        method: body.method,
        season: body.season?.trim() || null,
        note: body.note?.trim() || null,
      };
      if (body.paidOn) insert.paid_on = body.paidOn;
      const { data, error } = await supabase.from("payments").insert(insert).select("*").single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, payment: data });
    }

    case "delete": {
      const { error } = await supabase.from("payments").delete().eq("id", body.id);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }
}
