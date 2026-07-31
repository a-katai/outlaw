import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEASON = "Summer 2026";
const CLOVER_CHARGES_URL = "https://scl.clover.com/v1/charges";

type ChargeBody = {
  token?: unknown;
  name?: unknown;
  email?: unknown;
  amountCents?: unknown;
};

function detroitDateISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function cloverErrorMessage(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const errorField = record.error;
    if (errorField && typeof errorField === "object") {
      const msg = (errorField as Record<string, unknown>).message;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
    if (typeof record.message === "string" && record.message.trim()) return record.message;
  }
  if (status === 401 || status === 403) {
    return "Payment provider rejected the request. Please try again later.";
  }
  return "Your card could not be charged. Please check your details and try again.";
}

export async function POST(req: NextRequest) {
  let body: ChargeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const token = typeof body.token === "string" ? body.token : "";
  const amountCents =
    typeof body.amountCents === "number" ? body.amountCents : Number(body.amountCents);

  if (!name) {
    return NextResponse.json({ ok: false, error: "Enter your name." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 100000) {
    return NextResponse.json({ ok: false, error: "Amount must be between $1 and $1,000." }, { status: 400 });
  }
  if (!token || !token.startsWith("clv_")) {
    return NextResponse.json({ ok: false, error: "Invalid payment token." }, { status: 400 });
  }

  const privateToken = process.env.CLOVER_PRIVATE_TOKEN;
  if (!privateToken) {
    console.error("CLOVER_PRIVATE_TOKEN is not set");
    return NextResponse.json({ ok: false, error: "Payments are temporarily unavailable." }, { status: 500 });
  }

  let chargeRes: Response;
  try {
    chargeRes = await fetch(CLOVER_CHARGES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${privateToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountCents,
        currency: "usd",
        source: token,
        description: `Outlaw Hockey League dues — ${name}`,
        receipt_email: email,
      }),
    });
  } catch (err) {
    console.error("Clover charge request failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not reach the payment provider. Please try again." },
      { status: 502 },
    );
  }

  let chargeData: unknown = null;
  try {
    chargeData = await chargeRes.json();
  } catch {
    chargeData = null;
  }

  if (!chargeRes.ok) {
    const message = cloverErrorMessage(chargeRes.status, chargeData);
    console.error("Clover charge rejected:", chargeRes.status, message);
    return NextResponse.json({ ok: false, error: message }, { status: 402 });
  }

  const chargeRecord = chargeData && typeof chargeData === "object" ? (chargeData as Record<string, unknown>) : {};
  const chargeId = typeof chargeRecord.id === "string" ? chargeRecord.id : null;

  let ledgerLogged = true;
  try {
    const supabase = createAdminClient();
    const { data: matchedPlayer } = await supabase
      .from("players")
      .select("id")
      .eq("name", name)
      .limit(1)
      .maybeSingle();

    const { error: insertError } = await supabase.from("payments").insert({
      player_id: matchedPlayer?.id ?? null,
      payer_name: name,
      amount_cents: amountCents,
      method: "card",
      season: SEASON,
      note: `Clover ${chargeId ?? "unknown"} · ${email}`,
      paid_on: detroitDateISO(),
    });

    if (insertError) {
      ledgerLogged = false;
      console.error("Failed to log payment to ledger:", insertError.message, "charge:", chargeId);
    }
  } catch (err) {
    ledgerLogged = false;
    console.error("Failed to log payment to ledger:", err, "charge:", chargeId);
  }

  return NextResponse.json({
    ok: true,
    ledger_logged: ledgerLogged,
    reference: chargeId ? chargeId.slice(-8) : null,
  });
}
