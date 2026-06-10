# GiftListApp — Full Firebase → Supabase Migration Plan

**Decision baseline (locked):**
- **Scope:** Move *everything* off Firebase — DB, Auth, Functions, **and** telemetry (Crashlytics/Analytics → Sentry + PostHog) and Remote Config (→ Supabase config table + Edge Function).
- **Functions:** Rewrite *all* Cloud Functions as Supabase Edge Functions (Deno), including the heavy AI/OCR/video functions.
- **Cutover:** One-shot with a planned maintenance window (freeze → export → import → flip client).

> End state: zero `@react-native-firebase/*` and zero `firebase`/`firebase-admin` dependencies. `google-services.json`, `firebase.json`, and `firebase_config/` deleted.

---

## 1. Current-State Inventory (what we're replacing)

| Firebase service | Where used | Supabase target |
|---|---|---|
| **Auth** (email/password) | `AuthService.ts`, `useAuth.ts`, `api/firebase.ts` | Supabase Auth (`@supabase/supabase-js` + AsyncStorage) |
| **Firestore** — `lists`, `lists/{id}/items`, `claims`, `users`, `feedback` | `ListService`, `ClaimService`, `UserService`, `FeedbackService`, `api/collections.ts` | PostgreSQL (normalized tables + RLS) |
| **Firestore listeners** (`onSnapshot`) | `ListService` (lists, items), `ClaimService` | Supabase Realtime channels |
| **Callable Functions** — `createList`, `checkEmailInUse`, `scrapeProduct` | `ListService`, `AuthService`, `RetailerService` | Edge Functions (`supabase.functions.invoke`) |
| **HTTP Functions** — `extractProduct`, `processReceipt`, `compareProducts`, `analyzePrice`, `manageWishlist`, `extractProductFromVideo` | client RetailerService + direct calls | Edge Functions (Deno) — **heavy rework** |
| **Firestore triggers** — `onListCreated`, `syncFeedbackToSheets` | `functions/src/` | Postgres triggers / DB Webhooks → Edge Functions |
| **App Check** | `app.json` plugin, enforced in `checkEmailInUse` | Edge Function auth + optional attestation (see §11) |
| **Crashlytics** | `LoggingService.ts` | **Sentry** (`@sentry/react-native`) |
| **Analytics** | `LoggingService.ts` | **PostHog** (`posthog-react-native`) |
| **Remote Config** | `App.tsx` (OTA/native-update gating) | Supabase `app_config` table + `get-config` Edge Function |
| **Hosting** (`public/`, APK at `giftlistapp-557ce.web.app/latest.apk`) | OTA `apk_download_url` | Supabase Storage public bucket (or keep EAS hosting) |

**Collections → tables mapping:**
- `lists/{listId}` → `lists`
- `lists/{listId}/items/{itemId}` (subcollection) → `items` (FK `list_id`)
- `lists[].allowedUsers[]` (array) → `list_members` (join table)
- `claims/{itemId}` → `claims` (kept as a **separate table** to preserve the surprise-logic security boundary)
- `users/{uid}` → `profiles` (mirrors `auth.users`)
- `feedback/{id}` → `feedback`

---

## 2. Target Architecture

```
React Native (Expo)
  └─ src/api/supabase.ts         (single supabase client, AsyncStorage session)
  └─ src/services/*              (refactored: Supabase queries instead of Firestore)
  └─ src/hooks/useAuth.ts        (onAuthStateChange instead of onAuthStateChanged)
  └─ src/services/LoggingService (Sentry + PostHog instead of Crashlytics/Analytics)

Supabase
  ├─ Postgres (profiles, lists, items, list_members, claims, feedback, app_config)
  ├─ RLS policies (replace firestore.rules)
  ├─ Auth (email/password; imported password hashes)
  ├─ Realtime (lists, items, claims)
  ├─ Edge Functions (Deno): create-list, check-email, scrape-product, extract-product,
  │     process-receipt, compare-products, analyze-price, manage-wishlist,
  │     extract-product-from-video, sync-feedback-to-sheets, get-config
  ├─ Database triggers: handle_new_user, share_code collision guard
  └─ Storage: apk bucket (+ images bucket if needed)

External: Sentry, PostHog, Google Sheets API (service account JWT), Vertex AI / Gemini
```

---

