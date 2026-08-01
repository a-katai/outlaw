"use client";

import Script from "next/script";
import { FormEvent, useRef, useState } from "react";

type PlayerOption = { id: string; name: string };

type CloverElementEvent = {
  error?: string | { message?: string } | null;
  [key: string]: unknown;
};

type CloverElement = {
  mount: (selector: string) => void;
  addEventListener: (event: "change" | "blur" | "focus", handler: (event: CloverElementEvent) => void) => void;
};

type CloverElements = {
  create: (type: string, styles?: Record<string, Record<string, string>>) => CloverElement;
};

type CloverTokenResult = {
  token?: string;
  errors?: Record<string, string>;
};

type CloverInstance = {
  elements: () => CloverElements;
  createToken: () => Promise<CloverTokenResult>;
};

declare global {
  interface Window {
    Clover?: new (publicToken: string) => CloverInstance;
  }
}

const FIELD_DEFS = [
  { key: "cardNumber", type: "CARD_NUMBER", id: "clover-card-number", label: "Card Number", span: "sm:col-span-2" },
  { key: "cardDate", type: "CARD_DATE", id: "clover-card-date", label: "Expiry", span: "sm:col-span-1" },
  { key: "cardCvv", type: "CARD_CVV", id: "clover-card-cvv", label: "CVV", span: "sm:col-span-1" },
  { key: "cardPostal", type: "CARD_POSTAL_CODE", id: "clover-card-postal", label: "ZIP", span: "sm:col-span-1" },
] as const;

type FieldKey = (typeof FIELD_DEFS)[number]["key"];

const AMOUNT_CHIPS = [
  { amount: 150, label: "Deposit · $150" },
  { amount: 650, label: "Skater · $650" },
  { amount: 100, label: "Goalie · $100" },
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cloverStyles = {
  body: {
    fontFamily: "var(--font-geist-sans), Arial, Helvetica, sans-serif",
    fontSize: "14px",
  },
  input: {
    fontFamily: "var(--font-geist-sans), Arial, Helvetica, sans-serif",
    fontSize: "14px",
    color: "#171717",
  },
  "input.invalid": {
    color: "#dc2626",
  },
};

function extractFieldError(event: CloverElementEvent): string | null {
  const err = event.error;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object" && typeof err.message === "string" && err.message.trim()) {
    return err.message;
  }
  return null;
}

const inputClass =
  "rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4";

function cloverFieldClass(focused: boolean, hasError: boolean) {
  const base = "h-11 rounded-xl border bg-white px-3 py-2 transition";
  if (hasError) return `${base} border-rose-300`;
  if (focused) return `${base} border-blue-500/40 ring-4 ring-blue-500/30`;
  return `${base} border-black/10`;
}

