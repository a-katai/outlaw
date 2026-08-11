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
  | { action: "delete"; id: string }
  | { action: "link"; paymentId: string; playerId: string }
  | { action: "unlink"; paymentId: string };

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

    case "link": {
      const paymentId = body.paymentId?.trim();
      const playerId = body.playerId?.trim();
      if (!paymentId || !playerId) {
        return NextResponse.json({ ok: false, error: "Choose a player to link" }, { status: 400 });
      }
      const { data: player, error: playerError } = await supabase
        .from("players")
        .select("id")
        .eq("id", playerId)
        .maybeSingle();
      if (playerError) return NextResponse.json({ ok: false, error: playerError.message }, { status: 500 });
      if (!player) return NextResponse.json({ ok: false, error: "Player not found" }, { status: 400 });

      const { data, error } = await supabase
        .from("payments")
        .update({ player_id: playerId })
        .eq("id", paymentId)
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, payment: data });
    }

    case "unlink": {
      const paymentId = body.paymentId?.trim();
      if (!paymentId) {
        return NextResponse.json({ ok: false, error: "Missing payment" }, { status: 400 });
      }
      // A payment logged against a player carries no payer_name, and the table
      // requires at least one of the two. Backfill the name we're about to drop
      // so unlinking can never trip the check constraint.
      const { data: existing, error: existingError } = await supabase
        .from("payments")
        .select("payer_name, players(name)")
        .eq("id", paymentId)
        .maybeSingle<{ payer_name: string | null; players: { name: string } | null }>();
      if (existingError) {
        return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
      }
      if (!existing) return NextResponse.json({ ok: false, error: "Payment not found" }, { status: 400 });

      const payerName = existing.payer_name ?? existing.players?.name ?? "Unknown payer";
      const { data, error } = await supabase
        .from("payments")
        .update({ player_id: null, payer_name: payerName })
        .eq("id", paymentId)
        .select("*")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, payment: data });
    }

    default:
      return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }
}