## 3. Database Schema (PostgreSQL DDL)

```sql
-- =========================================================
-- profiles : 1:1 mirror of auth.users, populated by trigger
-- =========================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text not null default '',
  given_name    text not null default '',
  family_name   text not null default '',
  photo_url     text,
  birthday      timestamptz,
  is_premium    boolean not null default false,
  -- minorProtection
  is_minor      boolean not null default false,
  parent_email  text not null default '',
  -- legalAcceptance
  terms_accepted          boolean not null default false,
  privacy_accepted        boolean not null default false,
  acceptance_date         timestamptz,
  is_eu_user              boolean not null default false,
  gdpr_applies            boolean not null default false,
  accepted_data_processing boolean not null default false,
  created_at    timestamptz not null default now()
);
create index on public.profiles (email);

-- =========================================================
-- lists
-- =========================================================
create table public.lists (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  is_private   boolean not null default true,
  share_code   text unique,                 -- collision handled by unique constraint
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);
create index on public.lists (owner_id);

-- =========================================================
-- list_members : replaces lists.allowedUsers[]
-- =========================================================
create table public.list_members (
  list_id   uuid not null references public.lists(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

-- =========================================================
-- items : replaces lists/{id}/items subcollection
-- =========================================================
create table public.items (
  id             uuid primary key default gen_random_uuid(),
  list_id        uuid not null references public.lists(id) on delete cascade,
  owner_id       uuid not null references public.profiles(id),
  name           text not null,
  description    text not null default '',
  price          numeric,
  image_uri      text,
  url            text,
  substitutions  boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);
create index on public.items (list_id);

-- =========================================================
-- claims : separate table so the list owner CANNOT read it (surprise logic)
-- =========================================================
create table public.claims (
  item_id        uuid primary key references public.items(id) on delete cascade,
  list_id        uuid not null references public.lists(id) on delete cascade,
  claimed_by     uuid not null references public.profiles(id),
  list_owner_id  uuid not null references public.profiles(id),
  claimed_at     timestamptz not null default now()
);
create index on public.claims (list_id);

-- =========================================================
-- feedback
-- =========================================================
create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,         -- 'anonymous' allowed
  user_email  text not null,
  text        text not null,
  type        text not null default 'general',
  is_anonymous boolean not null default false,
  platform    text,
  created_at  timestamptz not null default now()
);

-- =========================================================
-- app_config : replaces Firebase Remote Config
-- =========================================================
create table public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_config (key, value) values
  ('latest_ota_version',      '"1.0.9"'),
  ('force_ota_update',        'false'),
  ('required_native_version', '"1.0.5.4"'),
  ('apk_download_url',        '"https://<project>.supabase.co/storage/v1/object/public/apk/latest.apk"'),
  ('latest_update_message',   '"Migrated to Supabase"');
```

### Triggers

```sql
-- Auto-create a profile row when an auth user is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

> **Share-code collisions:** the `share_code unique` constraint replaces `onListCreated.ts` entirely. The `create-list` Edge Function generates a code and retries on unique-violation (23505). No trigger needed.

---

## 4. Row Level Security (translate `firestore.rules`)

```sql
alter table public.profiles     enable row level security;
alter table public.lists        enable row level security;
alter table public.list_members enable row level security;
alter table public.items        enable row level security;
alter table public.claims       enable row level security;
alter table public.feedback     enable row level security;
alter table public.app_config   enable row level security;

-- Helper: is the current user a member of (or owner of) a list?
create or replace function public.has_list_access(p_list uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.lists l where l.id = p_list and l.owner_id = auth.uid())
      or exists (select 1 from public.list_members m where m.list_id = p_list and m.user_id = auth.uid());
$$;

-- PROFILES: read/write only your own (email-uniqueness check is done server-side via Edge Fn)
create policy profiles_self on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- LISTS
create policy lists_select on public.lists for select
  using (owner_id = auth.uid() or public.has_list_access(id));
create policy lists_insert on public.lists for insert
  with check (owner_id = auth.uid());
create policy lists_update on public.lists for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy lists_delete on public.lists for delete
  using (owner_id = auth.uid());

-- LIST_MEMBERS: a user may add THEMSELVES (join via code, validated by Edge Fn/RPC); owners manage
create policy members_select on public.list_members for select
  using (user_id = auth.uid() or public.has_list_access(list_id));
