import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client: bypasses RLS. Use only for privileged server logic
 * (email lookups, webhook handlers, admin reads).
 */
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );
}

/**
 * Resolves the calling user from the request's Authorization bearer token.
 * Returns null if unauthenticated. Used by functions that act on behalf of a user.
 */
export async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
  );
  const { data, error } = await client.auth.getUser(token);
  if (error) return null;
  return data.user;
}
