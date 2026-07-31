import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Browser/anon client — safe to import from client components. RLS limits it
 * to reading players, teams, drafts, and draft_picks (see the migration).
 */
export function createBrowserClient() {
  return createClient(url, anonKey, {
    realtime: {
      params: { eventsPerSecond: 5 },
    },
  });
}
