import "server-only";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Service-role client — server-only (route handlers / server components).
 * The `server-only` import throws if this module is pulled into a client
 * bundle, which is why it lives apart from lib/supabase.ts (the browser
 * client): keeping them in one file would poison that file for client
 * imports the moment either export is used.
 */
export function createAdminClient() {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