create policy members_self_join on public.list_members for insert
  with check (user_id = auth.uid());
create policy members_owner_manage on public.list_members for delete
  using (exists (select 1 from public.lists l where l.id = list_id and l.owner_id = auth.uid())
         or user_id = auth.uid());

-- ITEMS: anyone with list access can read/write
create policy items_access on public.items for all
  using (public.has_list_access(list_id)) with check (public.has_list_access(list_id));

-- CLAIMS: members can read/create/delete; the LIST OWNER is explicitly blocked (surprise!)
create policy claims_member_select on public.claims for select
  using (public.has_list_access(list_id) and list_owner_id <> auth.uid());
create policy claims_member_insert on public.claims for insert
  with check (claimed_by = auth.uid() and public.has_list_access(list_id) and list_owner_id <> auth.uid());
create policy claims_member_delete on public.claims for delete
  using (claimed_by = auth.uid());

-- FEEDBACK: any authed user inserts; nobody reads via client (service role only)
create policy feedback_insert on public.feedback for insert
  with check (auth.uid() is not null);

-- APP_CONFIG: world-readable (or via Edge Fn); writes service-role only
create policy app_config_read on public.app_config for select using (true);
```

> **Join-via-code flow:** Firestore allowed clients to append their own uid to `allowedUsers`. In Postgres, expose an RPC `join_list_by_code(p_code text)` (SECURITY DEFINER) that looks up the list by `share_code` and inserts the caller into `list_members`. This is safer than open-ended array mutation.

```sql
create or replace function public.join_list_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_list uuid;
begin
  select id into v_list from public.lists where share_code = p_code;
  if v_list is null then raise exception 'invalid_code'; end if;
  insert into public.list_members (list_id, user_id)
    values (v_list, auth.uid()) on conflict do nothing;
  return v_list;
