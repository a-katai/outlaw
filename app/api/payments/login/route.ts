import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { PAYMENTS_COOKIE_NAME, paymentsLogin } from "@/lib/payments-auth";

const FAILED_WINDOW_MS = 60 * 60 * 1000;
const MAX_FAILED = 10;

function callerIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  // Failed guesses are logged in their own table so they can't lock real payers out of checkout.
  const supabase = createAdminClient();
  const ip = callerIp(req);
  const since = new Date(Date.now() - FAILED_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from("payment_login_failures")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_FAILED) {
    return NextResponse.json({ ok: false, error: "Too many tries. Try again later." }, { status: 429 });
  }

  const session = await paymentsLogin(body.code);
  if (!session) {
    await supabase.from("payment_login_failures").insert({ ip });
    return NextResponse.json({ ok: false, error: "Wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PAYMENTS_COOKIE_NAME, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
