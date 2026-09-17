"use client";

import { useState } from "react";
import { CHIRP_HANDLE_MAX_LENGTH, CHIRP_MAX_LENGTH, chirpAge, type Chirp } from "@/lib/chirps";

/**
 * OHL Chirp — the anonymous board under the Wall of Shame. No accounts, no
 * name required; the handle field is a throwaway so a chirp can be claimed if
 * someone wants the credit. Posting goes through /api/chirp (service role +
 * rate limit), never straight to PostgREST.
 */
export function ChirpBox({ initial }: { initial: Chirp[] }) {
  const [chirps, setChirps] = useState<Chirp[]>(initial);
  const [body, setBody] = useState("");
  const [handle, setHandle] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = CHIRP_MAX_LENGTH - body.length;
  const canSend = body.trim().length > 0 && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/chirp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body, handle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "That didn't post. Try again.");
        return;
      }
      if (data?.chirp) setChirps((prev) => [data.chirp as Chirp, ...prev]);
      setBody("");
    } catch {
      setError("That didn't post. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col gap-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, CHIRP_MAX_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send();
            }
          }}
          rows={3}
          maxLength={CHIRP_MAX_LENGTH}
          placeholder="Talk your shit."
          aria-label="Your chirp"
          className="w-full resize-none rounded-xl border border-black/10 bg-white/70 px-3.5 py-3 text-sm leading-relaxed text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value.slice(0, CHIRP_HANDLE_MAX_LENGTH))}
            maxLength={CHIRP_HANDLE_MAX_LENGTH}
            placeholder="Name (optional)"
            aria-label="Name, optional"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white/70 px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
          />
          <span className={`tabular-nums text-[11px] ${remaining < 20 ? "text-neutral-600" : "text-neutral-400"}`}>
            {remaining}
          </span>
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? "Posting…" : "Chirp"}
          </button>
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>

      {chirps.length ? (
        <ul className="mt-4 divide-y divide-black/[0.07] border-t border-black/[0.07]">
          {chirps.map((chirp) => (
            <li key={chirp.id} className="py-3">
              <div className="flex items-baseline gap-2">
                <span className="nameplate text-xs text-neutral-900">{chirp.handle ?? "Anonymous"}</span>
                <span suppressHydrationWarning className="text-[11px] tabular-nums text-neutral-400">{chirpAge(chirp.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{chirp.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-t border-black/[0.07] pt-4 text-sm text-neutral-400">
          Nobody&rsquo;s said anything yet. Go first.
        </p>
      )}
    </div>
  );
}
