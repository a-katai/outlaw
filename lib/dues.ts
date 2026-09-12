/** Season money — the one place the fee schedule and ledger labels live. */

export type PaymentKind = "dues" | "sub";

export const CURRENT_SEASON = "Fall 2026";

/** Skater dues. The deposit counts toward the total. */
export const DEPOSIT_CENTS = 15000;
export const SKATER_CENTS = 65000;
export const GOALIE_CENTS = 10000;

/** Sub fee, per game. Paid subs are called first, in the order they paid. */
export const SUB_FEE_CENTS = 2500;

export type AmountChip = { amountCents: number; label: string };

export const DUES_CHIPS: AmountChip[] = [
  { amountCents: DEPOSIT_CENTS, label: "Deposit · $150" },
  { amountCents: SKATER_CENTS, label: "Skater · $650" },
  { amountCents: GOALIE_CENTS, label: "Goalie · $100" },
];

export const SUB_CHIPS: AmountChip[] = [1, 3, 5].map((games) => ({
  amountCents: SUB_FEE_CENTS * games,
  label: `${games} ${games === 1 ? "game" : "games"} · $${(SUB_FEE_CENTS * games) / 100}`,
}));

export function isPaymentKind(value: unknown): value is PaymentKind {
  return value === "dues" || value === "sub";
}
