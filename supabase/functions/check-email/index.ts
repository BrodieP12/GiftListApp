import { json, preflight } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const { email } = await req.json().catch(() => ({}));
  if (!email || typeof email !== 'string' || email.length > 254) {
    return json({ error: 'Invalid email provided.' }, 400);
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return json({ error: 'Malformed email address.' }, 400);
  }

  const db = adminClient();
  try {
    // 1. Auth: list users filtered by email (admin API).
    const { data: authData, error: authErr } = await db.auth.admin.listUsers();
    if (authErr) throw authErr;

    const inAuth = authData.users.some(
      (u) => (u.email ?? '').toLowerCase() === cleanEmail
    );
    if (inAuth) return json({ inUse: true });

    // 2. Profiles table fallback (legacy / mid-migration rows).
    const { data, error } = await db
      .from('profiles')
      .select('id')
      .eq('email', cleanEmail)
      .limit(1);
    if (error) throw error;

    return json({ inUse: (data?.length ?? 0) > 0 });
  } catch (error) {
    console.error('check-email error:', error);
    return json({ error: 'Unable to verify email status.' }, 500);
  }
});
