import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const [paymentsRes, playersRes] = await Promise.all([
    supabase.from("payments").select("*").order("paid_on", { ascending: false }),
    supabase.from("players").select("id, name"),
  ]);

  if (paymentsRes.error) {
    return NextResponse.json({ ok: false, error: paymentsRes.error.message }, { status: 500 });
  }

  const nameById = new Map((playersRes.data ?? []).map((p) => [p.id, p.name]));

  const header = ["Date", "Payer", "Amount", "Method", "Season", "Note"];
  const rows = (paymentsRes.data ?? []).map((p) => {
    const payer = p.player_id ? (nameById.get(p.player_id) ?? "Unknown player") : (p.payer_name ?? "");
    const amount = (p.amount_cents / 100).toFixed(2);
    return [p.paid_on, payer, amount, p.method, p.season ?? "", p.note ?? ""];
  });

  const csv = [header, ...rows].map((row) => row.map((cell) => csvCell(String(cell))).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="outlaw-payments.csv"`,
    },
  });
}
