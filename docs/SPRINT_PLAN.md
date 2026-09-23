# Sprint Plan

Built from `docs/AuditReport.md`, the migration notes, and the 300-item table in `docs/PLANNED_FEATURES.md`. Every audit finding was re-checked against the code on 2026-09-23. The audit predates the Supabase migration, so several findings are stale.

**Sizing:** each sprint is ~1 week for one developer. Feature numbers (`#N`) are the row numbers in the Priority Overview table in `PLANNED_FEATURES.md`.

> **Numbering warning:** the detail sections in `PLANNED_FEATURES.md` reuse numbers that do not match the table (for example, the detail section "19. Surprise Me" is table row #97, and "39. Audience-Specific Visibility" is table row #100). This plan always uses **table** numbers and names the feature.

---

## Part 1: Bug sprints

### Audit findings that no longer apply
| Audit item | Status |
|---|---|
| Insecure `http://ip-api.com` fallback in CreateProfile | Gone (no match in `src/`) |
| Client-side role assignment in `createList` | Mostly handled: a DB trigger adds the owner. The explicit upsert at `ListService.ts:114` is now only a defensive duplicate |
| `ErrorBoundary` missing | Exists and is wired in `App.tsx` |
| Firebase Cloud Functions are dead code | Still present in `functions/`, but nothing in `src/` calls them |

### Still-open findings, plus new ones found while verifying
| ID | Severity | Finding | Where |
|---|---|---|---|
| B1 | **High** | **Claim privacy relies on a client-supplied `list_owner_id`.** The INSERT policy only checks `auth.uid() != list_owner_id` and never checks that the claimer is a list member. A modified client can claim items on lists it cannot see, or set a fake `list_owner_id`. The "owner can't see who claimed" SELECT policy trusts the same column. | `001_initial_schema.sql:186-205`, patched in `002:82-90` |
| B2 | **High** | **Claim race and item locking.** `claims.item_id` is the primary key, so double-claims are blocked by the DB. Confirm the client handles the conflict error gracefully rather than showing a generic failure. | `ClaimService.claimItem` |
| B3 | High | Share codes use `Math.random()` and are checked for collisions only by the unique constraint. Move generation to an RPC using `gen_random_bytes` and retry on collision. | `ListService.ts:44` |
| B4 | High | Test suite is unusable: 17 of 18 suites fail. Causes: (a) a nested duplicate folder `GiftListApp-main/GiftListApp-main/` is picked up by Jest, (b) `functions/` tests need `@google/genai`, (c) `useLists.test.tsx` and `useListDetail.test.tsx` still target the removed Firestore API. | `jest` config, `src/hooks/__tests__/` |
| B5 | Med | `tsc` errors: `FriendsScreen.tsx:106` navigate typing (`MessagesTab` is not in the param list), `useLists.test.tsx` calls a removed method, and `supabase/functions` is compiled by the app's tsconfig (Deno types). | listed |
| B6 | Med | Unfiltered or overly broad realtime subscriptions in Claim, Friend and Message services (over-fetching). Channel names use `Date.now()`, so each mount opens a new channel. Verify that unsubscribe reliably runs on unmount. | `*Service.ts` |
| B7 | Med | Untested flows from the migration notes: list creation and items, claim/unclaim, join by share code, feedback submission. | see Sprint 1 |
| B8 | Med | `DashboardScreen` uses an index-based `keyExtractor`. `FlatList` is imported from `react-native-gesture-handler` in Dashboard and ListDetail. | `DashboardScreen.tsx:3,169`, `ListDetailScreen.tsx:5` |
| B9 | Med | N+1 queries: `MessageService` fetches the last message per conversation, and `ClaimService` does a redundant items lookup. | services |
| B10 | Low | `searchUsersByEmail` uses `ilike '%q%'` (table scan), and lets users enumerate emails. Prefer exact or prefix match. | `UserService.ts:136` |
| B11 | Low | `createStyles(colors)` is rebuilt on each render. `GiftItemRow` and `GiftListRow` are not memoized. | components |
| B12 | Low | Leftover Firebase: `@react-native-firebase/*` still in `package.json`, orphaned `functions/`, `firebase.json`, `google-services.json`, and `gemini.md` describing the wrong backend. | repo root |
| B13 | Low | `CreateProfile.tsx` is a state-heavy component (`useReducer` or a form library would help). `AddItemScreen` image aspect `[4, 3]` versus square thumbnails. | screens |

### Bug Sprint 1: Make it safe and verifiable
**Goal:** the test suite is green and the core loop (list → item → claim → join) is verified on-device.
- B4: delete or exclude the nested duplicate folder, delete `functions/` (dead), rewrite the two stale hook tests for the Supabase `ListService`, and add `jest.setup.js` with the AsyncStorage mock. Exit criterion: `npx jest --no-watchman` is green and runs in CI.
- B5: fix the `tsc` errors and exclude `supabase/functions` from the app tsconfig.
- B1 and B2: new migration `004_claims_security.sql`. Derive `list_owner_id` from `items → lists` with a trigger (or a `claim_item` RPC that checks membership and rejects owner claims). Add a unit or SQL test for "owner cannot claim own item" and "non-member cannot claim". Handle the duplicate-claim error in the UI.
- B7: manually walk through the four untested flows on the emulator and record results in the memory note. Fix whatever breaks.
- **Done when:** green tests, `tsc` clean, the four flows verified, and claims are server-enforced.

### Bug Sprint 2: Performance, data integrity, and cleanup
**Goal:** remove the known scale problems and the Firebase remnants.
- B3: `create_list` RPC that generates a secure share code with collision retry, in one transaction. Drop the client upsert.
- B6 and B9: tighten realtime filters. Add a `get_conversations_with_last_message` RPC or view. Remove the redundant query in `ClaimService`.
- B8, B10 and B11: FlatList fixes, memoized rows, and a prefix or exact-match email search.
- B12: remove unused Firebase packages (keep Crashlytics or Analytics only if still wanted), and delete `firebase.json`, `google-services.json` and the `functions/` remnants. Update `gemini.md` to say the backend is Supabase.
- B13: `AddItemScreen` aspect ratio. Refactor `CreateProfile` only if time remains.
- **Done when:** a Dashboard with about 50 lists and a long conversation list scroll smoothly, and `package.json` matches what the code uses.

---

## Part 2: Foundation sprint (required before most features)

Checking the code showed two gaps that many of the 300 features silently depend on:

1. **No push-notification infrastructure.** There is no `expo-notifications`, no device-token table, and no notification sender. Many planned features (reminders, alerts, delivery pings, waitlist, digest) need this.
2. **No `event_date` or `occasion` on `lists`.** About 8 features depend on it (#13, #16, #18, #20, #34, #35, #53, #99). Table row #19 is the one that introduces it.

### Foundation Sprint (call it F1)
- Add `event_date` and `occasion` to `lists`, plus a date picker in `ListEditScreen` and a countdown chip in `ListDetailScreen`. This is the core of #19 (the reminder Edge Function part of #19 lands in Sprint 5 with #37). Also add an occasion badge (#119).
- Add `push_tokens` and `notifications` tables and an Edge Function `send-push`, using Expo push (simplest with this stack, no Firebase needed). Register tokens on login.
- Add a `pg_cron` skeleton and one example scheduled job, so later features only add SQL.
- Add a notification history screen (#131), mark-all-read (#130) and per-list mute (#137). These reuse the new tables, and they give the push work something visible to verify.
- **Done when:** a test push reaches the emulator or device, the countdown chip shows, and a cron job runs.

---

## Part 3: Feature sprints

Rules used to group features: (1) put dependencies before dependents, (2) group features that touch the same files or tables so migrations and QA happen once, (3) keep each sprint's theme easy to explain, (4) defer the XL and Business tiers.

**Feature Sprints 1–12 cover the Small and Medium features plus the highest-value Large ones.** The remaining features (mostly XL, L and Business) are grouped into themes at the bottom and should be re-planned after Sprint 12, once real usage data exists. A few features are not yet placed in a sprint or theme (for example #43 Trending Items, #54 Friend Activity Feed, #75 Gift Inspiration, #81 Multi-Occasion Planning, #90 Multi-Language, #94 Public Profile, #64 Compatibility Score, #65 Household Lists, #66 Secret Santa, #69 Bulk Import), so sweep these into Sprint 12 or the later themes when you review.

### Sprint 1: Item essentials (all Small, all `items` table)
One migration, one pass through `AddItemScreen` and `GiftItemRow`.
- #1 Item Priority, #6 Expiring Items (Need By), #8 Tags, #12 Condition, #101 Color, #102 Size
- #9 "Already Own" flag, #10 Private Owner Notes, #3 Giver Notes
- #125 Char count on description, #120 Auto-capitalise names, #121 "Added X days ago", #149 Remove item photo, #150 Expand/collapse descriptions

### Sprint 2: The claim experience
Rebuild claim state so every later claim feature sits on it. Uses the server-enforced claim path from Bug Sprint 1.
- #2 Soft vs Hard Claim, #5 "In My Cart" Delivery Stage, #26 Pre-Claim Confirmation (basic version: item details and a note, and Gift DNA slots added in Sprint 6)
- #22 Timed Reservations, #98 Item Waitlist, #140 "Claim on Behalf of", #113 Haptics on claim
- #25 Delivery Confirmation Ping, #99 Claim Purchase Reminder (both need F1 push)

### Sprint 3: List management and Dashboard polish
All Small, mostly `DashboardScreen`, `ListDetailScreen`, and `GiftListRow`.
- #106 Pin list, #107 Dashboard sort, #111 Unclaimed count badge, #152 Member count, #153 Lock icon, #147 Card/Row toggle, #133 Density
- #108 Item search within list, #122 Newest-first, #110 Total list value, #109 Price display toggle for owners
- #13 Smart Archive, #129 Mark list fulfilled, #123 Swipe to archive, #124 Swipe to delete item, #105 Bulk delete, #104 Drag to rank
- #115 Recently viewed, #154 Quick-toggle privacy, #136 List description/tagline, #135 Custom emoji

### Sprint 4: Fast item entry and sharing
Reducing the effort of adding items and getting people onto a list.
- #103 One-tap add from clipboard URL (`expo-clipboard` is already installed), #11 Duplicate detection, #114 Auto-save draft, #24 "Gift This" Share Sheet, #116 Copy item URL
- #17 QR Code Sharing, #143 Quick-share code, #151 Copy share code, #117 Leave a shared list, #118 Decline invitation
- #4 Surprise Mode toggle, #7 List Visibility Windows, #97 "Surprise Me" random pick

### Sprint 5: Occasions and reminders (builds on F1)
- #20 Birthday and Occasion Reminders, #160 Monthly Occasion Calendar View, #34 Calendar integration, #21 Occasion Templates
- #37 Read Receipts (needed by reminders and by #38), #32 New Item Alert, #31 Announcement Posts
- #16 Annual List Cloning, #172 Occasion-specific onboarding prompts

### Sprint 6: Profile and Gift DNA
- #23 Gift DNA Profile, #163 Profile Photo Upload, #144 Profile completion prompt, #132 First-name-only, #134 Default privacy memory, #141 Last-active status
- Wire Gift DNA into the claim-confirmation screen from Sprint 2 (finishes #26)
- #15 Currency auto-detection, #145 App version and changelog, #146 Scheduled night mode, #30 Accessibility Mode (do it after the Bug Sprint 2 style and memoization cleanup, since it touches every hard-coded font size)

### Sprint 7: After the occasion
- #18 Thank You Tracker, #148 Batch Thank-You, #44 Gift Unwrapping Feed, #55 Thank-you photo or video
- #35 Post-Occasion Recap, #53 Resale Suggestions, #14 "Charity Instead"
- #156 Emoji reactions, #157 Wish counter, #155 Mark all claims as seen

### Sprint 8: Trust, safety and social graph
- #127 Block User, #128 Report Item, #47 Dispute Resolution, #49 Giver Anonymous Check-In, #41 Anonymous Gifting
- #28 Friend Groups, #100 Audience-specific visibility (needs #28 and #8), #161 Friend recommendations
- #29 Kids' List Management

### Sprint 9: Giver tools
- #42 Backchannel Giver Chat, #167 List Comment Thread, #38 "Almost Claimed" Nudge, #57 Hot Item indicator
- #27 "Gifted Before" Warning (needs #5 and #26), #56 Gift Exchange History, #58 Gift Value Tracking
- #36 Return Policy, #166 In-App Browser, #175 Side-by-side comparison, #142 Item URL Health Check, #165 Dead-link detection

### Sprint 10: Item depth
- #39 Quantity Tracking, #40 Multiple Images, #45 Savings Progress, #46 Verified Purchase Badge, #68 Item Versions / Alternatives, #159 List Cover Image
- #51 Address Book for Givers, #52 Shared "Do Not Buy" List

### Sprint 11: Notifications and account hygiene (completes F1)
- #162 Notification Preference Centre, #33 Smart Notification Batching, #179 Email Digest, #216 Smart Reminder Escalation
- #193 GDPR Data Export, #194 Account Deletion with full cleanup, #195 Two-Factor Auth, #196 Login Activity Log (**#193 and #194 are legal requirements for app-store and GDPR compliance; pull them earlier if launching soon**)
- #178 Social Login (Apple and Google)

### Sprint 12: Growth and premium packaging
- #164 and #173 Budget tracking and planner, #61 List Analytics, #62 Export to PDF, #63 Unlisted / One-time links, #158 Guest View Link
- #92 Share Card, #93 Premium List Themes, #202 Referral Programme, #203 Family Plan
- #185 Interactive Onboarding

### Later themes (re-plan after Sprint 12; not scheduled)
| Theme | Features | Why deferred |
|---|---|---|
| Retailer integrations | #74, #181–184, #186, #198, #199, #215, #227, #67, #70, #177 | Depend on partner APIs and scraping legality |
| Group gifting and payments | #73, #83, #88, #276, #265, #295 | Payments, compliance and Stripe review |
| AI features | #78–79, #82, #197, #208, #212, #237–241, #296, #300 | Need a cost and privacy decision first |
| Big platform bets | #230 web app, #231 iPad, #232–233 wearables, #234–236 voice, #87 and #260 offline | Each is its own project |
| Marketplace, business and enterprise | #242–258, #262, #273–274, #292 | Different product and audience |
| Games and gamification | #72, #191, #210, #217, #220, #266 | Low value, revisit last |

---

## Suggested order
`Bug 1 → Bug 2 → F1 → Sprints 1–4 (core polish) → Sprint 5 (occasions) → 6 → 7 → 8–12`

Sprints 1–4 need no new infrastructure and deliver the most visible value per day, which makes them a good way to start after F1.

## Open questions for you
1. Do you want to launch before Sprint 12? If so, move #193/#194 (GDPR and account deletion) and #178 (social login) forward.
2. Free vs Premium: which of the Premium-tagged features should ship free at launch to build the audience?
3. Push provider: this plan assumes Expo push (no Firebase). Say if you would rather keep Firebase Cloud Messaging.
