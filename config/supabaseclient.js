import { createClient } from '@supabase/supabase-js';

// Public client — used for the actual auth call (signUp, signIn, etc).
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Admin client — uses the service role key, bypasses RLS.
// Not currently used anywhere, but kept available for future
// server-only operations (e.g. admin cleanup jobs).
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Per-request client scoped to a user's access token, so RLS policies
// apply as that user rather than as the anon role.
export function getSupabaseForUser(accessToken) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