export function PaymentsForm({ publicToken, players }: { publicToken: string; players: PlayerOption[] }) {
  const [sdkError, setSdkError] = useState(false);
  const [elementsReady, setElementsReady] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");

  const [focusedField, setFocusedField] = useState<FieldKey | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    amountCents: number;
    name: string;
    reference: string | null;
    ledgerLogged: boolean;
  } | null>(null);

  const cloverRef = useRef<CloverInstance | null>(null);
  const initializedRef = useRef(false);

  // Called from the Clover SDK script's onLoad — not a React effect, so the
  // element mounting + setState below run as a direct response to that load
  // event rather than needing an effect to synchronize with it.
  function initializeClover() {
    if (initializedRef.current) return;
    const CloverCtor = window.Clover;
    if (!CloverCtor || !publicToken) {
      setSdkError(true);
      return;
    }

    initializedRef.current = true;
    const clover = new CloverCtor(publicToken);
    cloverRef.current = clover;
    const elements = clover.elements();

    for (const field of FIELD_DEFS) {
      const el = elements.create(field.type, cloverStyles);
      el.mount(`#${field.id}`);
      el.addEventListener("focus", () => setFocusedField(field.key));
      el.addEventListener("blur", () => {
        setFocusedField((current) => (current === field.key ? null : current));
      });
      el.addEventListener("change", (event) => {
        const message = extractFieldError(event);
        setFieldErrors((prev) => ({ ...prev, [field.key]: message ?? undefined }));
      });
    }

    setElementsReady(true);
  }

  const amountNum = Number(amount);
  const amountValid = amount.trim() !== "" && Number.isFinite(amountNum) && amountNum > 0;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) return setError("Enter the payer's name.");
    if (!EMAIL_RE.test(trimmedEmail)) return setError("Enter a valid email for your receipt.");
    if (!amountValid) return setError("Enter an amount greater than $0.");

    const amountCents = Math.round(amountNum * 100);
    if (amountCents < 100 || amountCents > 100000) {
      return setError("Amount must be between $1 and $1,000.");
    }

    const clover = cloverRef.current;
    if (!clover || !elementsReady) {
      return setError("The payment form is still loading. Try again in a moment.");
    }

    setSubmitting(true);
    try {
      const result = await clover.createToken();

      if (result.errors && Object.keys(result.errors).length > 0) {
        setError("Check your card details and try again.");
        return;
      }
      if (!result.token) {
        setError("Could not process the card. Try again.");
        return;
      }

      const res = await fetch("/api/payments/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: result.token,
          name: trimmedName,
          email: trimmedEmail,
          amountCents,
        }),
      });

      let data: { ok?: boolean; error?: string; ledger_logged?: boolean; reference?: string | null } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok || !data.ok) {
        setError(data.error || "Payment failed. Please try again.");
        return;
      }

      setReceipt({
        amountCents,
        name: trimmedName,
        reference: data.reference ?? null,
        ledgerLogged: data.ledger_logged !== false,
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Script
        src="https://checkout.clover.com/sdk.js"
        strategy="afterInteractive"
        onLoad={initializeClover}
        onError={() => setSdkError(true)}
      />

      <div className="glass-card rounded-3xl p-6 md:p-8">
        {receipt ? (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-emerald-600 uppercase">Payment Received</p>
              <h2 className="mt-2 text-2xl font-semibold text-neutral-900">
                ${(receipt.amountCents / 100).toFixed(2)}
              </h2>
            </div>
            <div className="space-y-3 text-sm text-neutral-600">
              <div className="flex items-center justify-between">
                <span>Payer</span>
                <span className="font-semibold text-neutral-900">{receipt.name}</span>
              </div>
              <div className="h-px bg-black/10" />
              <p className="font-medium text-emerald-700">Recorded in the league ledger.</p>
              {!receipt.ledgerLogged ? (
                <p className="text-xs text-amber-700">
                  Your card was charged, but the ledger update is delayed — the league admin has been notified.
                </p>
              ) : null}
              {receipt.reference ? (
                <p className="text-xs text-neutral-400">Reference · {receipt.reference}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setReceipt(null)}
              className="text-sm font-medium text-neutral-600 underline underline-offset-4 transition hover:text-neutral-900"
            >
              Make another payment
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 className="text-xl font-semibold text-neutral-900">Pay by Card</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Secure card processing via Clover. Your card details never touch our servers.
            </p>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-neutral-700">Payer Name</span>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="First Last"
                  autoComplete="name"
                  list={players.length > 0 ? "player-names" : undefined}
                  required
                />
                {players.length > 0 ? (
                  <datalist id="player-names">
                    {players.map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                ) : null}
              </label>

              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-neutral-700">Email for Receipt</span>
                <input
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-neutral-700">Amount (USD)</span>
                <input
                  inputMode="decimal"
                  className={inputClass}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  onBlur={() => {
                    if (!amount) return;
                    const value = Number(amount);
                    if (!Number.isFinite(value)) return;
                    setAmount(value.toFixed(2));
                  }}
                  placeholder="150.00"
                  required
                />
                <div className="mt-1 flex flex-wrap gap-2">
                  {AMOUNT_CHIPS.map((chip) => (
                    <button
                      key={chip.amount}
                      type="button"
                      onClick={() => setAmount(chip.amount.toFixed(2))}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-neutral-600 transition hover:border-blue-500/40 hover:text-neutral-900"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </label>

              <div className="grid gap-4 sm:grid-cols-4">
                {FIELD_DEFS.map((field) => (
                  <label key={field.key} className={`grid gap-1.5 text-sm ${field.span}`}>
                    <span className="font-medium text-neutral-700">{field.label}</span>
                    <div id={field.id} className={cloverFieldClass(focusedField === field.key, Boolean(fieldErrors[field.key]))} />
                    {fieldErrors[field.key] ? (
                      <span className="text-xs font-medium text-rose-600">{fieldErrors[field.key]}</span>
                    ) : null}
                  </label>
                ))}
              </div>

              {sdkError ? (
                <p className="text-sm font-medium text-rose-600">
                  Payments are temporarily unavailable. Please refresh or try again shortly.
                </p>
              ) : null}
              {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting || !elementsReady || sdkError}
                className="mt-2 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Processing…" : `Pay $${amountValid ? amountNum.toFixed(2) : "0.00"}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
