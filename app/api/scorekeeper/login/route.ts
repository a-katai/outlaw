import { NextRequest, NextResponse } from "next/server";
import { SCOREKEEPER_COOKIE_NAME, scorekeeperSessionToken } from "@/lib/scorekeeper-auth";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const code = body.code?.trim().toUpperCase();
  if (!code) return NextResponse.json({ ok: false, error: "Enter the scorekeeper code" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("access_codes").select("code").eq("role", "scorekeeper").maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data || data.code !== code) {
    return NextResponse.json({ ok: false, error: "Invalid code" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SCOREKEEPER_COOKIE_NAME, scorekeeperSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
