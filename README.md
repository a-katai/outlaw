# Outlaw Hockey League

League site for the Outlaw Hockey League: stats, schedule, a donation page, a
video gallery, a live draft board with a captain pick flow, and an admin
console for running the draft and tracking payments.

Next.js 16 (App Router) + Tailwind 4, running on bun. Static league data
(standings/skaters, as a multi-season catalogue) lives in `lib/league-data.ts`;
the draft and payments ledger are backed by Supabase (project ref
`cqltfdekmfxlsgrvxtlr`).

## Commands

```bash
bun install       # install dependencies
bun run dev       # local dev server
bun run build     # production build
bun run start     # run the production build
bun run lint      # eslint
```

## Seasons

`lib/league-data.ts` exports `seasons: Season[]`, ordered newest first, each
with `id`, `label`, `status` (`"complete"` or `"active"`), `standings`, and
`skaters`. `/stats` reads `?season=<id>` (default: `seasons[0]`, the current
season) and shows a designed empty state for any season with no data yet. To
archive the current season and start the next: fill in the outgoing season's
final `standings`/`skaters`, flip its `status` to `"complete"`, then add a new
entry at the top of the array with `status: "active"` and empty
`standings`/`skaters`.

## Environment variables

Set in `.env.local` (never commit this file):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`
- `CLOVER_PUBLIC_TOKEN`, `CLOVER_PRIVATE_TOKEN` — live Clover eCommerce merchant, used by `/payments` and its charge API route.
- `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` — used for running migrations, not by the app at runtime.

## Pages

- `/` `/stats` `/schedule` `/payments` `/videos` — existing static pages, untouched.
- `/draft` — public live draft board. Realtime (Supabase `postgres_changes`
  on `drafts` + `draft_picks`) with a 15s poll fallback. Shows round/pick,
  team on the clock, the round x team grid (chronological list on mobile),
  available players, and per-team rosters. Clean empty state before the
  draft starts, final rosters view once it's complete.
- `/draft/pick` — captain view. Enter your team's pick code (persisted in
  `localStorage`); make picks with a confirm step. Server-validates every
  pick through the `make_pick` RPC, so a captain can't pick out of turn or
  with someone else's code even if the UI is bypassed.
- `/admin` — password-gated (httpOnly cookie). Draft control tab: create a
  draft, manage teams (order, captain, pick codes), manage the player pool
  (single add + bulk paste), start/pause/resume, undo, commissioner
  force-pick, reset. Payments tab: log payments (by player or free-text
  payer), ledger with delete, summary cards, per-player paid/unpaid rollup,
  CSV export. Linked only from the site footer — not in the main nav.

## Draft-night runbook

1. Sign in at `/admin` (ADMIN_PASSWORD, from the keychain/env — not printed
   here).
2. **Create teams** — add each team with its draft order (1..N).
3. **Import the pool** — bulk-paste the player list, one per line, optional
   trailing `F`/`D`/`G` (e.g. `Mike Smith F`).
4. **Generate codes** — click "Generate code" per team, copy it, and send it
   to that team's captain. Codes are shown only on this admin screen; there's
   no way to view them from the public site.
5. **Start the draft.** The board at `/draft` goes live immediately; captains
   pick at `/draft/pick` using their code.
6. If a captain is stuck, use **commissioner force-pick** — it picks on
   their behalf without needing their code.
7. **Undo** rolls back the most recent pick and re-opens that slot. **Reset**
   wipes all picks and returns the draft to setup (double-confirm; use
   sparingly).
8. **End draft** closes the draft by hand. The draft only completes itself when
   the final pick is actually made, so if the pool runs dry first — 59 players
   into 60 slots — it would otherwise sit on the clock forever and the site's
   season-phase pill would never move off "Draft". Ended too early? The create
   screen offers **Reopen**, which brings it back *paused* so nobody can pick
   until you resume.

## Payments ledger

`/payments` is a real Clover-powered dues page — players pay by card and the
charge is logged straight to the ledger (no admin step). Cash/check/venmo/etc.
still get logged manually under the admin Payments tab, which also has the
per-player paid/unpaid rollup and CSV export.

## Notes on the Supabase layer

- RLS: `players`, `teams`, `drafts`, `draft_picks` are public-read. `team_codes`
  and `payments`, plus the `make_pick` / `undo_last_pick` / `team_on_clock`
  functions, are service-role only — the browser never sees a pick code or a
  payment record. See `supabase/migrations/0001_draft_and_payments.sql`.
- Realtime is enabled on `drafts` and `draft_picks` for the live board.
