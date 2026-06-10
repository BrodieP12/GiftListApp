// get-config: replaces Firebase Remote Config.
// Returns app_config as a flat key -> value map. Publicly readable; cached by
// the client and consumed by App.tsx's update-check flow.
import { json, preflight } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const db = adminClient();
  const { data, error } = await db.from('app_config').select('key, value');
  if (error) return json({ error: error.message }, 500);

  const config: Record<string, unknown> = {};
  for (const row of data ?? []) config[row.key] = row.value;
  return json(config);
});
