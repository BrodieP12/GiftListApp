# GiftListApp — Google Play Store Release & Testing Guide

Everything required to get GiftListApp onto the Google Play Store so real users
can download and test it. Written for someone new to the project, on **Windows
PowerShell**. `<...>` means paste a real value.

> **Do this first:** the app's backend must already be live. Complete
> `SETUP_AND_RELEASE.md` (Supabase project, schema, functions, env) through at
> least Phase 6 before building a store release — otherwise testers install an
> app that can't talk to a backend.

---

## Key facts about this app (already configured)

| Thing | Value |
|---|---|
| Android package name | `com.brodiepasker.giftlistapp` |
| App version | `1.1.0` (versionCode auto-increments on EAS production builds) |
| EAS owner / project | `bpasker20` / projectId in `app.json` |
| Build tool | EAS Build (cloud) — keystore is created & managed by EAS automatically |
| Store binary | `.aab` (Android App Bundle) — produced by the `production` profile |
| Notable | Camera permission is blocked; app has **minor-protection** logic (matters for the audience/content rating questionnaire) |

---

## Phase 1 — Accounts & tooling (one time)

1. **Google Play Developer account** — https://play.google.com/console/signup
   - One-time **US$25** fee. Use the Google account that will own the app.
   - Complete identity verification (Google may take 1–2 days to approve).
2. **EAS CLI** — already installed. Log in to the project's Expo account:
   ```powershell
   cd C:\GiftListApp\GiftListApp
   eas login        # use the 'bpasker20' account (or be added as a member)
   eas whoami
   ```

---

## Phase 2 — Put your backend keys into EAS (so the cloud build has them)

The app reads `EXPO_PUBLIC_*` variables **at build time**. Your local `.env` is
gitignored and does NOT reach EAS's cloud builders, so you must register the
values with EAS. These keys are all publishable (safe in a client app).

Create them as EAS environment variables for the **production** environment:

```powershell
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value "https://<PROJECT_REF>.supabase.co" --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<ANON_KEY>" --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SENTRY_DSN --value "<SENTRY_DSN>" --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_POSTHOG_KEY --value "<POSTHOG_KEY>" --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_POSTHOG_HOST --value "https://us.i.posthog.com" --visibility plaintext
```

Then make the `production` build profile use that environment. Open `eas.json`
and add `"environment": "production"` to the production profile:

```json
"production": {
  "autoIncrement": true,
  "channel": "production",
  "environment": "production"
}
```

> Verify later that the built app actually talks to Supabase — if login fails
> with a network/URL error, these variables didn't make it into the build.

---

## Phase 3 — Build the release bundle (.aab)

```powershell
eas build --platform android --profile production
```

- The first time, EAS asks to **generate a new Android Keystore** — say **yes**.
  EAS stores it; Google Play will use it via Play App Signing. Do not lose access
  to the Expo account (it holds the upload key).
- The build runs in the cloud (~10–20 min). When done, the EAS page has a
  **Download** link for the `.aab`. Download it.

---

## Phase 4 — Create the app in Google Play Console

1. Go to https://play.google.com/console → **Create app**.
2. Fill in:
   - App name: **GiftListApp**
   - Default language, app/game = **App**, Free or Paid = **Free**
   - Accept the declarations.
3. The app's package name (`com.brodiepasker.giftlistapp`) is registered the
   first time you upload a build (Phase 6).

---

## Phase 5 — Complete the required store listing & policy forms

Play won't let you ship until these are done (left-nav of the Console):

1. **Store listing** (Main store listing):
   - Short description (≤80 chars) and full description.
   - **App icon** 512×512 PNG.
   - **Feature graphic** 1024×500 PNG.
   - **Phone screenshots** — at least 2 (take them from a running build or an emulator).
2. **Privacy policy URL** — REQUIRED. You must host a privacy policy (the app
   collects email, profile, feedback; uses Sentry/PostHog). A simple hosted page
   or a Supabase Storage–hosted HTML page works. Paste its URL under
   **App content → Privacy policy**.
3. **Data safety** (App content → Data safety): declare what you collect:
   - Email address, name (account), app activity/analytics (PostHog), crash logs
     (Sentry). State whether data is encrypted in transit (yes) and if users can
     request deletion.
4. **Content rating** — fill the questionnaire (generates IARC ratings).
5. **Target audience & content** — because the app has minor-protection logic,
   answer the age questions honestly. If you target **13+** (recommended for a
   first test release), you avoid the stricter "Designed for Families" / children
   policies. If any target age is under 13, additional COPPA/Families
   requirements apply — decide this deliberately.
6. **App access** — if sign-in is required to use the app, provide **test
   credentials** (a demo email + password you pre-created in Supabase) so Google's
   reviewers can log in. Create one: sign up in the app, or add a user in the
   Supabase dashboard.
7. **Ads** — declare whether the app shows ads (it does not).

---

## Phase 6 — Ship to the Internal testing track (fastest path for testers)

**Internal testing** is the quickest way to get the app to real testers (up to
100, available within minutes, minimal review). Use this for "download and test."

1. In Play Console: **Testing → Internal testing → Create new release**.
2. Upload the `.aab` from Phase 3 (drag it in). Accept Play App Signing if prompted.
3. Add **release notes** (e.g. "First Supabase build — please test signup, lists,
   sharing, claiming, and password reset").
4. **Save → Review release → Start rollout to Internal testing**.
5. **Testers tab** → create an email list → add your testers' Google account
   emails → **Save**.
6. Copy the **opt-in URL** and send it to testers. Each tester must:
   - Open the link, tap **Become a tester**, then **Download on Google Play**.
   - (Android installs from the Play Store like any app.)

> Internal testing builds are private to people on your tester list. This is the
> right track for friends/beta users to try it.

---

## Phase 7 — (Later) Moving to public Production

Going fully public has extra Google requirements you should know now:

- **New personal developer accounts** must run **Closed testing with ≥12 testers
  for ≥14 continuous days**, then apply for production access. Internal testing
  (Phase 6) does NOT count toward this — plan the 12-tester/14-day closed test if
  you intend to launch publicly.
- When eligible: **Production → Create new release** → upload the same/newer
  `.aab` → roll out. Full Google review can take a few days.

---

## Phase 8 — Shipping updates after the first release

- **JavaScript-only changes** (no new native libraries): publish over-the-air
  with `eas update --branch production`. Users get it without a Play Store update.
- **Native changes** (adding/removing native modules, permissions, SDK bumps):
  build a new `.aab` (`eas build -p android --profile production`, which
  auto-increments versionCode) and upload a new release to the track. Bump
  `version` in `app.json` for clarity.

---

## Quick checklist

- [ ] Backend live (`SETUP_AND_RELEASE.md` done through Phase 6)
- [ ] `EXPO_PUBLIC_*` set in EAS production environment + referenced in `eas.json`
- [ ] Play Developer account approved (US$25 paid)
- [ ] `eas build -p android --profile production` → `.aab` downloaded
- [ ] App created in Play Console
- [ ] Store listing assets (icon, feature graphic, 2+ screenshots, descriptions)
- [ ] Privacy policy URL added
- [ ] Data safety, content rating, target audience, app access (test login) done
- [ ] Internal testing release rolled out; opt-in link sent to testers
- [ ] (Optional) reset-password email template includes `{{ .Token }}` so the in-app "Forgot Password" works