end; $$;
```

---

## 5. Auth Migration

1. **Client setup** — new `src/api/supabase.ts`:
   ```ts
   import 'react-native-url-polyfill/auto';
   import AsyncStorage from '@react-native-async-storage/async-storage';
   import { createClient } from '@supabase/supabase-js';
   export const supabase = createClient(URL, ANON_KEY, {
     auth: { storage: AsyncStorage, autoRefreshToken: true,
             persistSession: true, detectSessionInUrl: false },
   });
   ```
2. **User export from Firebase:** `firebase auth:export users.json --project giftlistapp-557ce`. Firebase exports password hashes as **scrypt** with the project's `hash_config` (signer key, salt separator, rounds, mem cost).
3. **Import into Supabase:** Supabase Auth (GoTrue) supports importing users with their existing Firebase scrypt hashes so users keep their passwords. Import via the Admin API (`supabase.auth.admin.createUser` with `password_hash` / encrypted password field) or a bulk import script using the service-role key, supplying the Firebase `hash_config`. Map `localId` → `id` so existing list/item `owner_id`s stay valid (we preserve UUIDs from Firebase as the auth user id where possible; otherwise build a `firebase_uid → supabase_uid` lookup used by the data ETL in §13).
4. **`AuthService.ts` rewrite:**
   - `login` → `supabase.auth.signInWithPassword({ email, password })`
   - `register` → `supabase.auth.signUp({ email, password })`
   - `logout` → `supabase.auth.signOut()`
   - `isEmailInUse` → `supabase.functions.invoke('check-email', { body: { email } })`
   - Error mapping: replace `auth/*` codes with Supabase/GoTrue error messages (`invalid login credentials`, `user already registered`, weak-password, rate-limit). Keep the same user-facing `AUTH_MESSAGES` strings.
5. **`useAuth.ts` rewrite:** replace `auth.onAuthStateChanged` with:
   ```ts
   const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => { ... });
   return () => sub.subscription.unsubscribe();
   ```
   Fetch the profile from `profiles` (the `handle_new_user` trigger guarantees a row exists, so the "create default user" branch becomes a profile *update* on first completion of CreateProfile).

---

## 6. Service Layer Refactor (file-by-file)

> Strategy: keep each service's **public method signatures identical** so screens (`DashboardScreen`, `ListDetailScreen`, `AddItemScreen`, etc.) don't change. Swap internals only.

| File | Firestore call | Supabase replacement |
|---|---|---|
| `api/firebase.ts` | exports `auth, db, functions` | **Delete**; replace with `api/supabase.ts` |
| `api/collections.ts` | typed `CollectionReference`s | **Delete**; queries become inline `supabase.from('lists')` |
| `ListService.createList` | `db.collection('lists').add` | `supabase.functions.invoke('create-list')` (keeps server-side share-code uniqueness) |
| `ListService.getOwnedLists` | `.where('ownerId','==',uid).get()` | `supabase.from('lists').select('*').eq('owner_id',uid)` |
| `ListService.getSharedLists` | `.where('allowedUsers','array-contains',uid)` | `.from('lists').select('*, list_members!inner(user_id)').eq('list_members.user_id',uid)` |
| `ListService.listenToOwnedLists` | `.onSnapshot` | Realtime channel on `lists` filtered by `owner_id` (§7) |
| `ListService.getItems` / `listenToItems` | subcollection | `.from('items').eq('list_id',listId)` + Realtime |
| `ListService.addItem` | subcollection `.add` | `.from('items').insert({...})` |
| `ListService.updateList` / `deleteList` / `deleteItem` | `.doc().update/delete` | `.from(...).update().eq('id',...)` / `.delete().eq('id',...)` |
| `ClaimService.*` | `claims` collection | `.from('claims')` + Realtime; RLS enforces surprise logic |
| `UserService.createUserDocument` | `users.doc(uid).set` | `.from('profiles').upsert({...})` |
| `UserService.getUserDocument(s)` | `users.doc(uid).get` | `.from('profiles').select('*').eq('id',uid)` (+ `.in('id', uids)` for batch) |
| `FeedbackService.submitFeedback` | `feedback.add` | `.from('feedback').insert({...})` |
| `RetailerService.fetchItemMetadata` | callable `scrapeProduct` | `supabase.functions.invoke('scrape-product')` |

**Cross-cutting changes:**
- `firestore.FieldValue.serverTimestamp()` → omit the field (Postgres `default now()`) or send `new Date().toISOString()`.
- Field-name casing: Firestore used camelCase; Postgres uses snake_case. Add a thin mapper in each service (`data.owner_id → ownerId`) so `src/types/models.ts` stays camelCase for the UI. **Alternatively** use Postgres column aliases in `.select('ownerId:owner_id, ...')`.
- `src/types/models.ts`: drop `import { Timestamp } from "firebase/firestore"`; change `Timestamp` fields to `string | Date` (ISO strings from Supabase).
- **Bug to fix during port:** `ListService.updateList` and `addItem` currently nest a `updatingList`/`sendingItem` object inside the doc (a latent bug). Flatten these when rewriting.

---

## 7. Realtime (replace `onSnapshot`)

Supabase Realtime requires enabling replication per table (`alter publication supabase_realtime add table lists, items, claims;`). Pattern:

```ts
const channel = supabase
  .channel(`lists:${userId}`)
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'lists', filter: `owner_id=eq.${userId}` },
      () => refetch())   // or apply the payload delta
  .subscribe();
return () => supabase.removeChannel(channel);
```

- `listenToOwnedLists` → channel filtered `owner_id=eq.{uid}`.
- `listenToItems` / `listenToOwnedListItems` → channel filtered `list_id=eq.{listId}`.
- `ClaimService.listenToClaimsForList` → channel on `claims` filtered `list_id=eq.{listId}`; RLS already hides rows from the owner.
- Note: Realtime delivers row deltas, not full query snapshots. Simplest reliable port = on any event, re-run the corresponding `select` (matches current behavior where the whole list is rebuilt). Optimize to delta-merge later.

---

## 8. Edge Functions (all → Deno)

Each lives in `supabase/functions/<name>/index.ts`. Shared auth helper validates the JWT from the `Authorization` header; service-role client used for privileged reads.

| New Edge Fn | From | Port difficulty | Notes |
|---|---|---|---|
| `create-list` | `createList.ts` | Easy | nanoid + insert; retry on 23505 unique violation instead of pre-query |
| `check-email` | `checkEmailInUse.ts` | Easy | `supabase.auth.admin.listUsers`/`getUserByEmail` + `profiles` lookup with service role. App Check → replace with attestation (§11) |
| `scrape-product` | (referenced `scrapeProduct`) | Medium | `cheerio` works in Deno via npm: specifier; or use `deno-dom` |
| `extract-product` | `productExtractor.ts` | Medium | `npm:@google/genai`, `npm:cheerio`; `fetch` is native |
| `compare-products` | `productComparison.ts` | Easy | GenAI only |
| `analyze-price` | `priceAnalyzer.ts` | Easy | GenAI only |
| `manage-wishlist` | `wishlistManager.ts` | Easy | Vertex AI via GenAI; set `project`/`location` from env |
| `process-receipt` | `receiptProcessor.ts` | **Hard** | `tesseract.js` + `duck-duck-scrape`. Deno can't run the Node tesseract worker reliably → **offload OCR to Google Cloud Vision API or GenAI vision** (pass image to Gemini directly, drop tesseract). Replace `duck-duck-scrape` image search with a Deno-compatible search or GenAI. |
| `extract-product-from-video` | `videoExtractor.ts` | **Hard** | `youtube-dl-exec` + `fluent-ffmpeg` + `@ffmpeg-installer/ffmpeg` are Node/binary-bound and won't run in Edge's sandbox. **Options:** (a) feed the video URL straight to Gemini multimodal (preferred — drops ffmpeg/youtube-dl entirely); (b) run this one function on a small Cloud Run container if frame extraction is truly required. Flag for design review. |
| `sync-feedback-to-sheets` | `syncFeedbackToSheets.ts` | Medium | Trigger via **Database Webhook** on `feedback` insert → Edge Fn. Use `npm:googleapis` or raw Sheets REST + a service-account JWT signed in Deno (`djwt`). Store SA key in Edge secrets. |
| `get-config` | (new, replaces Remote Config) | Easy | `select * from app_config`; returns JSON the client caches |

**Secrets** (`supabase secrets set`): `GEMINI_API_KEY`/Vertex creds, `GOOGLE_SHEETS_SA_JSON`, `SHEET_ID`, plus auto-injected `SUPABASE_URL` / `SERVICE_ROLE_KEY`.

**Triggers replaced:**
- `onListCreated` (collision fix) → **deleted** (unique constraint + retry in `create-list`).
- `syncFeedbackToSheets` (Firestore trigger) → Database Webhook on `public.feedback` INSERT.

---

## 9. Telemetry Replacement (`LoggingService.ts`)

- **Crashlytics → Sentry** (`@sentry/react-native`): `Sentry.init({ dsn })` in `App.tsx`; `CrashLogger.error` → `Sentry.captureException(err, { tags: { context } })`; `setContext` → `Sentry.setTag`; `testCrash` → `Sentry.nativeCrash()`.
- **Analytics → PostHog** (`posthog-react-native`): `AppLogger.info` → `posthog.capture('app_info', {...})`; gate on the same `debug_mode` AsyncStorage flag.
- Keep the `AppLogger`/`CrashLogger` class surface identical so call sites across services don't change.
- Source maps: wire Sentry's Expo plugin into the EAS build for symbolicated native crashes.

---

## 10. Remote Config + OTA Flow (`App.tsx`)

The OTA orchestration is the most delicate non-DB piece. Rewrite:
1. On launch, call `supabase.functions.invoke('get-config')` (or `supabase.from('app_config').select()`), with the same **3-second timeout race** and cached fallback already in `App.tsx`.
2. Map keys 1:1: `latest_ota_version`, `force_ota_update`, `required_native_version`, `apk_download_url`, `latest_update_message`. Keep `expo-updates` (`Updates.fetchUpdateAsync` / `reloadAsync`) untouched — only the *config source* changes.
3. Defaults move from `remoteConfig().setDefaults(...)` to a local constant object used when the fetch times out.
4. Host the APK in a Supabase Storage **public** bucket `apk`; update `apk_download_url` and retire `giftlistapp-557ce.web.app`.

---

## 11. App Check Replacement

Firebase App Check gated `checkEmailInUse` against bot enumeration. Replacements (pick per risk tolerance):
- **Baseline:** require a valid Supabase user JWT for all sensitive Edge Functions (already gives auth). For pre-auth calls like `check-email`, add **rate limiting** (per-IP, e.g. via an Edge KV/Upstash counter) + CAPTCHA on the signup screen.
- **Strong:** integrate device attestation (Play Integrity / App Attest) verified inside the Edge Function, or front Edge Functions with Cloudflare Turnstile. Flag as a follow-up; not a launch blocker if rate limiting is in place.
- Remove `@react-native-firebase/app-check` and the `app.json` plugin.

---

## 12. Expo / Native Config Changes

- **`package.json`:** remove all `@react-native-firebase/*` and `firebase`. Add `@supabase/supabase-js`, `react-native-url-polyfill`, `@sentry/react-native`, `posthog-react-native`.
- **`app.json`:** delete the four `@react-native-firebase/*` plugins and `googleServicesFile`; add `@sentry/react-native` (and `expo-build-properties` stays). Bump `version`/`versionCode` for a mandatory native rebuild (Supabase client is JS-only, but removing RNFirebase native modules requires a new binary — this is a **native release, not OTA**, so coordinate with the `required_native_version` gate in §10).
- **Delete:** `google-services.json`, `firebase.json`, `firebase_config/`, `src/types/firebase-auth-react-native.d.ts`, `__mocks__/firebaseMock.js` (replace with a supabase mock).
- **`jest` config in `package.json`:** drop the `firebase` moduleNameMapper / transformIgnore entries; add a `@supabase/supabase-js` mock. Update `ListService.test.ts`.
- **EAS:** new production build; submit to stores. Because RNFirebase native modules are removed, **all users must update the native app** — drive this through the existing `required_native_version` force-update path *before* retiring Firebase.

---

## 13. Data Migration ETL

Reuse/extend `migration/extract_firestore.ts` (already extracts `lists` + `items`).

1. **Export:**
   - Firestore: extend the existing script to also dump `users`, `claims`, `feedback`. Output `extracted_data.json`.
   - Auth: `firebase auth:export users.json` (with hash config from Firebase console → Auth → Users → "..." → password hash params).
2. **Transform (`migration/transform.ts`):**
   - Build `firebase_uid → supabase_uid` map (preserve uid as Supabase id during auth import where possible).
   - `lists`: `ownerId→owner_id`, `createdAt`(Timestamp)→ISO, derive `is_private`.
   - `allowedUsers[]` → rows in `list_members`.
   - `items`: flatten the (buggy) nested fields, `clientCreatedAt`/`serverReceivedAt`→`created_at`.
   - `claims`: `claimedBy→claimed_by`, `listOwnerId→list_owner_id`, doc-id→`item_id`.
   - `users` → `profiles` (flatten `minorProtection`/`legalAcceptance`).
3. **Load (`migration/load.ts`):** service-role client, batch `insert` in FK order: profiles → lists → list_members → items → claims → feedback. Use upsert for idempotent re-runs.
4. **Validate:** assert row counts match Firestore doc counts; spot-check share-code resolution and that a list owner cannot see claims (RLS test with a real owner JWT).

---

## 14. Testing Strategy

- Replace `__mocks__/firebaseMock.js` with a `@supabase/supabase-js` mock (chainable `from().select().eq()` returning fixtures).
- Rewrite `ListService.test.ts` against the new query shapes.
- Add RLS policy tests (pgTAP or a Deno test hitting the DB with scoped JWTs) for the four sensitive cases: owner-only list edit, member read, **owner-blocked claims**, join-via-code.
- Add Edge Function unit tests (`deno test`) for `create-list` collision retry and `check-email`.
- Manual E2E on a **staging Supabase project** before the production window: signup → create sharable list → join by code on a 2nd account → claim item → confirm owner can't see the claim → OTA config fetch.

---

## 15. Phased Rollout (one-shot cutover)

**Phase 0 — Staging build-out (no user impact)**
- Provision Supabase project. Apply schema (§3), RLS (§4), triggers, Realtime publication.
- Deploy all Edge Functions; set secrets. Stand up Sentry + PostHog projects.
- Refactor the client on a branch behind `src/api/supabase.ts`; get the test suite green.
- Dry-run the full ETL against staging; validate.

**Phase 1 — Pre-cutover release (still on Firebase)**
- Ship a **native app update** whose only job is to be Supabase-capable, and **tighten `required_native_version`** so the OTA gate forces everyone onto a version ≥ the cutover build. Let adoption climb before the window. *(This is the critical step — once Firebase is gone, un-updated clients are dead, so flush them through the force-update path first.)*

**Phase 2 — Maintenance window (the cutover)**
1. Post maintenance notice; flip an `app_config`/Remote Config flag to a "read-only / maintenance" message that the client respects (freeze writes).
2. Final Firestore + Auth export.
3. Run ETL → load into production Supabase. Validate row counts + RLS spot-checks.
4. Release the production native build pointing at Supabase (or flip the already-shipped build's backend via config if abstracted).
5. Smoke-test signup/login/list/claim/OTA-config on production.
6. Lift maintenance flag.

**Phase 3 — Stabilize**
- Monitor Sentry/PostHog + Edge Function logs for 24–72h.
- Keep Firebase project **read-only** as a fallback for ~2 weeks.

**Phase 4 — Decommission**
- Delete RNFirebase deps, `firebase_config/`, `google-services.json`, `firebase.json`, mocks (§12).
- Disable/delete the Firebase project after the fallback window.

---

## 16. Rollback Plan

- The pre-cutover Firebase app remains fully intact and read/write until Phase 4. If Phase 2 smoke tests fail: lift no flags, point the build back at Firebase (config-driven), restore writes. Because ETL is additive (Supabase is fresh), rollback is "keep using Firebase" — no data loss as long as the write-freeze held.
- Keep the final Firestore export archived regardless.

---

## 17. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Removing RNFirebase forces a **native** release; stragglers on old binaries break at cutover | Phase 1 force-update gate via `required_native_version` *before* the window |
| `videoExtractor`/`receiptProcessor` (ffmpeg/tesseract/youtube-dl) don't run on Deno Edge | Re-architect to Gemini multimodal (drop ffmpeg/tesseract); fall back to Cloud Run only if frame extraction is mandatory — **design-review these two before committing** |
| Password hash import (Firebase scrypt → GoTrue) | Validate with test accounts on staging before the window; have a "reset password" email fallback path ready |
| RLS gaps re-exposing the surprise (owner sees claims) | Dedicated RLS tests; claims kept in a separate table with explicit `list_owner_id <> auth.uid()` checks |
| Realtime semantics differ from `onSnapshot` (deltas vs snapshots) | Port as "re-select on any change" first; optimize later |
| Field-casing / Timestamp mismatches leaking into UI | Centralize mapping in services; update `models.ts` types |
| App Check removal → signup enumeration/abuse | Rate limiting + CAPTCHA on `check-email`/signup |

---

## 18. Dependency Delta

**Remove:** `@react-native-firebase/{app,app-check,auth,crashlytics,firestore,functions,remote-config}`, `firebase` (web SDK referenced in `models.ts`), `functions/` Firebase deps.
**Add (client):** `@supabase/supabase-js`, `react-native-url-polyfill`, `@sentry/react-native`, `posthog-react-native`.
**Add (Edge, via `npm:`/`jsr:` specifiers):** `@supabase/supabase-js`, `@google/genai`, `cheerio`/`deno-dom`, `nanoid`, `djwt` (Sheets JWT), `googleapis` (if it loads under Deno; else raw REST).

---

## 19. Suggested Build Order (engineering sequence)

1. `api/supabase.ts` + schema/RLS/triggers on staging.
2. `AuthService` + `useAuth` + `profiles` flow → login works end-to-end.
3. `ListService` + `ClaimService` + `UserService` + `FeedbackService` (reads/writes).
4. Realtime channels.
5. Edge Functions: `create-list`, `check-email`, `get-config` first; then AI functions; flag the two hard ones.
6. Telemetry swap (Sentry/PostHog) + `App.tsx` config rewrite.
7. ETL scripts + staging dry-run + validation.
8. Tests green; manual E2E.
9. Phase 1 force-update release → Phase 2 window.

---

### Open items needing your input before Phase 0
- **`videoExtractor` / `receiptProcessor`:** OK to drop ffmpeg/tesseract/youtube-dl and route media straight to Gemini multimodal? (Strongly recommended — otherwise one Cloud Run container survives, which slightly dents "zero Firebase/GCP".)
- **Auth uid preservation:** confirm we can import Firebase users into Supabase keeping their original uid as the Supabase `id` (keeps all `owner_id` FKs valid with no remap).
- **APK hosting:** move to Supabase Storage bucket, or keep the existing host and only migrate the config value?
