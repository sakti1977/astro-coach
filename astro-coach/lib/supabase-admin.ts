import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Server-only client using the service-role key. Bypasses RLS by design —
// every call site MUST scope queries to a userId obtained from a verified
// NextAuth session (never from client-supplied input), since this client
// has no row-level security of its own to fall back on.
// (Untyped client, matching lib/supabase.ts's browser client — the generated
// Database type isn't wired into createClient's generic there either.)
export const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;
