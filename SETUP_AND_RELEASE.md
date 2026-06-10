# GiftListApp — Setup & Release Runbook (Supabase)

A step-by-step guide for someone new to this project. Follow the phases in
order. Commands are written for **Windows PowerShell** (the project's shell).
Anywhere you see `<...>` you must paste in a real value.

There are two situations:
- **Path A — Fresh launch:** you do NOT need to carry over old Firebase data.
  Do everything EXCEPT Phase 5. This is the simplest path.
- **Path B — Existing users/data:** you must migrate Firebase data. Do all phases.

---

## Phase 0 — Install tools (one time)

You already have Node 20 and the EAS CLI. You still need the Supabase CLI.

```powershell
# Supabase CLI
npm install -g supabase
supabase --version        # confirm it prints a version

# (optional) Deno — only if you want to run Edge Functions locally
# https://docs.deno.com/runtime/getting_started/installation/
```

Get the code and install dependencies:

```powershell
cd C:\GiftListApp\GiftListApp
git checkout feat/supabase-migration
npm install --legacy-peer-deps
```

---

## Phase 1 — Create the cloud accounts (one time)

Sign up for each and keep the keys handy (you'll paste them in Phase 3/6):

1. **Supabase** — https://supabase.com → create an **organization** and a **project**.
   - Choose a region near your users. Save the database password.
2. **Sentry** — https://sentry.io → create a **React Native** project → copy its **DSN**.
3. **PostHog** — https://posthog.com → create a project → copy the **Project API Key** and **Host**.
4. **Gemini API key** — https://aistudio.google.com/apikey → create an API key.
5. **(Path B only) Google service account for Sheets** — only if you use the
   feedback→Sheets sync. Otherwise skip it (the feature just won't run).
6. **Expo/EAS** — the project is already linked (owner `bpasker20`). Log in:
   ```powershell
   eas login
   ```

From the Supabase project, open **Project Settings → API** and copy:
- **Project URL** (looks like `https://abcdxyz.supabase.co`)
- **anon public** key
- **service_role** key (secret — never ship this in the app)
- The **Project Ref** = the `abcdxyz` part of the URL.

---

## Phase 2 — Link the project & apply the database schema

```powershell
supabase login                              # opens a browser to authorize
supabase link --project-ref <PROJECT_REF>   # paste the ref from Phase 1
```

Apply all migrations (creates tables, RLS, triggers, realtime):

```powershell
supabase db push
```

Verify in the dashboard (**Table Editor**) that these tables exist:
`profiles, lists, list_members, items, claims, feedback, app_config`.

---

## Phase 3 — Configure Auth & Edge Function secrets

**3a. Email/password auth.** In the dashboard: **Authentication → Providers →
Email** → enable it. Under **Authentication → Settings**, turn **"Confirm email"
OFF** (the app signs users in immediately, matching the old Firebase behavior).
Optionally set the **Site URL** to `giftlistapp://`.

**3a-bis. Password-reset email (REQUIRED for "Forgot Password").** The in-app
reset uses a 6-digit code. In **Authentication → Email Templates → Reset
Password**, make sure the body shows the code by including `{{ .Token }}`, e.g.:

```
<p>Your GiftListApp password reset code is:</p>
<h2>{{ .Token }}</h2>
<p>Enter this code in the app. It expires in 1 hour.</p>
```

Without `{{ .Token }}` in the template, users won't see the code they need to type.

**3b. Edge Function secrets** (these are server-side; never in the app bundle):

```powershell
supabase secrets set GEMINI_API_KEY=<your_gemini_key>
# Path B only, if using the feedback→Sheets sync:
supabase secrets set FEEDBACK_SHEET_ID=<your_google_sheet_id>
supabase secrets set GOOGLE_SHEETS_SA_JSON=<paste_the_entire_service_account_json_string>
```

> `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
> injected automatically into functions — you do NOT set those.

---

## Phase 4 — Deploy the Edge Functions

Deploy each function (the CLI picks up `supabase/functions/deno.json`):

```powershell
supabase functions deploy create-list
supabase functions deploy check-email
supabase functions deploy get-config
supabase functions deploy scrape-product
supabase functions deploy extract-product
supabase functions deploy compare-products
supabase functions deploy analyze-price
supabase functions deploy manage-wishlist
supabase functions deploy process-receipt
supabase functions deploy extract-product-from-video
supabase functions deploy sync-feedback-to-sheets
```

**4a. (Path B / feedback sync) Wire the feedback webhook.** In the dashboard:
**Database → Webhooks → Create a new hook**:
- Table: `public.feedback`, Events: **Insert**
- Type: **Supabase Edge Functions** → `sync-feedback-to-sheets`
- Add an HTTP header `Authorization: Bearer <SERVICE_ROLE_KEY>` so it passes auth.
- Share the target Google Sheet with the service account's email as **Editor**.

**4b. Smoke-test a function:**

```powershell
# Replace URL + anon key. Should return JSON config.
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/get-config" `
  -H "Authorization: Bearer <ANON_KEY>" -H "Content-Type: application/json" -d "{}"
```

---

## Phase 5 — Migrate existing data  *(PATH B ONLY — skip for a fresh launch)*

> Order matters: **auth users first**, then profiles/lists/etc., because every
> `owner_id` points at an `auth.users` row.

**5a. Export from Firebase.**
```powershell
# Put your Firebase service account key here:
#   C:\GiftListApp\GiftListApp\serviceAccountKey.json
cd C:\GiftListApp\GiftListApp\migration
npm install
npm run extract        # writes extracted_data.json
```

Export the auth users (needs Firebase CLI: `npm i -g firebase-tools`):
```powershell
firebase login
firebase auth:export users.json --project giftlistapp-557ce
```

**5b. Import the auth users into Supabase.** This is the one genuinely involved
step (Firebase stores passwords as scrypt hashes). Pick ONE:
- **Simplest (recommended):** import each user by email **preserving their UID**
  using the Admin API, then have everyone do a one-time **password reset** on
  first login. (Send a reset via **Authentication → Users**, or enable "Forgot
  password" in the app.)
- **No-reset (advanced):** lazy-migrate — verify the Firebase hash on first login
  in an Edge Function and set the Supabase password then. See Supabase's
  "Migrate from Firebase Auth" guide. More work; only do this if a password
  reset is unacceptable.

  Whichever you choose, the UID **must** be preserved so the data FKs line up.

**5c. Transform + load the data.**
```powershell
# Create migration/.env with:
#   SUPABASE_URL=https://<PROJECT_REF>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
npm run transform      # writes transformed_data.json
npm run load           # upserts profiles -> lists -> items -> claims -> feedback
```
Confirm row counts in the dashboard match Firebase.

---

## Phase 6 — Configure the app & APK hosting

**6a. App environment.** Create `C:\GiftListApp\GiftListApp\.env` (copy from
`.env.example`) and fill in:
```
EXPO_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
EXPO_PUBLIC_SENTRY_DSN=<sentry_dsn>
EXPO_PUBLIC_POSTHOG_KEY=<posthog_key>
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

**6b. APK hosting bucket.** In the dashboard: **Storage → Create bucket** named
`apk`, marked **Public**. You'll upload the built APK here in Phase 7 and the app
downloads native updates from it.

**6c. Point the config at your bucket.** In **Table Editor → app_config**, edit
the `apk_download_url` row, replacing `REPLACE_PROJECT` with your project ref:
```
https://<PROJECT_REF>.supabase.co/storage/v1/object/public/apk/latest.apk
```

---

## Phase 7 — Build & ship the app

Because the Firebase native modules were removed, this is a **new native build**
(not an over-the-air update).

```powershell
cd C:\GiftListApp\GiftListApp
eas build --platform android --profile production
```

When the build finishes:
1. Download the `.apk`/`.aab` from the EAS build page.
2. Upload the APK to the `apk` Storage bucket as **`latest.apk`** (so the
   `apk_download_url` works for future native-update prompts).
3. Distribute the build to users (Play Store, or share the APK link).

**7a. Force everyone onto this build.** In **app_config**, set
`required_native_version` to this build's version (**`1.1.0`**). Older installs
will then show the "download the latest APK" prompt and move to Supabase.

---

## Phase 8 — Cutover (PATH B) and verification

**Maintenance-window cutover (Path B):**
1. Announce a short maintenance window.
2. Do a **final** `npm run extract && npm run transform && npm run load` to catch
   last-minute changes.
3. Confirm row counts, then tell users to update.

**Verify (both paths)** — install the new build and check:
- [ ] Sign up a new account → it logs in, a `profiles` row appears.
- [ ] Create a **sharable** list → a `share_code` is generated.
- [ ] On a 2nd account, join via that code → you can see the list.
- [ ] Claim an item on a shared list.
- [ ] Log in as the list **owner** → you must **NOT** see who claimed it (the surprise still works).
- [ ] Submit feedback → a row lands in `feedback` (and the Sheet, if configured).
- [ ] Sentry shows a test event; PostHog shows `app_info` events when debug mode is on.

---

## Phase 9 — Save the work in git

Nothing is committed yet. From the project root:

```powershell
git add app.json package.json package-lock.json babel.config.js tsconfig.json `
  jest.setup.js .gitignore .env.example App.tsx `
  src/ supabase/ migration/ __mocks__/supabaseMock.js `
  SUPABASE_MIGRATION_PLAN.md SETUP_AND_RELEASE.md
git rm --cached google-services.json firebase.json 2>$null
git commit -m "Migrate from Firebase to Supabase"
git push -u origin feat/supabase-migration
```
Then open a Pull Request to merge `feat/supabase-migration` into `main`.

> The old `functions/` directory (the Firebase Cloud Functions) is left in place
> for reference. Once you've confirmed everything works on Supabase, delete it.

---

## Quick reference — where things live
- DB schema / RLS / triggers: `supabase/migrations/`
- Edge Functions: `supabase/functions/<name>/index.ts`
- App ↔ Supabase glue: `src/api/supabase.ts`, `src/api/mappers.ts`, `src/types/database.ts`
- Remote config (was Firebase Remote Config): `app_config` table + `get-config` function, read by `src/services/ConfigService.ts` and `App.tsx`
- Data migration scripts: `migration/` (`npm run extract|transform|load`)
- Full architecture rationale: `SUPABASE_MIGRATION_PLAN.md`
