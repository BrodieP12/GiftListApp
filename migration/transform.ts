import * as fs from 'fs';
import * as path from 'path';

/**
 * Transforms the raw Firestore export (extracted_data.json) into row arrays
 * that match the Supabase/PostgreSQL schema (snake_case, ISO timestamps,
 * normalized list_members + claims). Writes transformed_data.json.
 *
 * Auth uid preservation: Firebase uids are reused verbatim as Supabase
 * profile/auth ids (see SUPABASE_MIGRATION_PLAN.md §13), so owner_id /
 * claimed_by FKs remain valid with no remapping.
 */

type AnyDoc = Record<string, any>;

/** Firestore Timestamp ({_seconds} | {seconds}) | ISO string | Date -> ISO string. */
function toIso(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (val instanceof Date) return val.toISOString();
  const seconds = val._seconds ?? val.seconds;
  if (typeof seconds === 'number') return new Date(seconds * 1000).toISOString();
  return null;
}

function main() {
  const inputPath = path.resolve(__dirname, 'extracted_data.json');
  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  // --- profiles (from users) ---
  const profiles = (raw.users || []).map((u: AnyDoc) => ({
    id: u.id ?? u.uid,
    email: u.email ?? '',
    display_name: u.displayName ?? '',
    given_name: u.givenName ?? '',
    family_name: u.familyName ?? '',
    photo_url: u.photoURL ?? null,
    birthday: toIso(u.birthday),
    is_premium: !!u.isPremium,
    is_minor: !!u.minorProtection?.isMinor,
    parent_email: u.minorProtection?.parentEmail ?? '',
    terms_accepted: !!u.legalAcceptance?.termsAccepted,
    privacy_accepted: !!u.legalAcceptance?.privacyAccepted,
    acceptance_date: toIso(u.legalAcceptance?.acceptanceDate),
    is_eu_user: !!u.legalAcceptance?.isEUUser,
    gdpr_applies: !!u.legalAcceptance?.gdprApplies,
    accepted_data_processing: !!u.legalAcceptance?.acceptedDataProcessing,
    created_at: toIso(u.createdAt) ?? new Date().toISOString(),
  }));

  // --- lists + list_members (from lists.allowedUsers[]) ---
  const lists: AnyDoc[] = [];
  const listMembers: AnyDoc[] = [];
  for (const l of raw.lists || []) {
    lists.push({
      id: l.id,
      owner_id: l.ownerId,
      title: l.title ?? '',
      is_private: l.isPrivate ?? !l.shareCode,
      share_code: l.shareCode ?? null,
      created_at: toIso(l.createdAt ?? l.clientCreatedAt) ?? new Date().toISOString(),
      updated_at: toIso(l.updatedAt),
    });
    for (const uid of l.allowedUsers || []) {
      listMembers.push({ list_id: l.id, user_id: uid });
    }
  }

  // --- items ---
  const items = (raw.items || []).map((it: AnyDoc) => ({
    id: it.id,
    list_id: it.list_id ?? it.listId,
    owner_id: it.ownerId,
    name: it.name ?? '',
    description: it.description ?? '',
    price: typeof it.price === 'number' ? it.price : null,
    image_uri: it.imageUri ?? null,
    url: it.url ?? null,
    substitutions: !!it.substitutions,
    created_at: toIso(it.clientCreatedAt ?? it.serverReceivedAt) ?? new Date().toISOString(),
    updated_at: toIso(it.updatedAt),
  }));

  // --- claims (Firestore doc id == itemId) ---
  const claims = (raw.claims || []).map((c: AnyDoc) => ({
    item_id: c.itemId ?? c.id,
    list_id: c.listId,
    claimed_by: c.claimedBy,
    list_owner_id: c.listOwnerId,
    claimed_at: toIso(c.claimedAt) ?? new Date().toISOString(),
  }));

  // --- feedback ---
  const feedback = (raw.feedback || []).map((f: AnyDoc) => ({
    id: f.id,
    user_id: f.userId ?? 'anonymous',
    user_email: f.userEmail ?? '',
    text: f.text ?? '',
    type: f.type ?? 'general',
    is_anonymous: !!f.isAnonymous,
    platform: f.platform ?? null,
    created_at: toIso(f.createdAt) ?? new Date().toISOString(),
  }));

  const out = { profiles, lists, list_members: listMembers, items, claims, feedback };
  const outputPath = path.resolve(__dirname, 'transformed_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2));

  console.log('Transform complete:');
  for (const [k, v] of Object.entries(out)) console.log(`  ${k}: ${(v as any[]).length}`);
  console.log(`Saved to ${outputPath}`);
}

main();
