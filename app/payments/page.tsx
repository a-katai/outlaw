"use client";

import { FormEvent, useState } from "react";

export default function PaymentsPage() {
  const [cardholder, setCardholder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [zip, setZip] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const formatCard = (value: string) =>
    value
      .replace(/\D/g, "")
      .slice(0, 16)
      .replace(/(\d{4})(?=\d)/g, "$1 ")
      .trim();

  const formatExpiry = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 4);
    if (clean.length < 3) return clean;
    return `${clean.slice(0, 2)}/${clean.slice(2)}`;
  };

  const submitPayment = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSubmitted(false);

    const cardDigits = cardNumber.replace(/\s/g, "");
    const cvcDigits = cvc.replace(/\D/g, "");
    const amountNum = Number(amount);

    if (!cardholder || !email || !zip) return setError("Please complete all required fields.");
    if (cardDigits.length < 15) return setError("Card number looks incomplete.");
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return setError("Use MM/YY for expiry.");
    if (cvcDigits.length < 3) return setError("CVC must be at least 3 digits.");
    if (!Number.isFinite(amountNum) || amountNum <= 0) return setError("Enter a valid payment amount.");

    setSubmitted(true);
  };

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">League Hub</p>
        <h1 className="mt-2 text-4xl font-semibold text-neutral-900">Payments</h1>
        <p className="mt-3 text-neutral-600">Secure card checkout for league fees and dues.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.35fr_1fr]">
        <form onSubmit={submitPayment} className="glass-card rounded-3xl p-6 md:p-8">
          <h2 className="text-xl font-semibold text-neutral-900">Pay by Card</h2>
          <p className="mt-1 text-sm text-neutral-500">Card details are shown as a demo form for league checkout.</p>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-neutral-700">Cardholder Name</span>
              <input
                className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
                value={cardholder}
                onChange={(e) => setCardholder(e.target.value)}
                placeholder="First Last"
                autoComplete="cc-name"
                required
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-neutral-700">Card Number</span>
              <input
                inputMode="numeric"
                className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCard(e.target.value))}
                placeholder="1234 5678 9012 3456"
                autoComplete="cc-number"
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-1.5 text-sm sm:col-span-1">
                <span className="font-medium text-neutral-700">Expiry</span>
                <input
                  inputMode="numeric"
                  className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/YY"
                  autoComplete="cc-exp"
                  required
                />
              </label>
              <label className="grid gap-1.5 text-sm sm:col-span-1">
                <span className="font-medium text-neutral-700">CVC</span>
                <input
                  inputMode="numeric"
                  className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="123"
                  autoComplete="cc-csc"
                  required
                />
              </label>
              <label className="grid gap-1.5 text-sm sm:col-span-1">
                <span className="font-medium text-neutral-700">ZIP</span>
                <input
                  inputMode="numeric"
                  className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
                  value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="48127"
                  required
                />
              </label>
            </div>

            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-neutral-700">Email for Receipt</span>
              <input
                type="email"
                className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-neutral-700">Amount (USD)</span>
              <input
                inputMode="decimal"
                className="rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none ring-blue-500/30 transition focus:ring-4"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                onBlur={() => {
                  if (!amount) return;
                  const value = Number(amount);
                  if (!Number.isFinite(value)) return;
                  setAmount(value.toFixed(2));
                }}
                placeholder="45.00"
                required
              />
            </label>

            {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
            {submitted ? <p className="text-sm font-medium text-emerald-700">Payment submitted successfully.</p> : null}

            <button
              type="submit"
              className="mt-2 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black"
            >
              Pay ${Number(amount || "0").toFixed(2)}
            </button>
          </div>
        </form>

        <aside className="glass-card rounded-3xl p-6 md:p-8">
          <h2 className="text-xl font-semibold text-neutral-900">Order Summary</h2>
          <div className="mt-5 space-y-3 text-sm text-neutral-600">
            <div className="flex items-center justify-between">
              <span>League fee</span>
              <span className="font-semibold text-neutral-900">${Number(amount || "0").toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Processing</span>
              <span className="font-semibold text-neutral-900">$0.00</span>
            </div>
            <div className="h-px bg-black/10" />
            <div className="flex items-center justify-between text-base">
              <span className="font-semibold text-neutral-900">Total</span>
              <span className="font-semibold text-neutral-900">${Number(amount || "0").toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">
            This is a front-end demo checkout. To process real cards, connect Stripe or Square.
          </div>
          <p className="mt-3 text-xs text-neutral-500">Your card details are not sent anywhere yet in this demo mode.</p>
        </aside>
      </div>

      <div className="glass-card rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-neutral-900">League Notes</h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-600">
          <li>Include your player name in the payment note.</li>
          <li>Pay before puck drop when possible.</li>
          <li>Contact league admin for any payment plan requests.</li>
        </ul>
      </div>
    </section>
  );
}
