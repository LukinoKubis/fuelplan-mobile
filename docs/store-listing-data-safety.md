# Store listing — Data Safety / App Privacy draft answers

Prep material for issue #6 (M6 store submission). Drafted from the live
privacy policy (`fuelplan.fit/privacy`, last updated 2026-07-25) and the
actual data flows documented across this repo's and `claude-backend`'s
CLAUDE.md files. Not submitted anywhere — both forms are filled out
inside Apple's App Store Connect / Google Play Console during actual
submission, which is blocked on Developer Program / Play Console
enrollment (see #6, #19). This is answer content to paste in once that's
unblocked, not a substitute for reviewing the live forms at submission
time (categories/wording drift release to release).

## Google Play — Data Safety form

| Category | Collected? | Data types | Shared with third parties? | Purpose |
|---|---|---|---|---|
| Personal info | Yes | Email address | No | Account creation/login |
| Health and fitness | Yes | Fitness info (weight, height, age, sex, training habits, dietary restrictions, cuisine preferences), Health info (none beyond the above — no medical data) | No | Macro target calculation, plan personalization |
| Photos and videos | Yes | Photos (optional recipe cover photos) | Yes — Supabase (storage only) | App functionality |
| App activity | Yes | App interactions (saved recipes, favorites, tracking/calendar entries) | No | App functionality |
| Financial info | Yes | Purchase history (plan-credit top-ups) | Yes — Lemon Squeezy (payment processing) | Payments |
| Messages / User content | Yes | Recipe import text (pasted or link-derived captions/transcripts) | Yes — Anthropic, OpenAI (processing only, not retained by them for training per their API terms) | AI recipe extraction |
| Device or other IDs | Yes | Push notification token | Yes — Expo/Firebase (delivery only) | Optional reminders |
| Location | No | — | — | — |
| Contacts | No | — | — | — |
| Files and docs | No | — | — | — |

**Data deletion**: yes, self-serve in-app (Settings → Account → Delete
Account), matches `POST /api/account/delete` (see `claude-backend`
CLAUDE.md's Redis key list for exactly what gets removed vs. retained).

**Encryption in transit**: yes (HTTPS/TLS to Railway backend and every
third party above).

**Data collection is required for the app to function** for: email
(account), profile/body stats (macro calc), recipe import text (only
when the user chooses to import from a link/paste — no import, no AI
call). Optional: push token (opt-in), recipe photos, tracking data.

## Apple App Privacy ("Nutrition Label")

| Apple category | Linked to identity? | Used for tracking? | Purpose |
|---|---|---|---|
| Contact Info (email) | Yes | No | App functionality (account) |
| Health & Fitness (weight/height/age/sex/training habits) | Yes | No | App functionality (macro calc, personalization) |
| User Content (recipes, photos, tracking notes, recipe-import text) | Yes | No | App functionality |
| Identifiers (push token) | Yes | No | App functionality (optional reminders) |
| Purchases (plan-credit top-ups) | Yes | No | App functionality (payments) |
| Usage Data | No | No | Not currently collected (no analytics/telemetry SDK in this app) |
| Diagnostics | No | No | Not currently collected |

**"Used to track you across apps/websites"**: No to all categories — no
ad SDK, no cross-app tracking, no data sale (matches the privacy policy's
"we do not sell your personal information" / "we do not use your data to
serve you third-party advertising" statements verbatim).

## Reviewer demo account

Created 2026-08-07 for both stores' review flow (a fresh, empty account —
reviewers need to be able to sign in and see the app work without using a
real user's data): `reviewer@fuelplan.fit`. Password delivered directly,
not committed here or in any issue comment — this repo is public and the
account is real (same production auth as any other signup).
