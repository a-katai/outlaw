/** 1–3 or 4 (OT) → "1st" / "2nd" / "3rd" / "OT". Null when the period wasn't recorded. */
export function periodLabel(period: number | null | undefined): string | null {
  if (period == null) return null;
  return ["1st", "2nd", "3rd", "OT"][period - 1] ?? null;
}
