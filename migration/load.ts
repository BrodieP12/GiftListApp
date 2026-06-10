import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

/**
 * Loads transformed_data.json into Supabase using the service-role key
 * (bypasses RLS). Inserts in FK order and upserts so the script is idempotent
 * and safe to re-run during a dry-run / final delta sync.
 *
 * Env (e.g. via migration/.env):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * NOTE: auth.users must be imported separately (firebase auth:export +
 * Supabase admin import) BEFORE this runs, because profiles.id references
 * auth.users(id). See SUPABASE_MIGRATION_PLAN.md §5 and §13.
 */

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see migration/.env).');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const CHUNK = 500;

async function upsertAll(table: string, rows: any[], conflict?: string) {
  if (!rows.length) {
    console.log(`  ${table}: 0 (skipped)`);
    return;
  }
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from(table)
      .upsert(slice, conflict ? { onConflict: conflict } : undefined);
    if (error) {
      console.error(`  ${table}: FAILED at chunk ${i / CHUNK} -> ${error.message}`);
      throw error;
    }
  }
  console.log(`  ${table}: ${rows.length} upserted`);
}

async function main() {
  const data = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, 'transformed_data.json'), 'utf8')
  );

  console.log('Loading into Supabase (FK order)...');
  // FK order: profiles -> lists -> list_members -> items -> claims -> feedback
  await upsertAll('profiles', data.profiles, 'id');
  await upsertAll('lists', data.lists, 'id');
  await upsertAll('list_members', data.list_members, 'list_id,user_id');
  await upsertAll('items', data.items, 'id');
  await upsertAll('claims', data.claims, 'item_id');
  await upsertAll('feedback', data.feedback, 'id');
  console.log('Load complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
