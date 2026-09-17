"use client";

import { useState } from "react";
import { CHIRP_HANDLE_MAX_LENGTH, CHIRP_MAX_LENGTH, chirpAge, type Chirp } from "@/lib/chirps";

type Draft = { body: string; handle: string; sending: boolean; error: string | null };
const EMPTY: Draft = { body: "", handle: "", sending: false, error: null };

/** One composer — the board's own, or a reply box under a chirp. */
function Composer({
  draft,
  setDraft,
  onSend,
  placeholder,
  cta,
  compact,
  onCancel,
}: {
  draft: Draft;
  setDraft: (next: Draft) => void;
  onSend: () => void;
  placeholder: string;
  cta: string;
  compact?: boolean;
  onCancel?: () => void;
}) {
  const remaining = CHIRP_MAX_LENGTH - draft.body.length;
  const canSend = draft.body.trim().length > 0 && !draft.sending;
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={draft.body}
        onChange={(e) => setDraft({ ...draft, body: e.target.value.slice(0, CHIRP_MAX_LENGTH) })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (canSend) onSend();
          }
          if (e.key === "Escape" && onCancel) onCancel();
        }}
        rows={compact ? 2 : 3}
        maxLength={CHIRP_MAX_LENGTH}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={compact}
        className="w-full resize-none rounded-xl border border-black/10 bg-white/70 px-3.5 py-3 text-sm leading-relaxed text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={draft.handle}
          onChange={(e) => setDraft({ ...draft, handle: e.target.value.slice(0, CHIRP_HANDLE_MAX_LENGTH) })}
          maxLength={CHIRP_HANDLE_MAX_LENGTH}
          placeholder="Name (optional)"
          aria-label="Name, optional"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white/70 px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
        />
        <span className={`tabular-nums text-[11px] ${remaining < 20 ? "text-neutral-600" : "text-neutral-400"}`}>
          {remaining}
        </span>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {draft.sending ? "Posting…" : cta}
        </button>
      </div>
      {draft.error ? <p className="text-xs text-red-600">{draft.error}</p> : null}
    </div>
  );
}

function Byline({ chirp }: { chirp: Chirp }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="nameplate text-xs text-neutral-900">{chirp.handle ?? "Anonymous"}</span>
      <span suppressHydrationWarning className="text-[11px] tabular-nums text-neutral-400">
        {chirpAge(chirp.createdAt)}
      </span>
    </div>
  );
}

/**
 * OHL Chirp — the anonymous board under the Wall of Shame. No accounts, no
 * name required; the handle field is a throwaway so a chirp can be claimed if
 * someone wants the credit. Replies go one level deep — it's a chirp board,
 * not a forum. Posting goes through /api/chirp (service role + rate limit),
 * never straight to PostgREST.
 */
export function ChirpBox({ initial }: { initial: Chirp[] }) {
  const [chirps, setChirps] = useState<Chirp[]>(initial);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState<Draft>(EMPTY);

  const post = async (
    d: Draft,
    setD: (next: Draft) => void,
    parentId: string | null,
    onDone: (chirp: Chirp) => void,
  ) => {
    if (!d.body.trim() || d.sending) return;
    setD({ ...d, sending: true, error: null });
    try {
      const res = await fetch("/api/chirp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: d.body, handle: d.handle, parentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setD({ ...d, sending: false, error: typeof data?.error === "string" ? data.error : "That didn't post. Try again." });
        return;
      }
      if (data?.chirp) onDone(data.chirp as Chirp);
      setD({ ...EMPTY, handle: d.handle });
    } catch {
      setD({ ...d, sending: false, error: "That didn't post. Try again." });
    }
  };

  const sendChirp = () =>
    post(draft, setDraft, null, (chirp) => setChirps((prev) => [chirp, ...prev]));

  const sendReply = (parentId: string) =>
    post(reply, setReply, parentId, (chirp) => {
      setChirps((prev) =>
        prev.map((c) => (c.id === parentId ? { ...c, replies: [...c.replies, chirp] } : c)),
      );
      setReplyTo(null);
    });

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5">
      <Composer
        draft={draft}
        setDraft={setDraft}
        onSend={sendChirp}
        placeholder="Talk your shit."
        cta="Chirp"
      />

      {chirps.length ? (
        <ul className="mt-4 divide-y divide-black/[0.07] border-t border-black/[0.07]">
          {chirps.map((chirp) => (
            <li key={chirp.id} className="py-3">
              <Byline chirp={chirp} />
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{chirp.body}</p>

              {chirp.replies.length ? (
                <ul className="mt-3 space-y-3 border-l border-black/[0.07] pl-3">
                  {chirp.replies.map((r) => (
                    <li key={r.id}>
                      <Byline chirp={r} />
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{r.body}</p>
                    </li>
                  ))}
                </ul>
              ) : null}

              {replyTo === chirp.id ? (
                <div className="mt-3 border-l border-black/[0.07] pl-3">
                  <Composer
                    draft={reply}
                    setDraft={setReply}
                    onSend={() => sendReply(chirp.id)}
                    onCancel={() => {
                      setReplyTo(null);
                      setReply(EMPTY);
                    }}
                    placeholder="Chirp back."
                    cta="Reply"
                    compact
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(chirp.id);
                    setReply({ ...EMPTY, handle: draft.handle });
                  }}
                  className="mt-2 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase transition hover:text-neutral-700"
                >
                  Reply
                </button>
              )}
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
