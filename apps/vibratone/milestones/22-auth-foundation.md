# 22. Auth Foundation

## Outcome

A learner can optionally create an account and claim their local progress under a persistent identity, while every anonymous flow—AP practice, relative pitch, daily puzzle, placement test, and local export—continues to work without an account.

The M22 account is a preparatory identity layer: it establishes session infrastructure and a migration path so cross-device sync (M23) has a proven foundation to build on. Learners who do not create an account experience no change in capability.

## Product Requirements

- Choose and integrate an auth provider before implementation begins. The selected provider is **Better Auth** (`better-auth` npm package). It supports email/password and OAuth, has documented SvelteKit session integration via `hooks.server.ts`, supports anonymous-to-account linking, imposes no third-party marketing pixels, and produces sessions compatible with entitlement checks in M23. The choice must be documented in `docs/auth-provider.md` (author, date, alternatives considered, rationale) before a single line of implementation lands.
- Add sign-in, sign-out, and signed-out fallback states. Sign-in and sign-out are form actions with `use:enhance`.
- Add silent session refresh: `hooks.server.ts` extends any session expiring within 7 days without interrupting the user.
- Add route guards for account-only surfaces. Only these routes require a session at M22: `/account`, `/account/privacy`, `/account/export`, and `/account/delete`. All other routes—including `/`, `/practice`, `/placement`, `/puzzle`, and `/local-export`—must be accessible with no session present.
- Add local-to-account migration. Migration is always a deliberate, user-initiated action with a visible confirmation step. Migration is a copy, not a move: local data is retained until the user chooses to clear it. Local data is never cleared automatically on sign-up or migration.
- Add account profile, privacy settings, account-level data export, and two-phase account deletion.
- Add test fixtures for authenticated, anonymous, and expired-session states.
- Confirm that `adapter-auto` resolves to a server-capable adapter (adapter-node, adapter-vercel, or adapter-cloudflare) before deployment, since `hooks.server.ts` requires a live server runtime. Anonymous AP practice routes in `(public)/` may declare `export const prerender = true` in their `+page.ts` to preserve static-like behavior; this decision must be explicit before the first deployment after M22 merges.

## User Experience Requirements

- Anonymous and local use remains available after auth ships. Existing AP practice, relative-pitch, theory, daily puzzle, placement test, and local export flows must not require sign-in.
- Account creation must display the following copy, visible before the account creation action is enabled:

  > "Creating an account saves your identity so your progress can sync across devices in a future update. All practice and local data continue to work without an account."

  This copy must not promise sync, paid features, or classroom access—those ship in M23 and M24.

- A learner can explicitly import local progress into an account via a confirmation step that names what will be transferred. Import is idempotent: submitting the same attempt events twice does not double-count them, keyed on event IDs.
- Sign-out must show a dialog with two explicit options: "Sign out" (preserves all local data) and "Sign out and clear local data" (removes all `vibratone:*` localStorage keys after the server session is destroyed). The dialog must name which data stays locally after a standard sign-out.
- Auth failure states must be recoverable without losing local progress. An expired or invalid session must not discard an in-progress drill attempt; the attempt completes, then a non-blocking re-auth prompt appears. The learner can dismiss and continue anonymously.
- Account deletion is a two-step confirmed flow. Step 1: the learner clicks "Delete account" on `/account/delete`, a `<dialog>` appears. The dialog confirms consequences and lists which localStorage keys remain after deletion (currently `vibratone:session-score`, `vibratone:all-time-score`, and `vibratone:settings`). Step 2: the learner confirms; the server destroys cloud data in a single transaction; the session cookie is cleared; the client redirects to `/`. Local storage is NOT cleared by the server action—that choice belongs to the user.

## Data and Analytics Requirements

- Account records are never created for anonymous users.
- The server-side account table holds exactly four columns: `account_id` (uuid, primary key), `email` (string), `created_at` (timestamp), `deleted_at` (nullable timestamp). No device fingerprint, no IP address retained beyond the current request, no behavioral analytics field, no marketing flag. A schema-level integration test must assert no additional columns exist.
- Sessions live in a separate one-to-many table with columns: `session_id`, `account_id` (foreign key), `token_hash` (string), `expires_at` (timestamp). Sessions are deleted immediately on sign-out or account deletion.
- Account deletion is two-phase: requesting deletion sets `deleted_at` and immediately destroys all sessions for that account (account becomes inaccessible at once). A purge after a configurable retention window (default 30 days, mocked to zero in tests) deletes all rows: attempt events, FSRS cards, saved packs, sessions, then the account row—all in one database transaction.
- Local-to-account migration payload is schema-versioned. The server validates `schemaVersion` before writing. A version mismatch returns 422. Migration writes all collections in a single database transaction; any failure rolls back completely.
- Session events must not include email addresses, full names, or IP addresses. Session audit logs contain only `account_id`, timestamp, and event type.
- The account-level data export (`GET /account/export`) streams a JSON file containing: `{ exportedAt, schemaVersion, account: { email, createdAt }, attemptLog, fsrsCards, savedPacks, preferences }`. Raw audio and microphone data are excluded by type.

## Accessibility Requirements

- Sign-in form: `<label>` bound to `<input>` with matching `id`/`for`; errors injected into an `aria-live="assertive"` region; submit button not disabled while loading (use `aria-busy` instead).
- Sign-out dialog: opened with `dialog.showModal()` (not the `open` attribute), focus trapped inside, `Escape` closes it, `aria-labelledby` references the dialog heading.
- Account deletion confirmation: `aria-describedby` points to the consequence description; the destructive button carries `aria-label="Delete my account permanently"`.
- All auth flows (sign-in, sign-out, profile, privacy settings, deletion confirmation) pass keyboard-only navigation: Tab cycles through all interactive elements, Enter activates buttons, Escape closes dialogs, and every focus state is visible.
- All auth surfaces pass at 375 px viewport width with no horizontal scroll.
- Auth error states are announced via `role="alert"` regions.

## Module and Architecture Targets

### New files

| File                                                         | Purpose                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/auth-provider.md`                                      | Decision record: provider name, alternatives, rationale, date. Required before implementation.                                                                                                                                                                                                                             |
| `src/app.d.ts`                                               | Extends `App.Locals` with `user: AuthUser \| null` and `session: AuthSession \| null`.                                                                                                                                                                                                                                     |
| `src/hooks.server.ts`                                        | `handle`: reads session cookie, resolves user via `validateSession`, populates `event.locals`, silently renews sessions expiring within 7 days.                                                                                                                                                                            |
| `src/lib/server/auth.ts`                                     | `AuthPort` interface + Better Auth adapter. Exports `createSession`, `validateSession`, `deleteSession`, `deleteAccount`, `refreshSession`, `purgeDeletedAccounts`.                                                                                                                                                        |
| `src/lib/server/auth.fake.ts`                                | In-memory fake implementation of `AuthPort` for unit and integration tests. Supports injectable clock for expired-session testing.                                                                                                                                                                                         |
| `src/lib/server/migration.ts`                                | `migrateDrillHistory`, `migratePreferences`, `migrateSavedPacks`. Accepts `LocalMigrationPayload`, writes in a transaction.                                                                                                                                                                                                |
| `src/lib/context/session.ts`                                 | `createContext`-based session context. Exports `getSessionContext` and `setSessionContext`. Pattern mirrors `getPracticeState`/`setPracticeState` in `state.svelte.ts`.                                                                                                                                                    |
| `src/lib/auth-state.svelte.ts`                               | Re-exports the `setSessionContext`/`getSessionContext` pair and the `SessionUser` type.                                                                                                                                                                                                                                    |
| `src/routes/(public)/+layout.svelte`                         | Passthrough layout; all drill and AP practice routes stay here. Root `+layout.svelte` stays guard-free.                                                                                                                                                                                                                    |
| `src/routes/(authenticated)/+layout.server.ts`               | The only route guard: `if (!locals.user) redirect(302, '/sign-in?returnTo=' + encodeURIComponent(url.pathname + url.search))`. All account routes live inside this group so the guard fires for every `/account/*` request. Route groups do not appear in the URL, so `/account`, `/account/privacy`, etc. are unaffected. |
| `src/routes/(authenticated)/account/+page.svelte`            | Profile view, data export button, link to delete confirmation. URL: `/account`.                                                                                                                                                                                                                                            |
| `src/routes/(authenticated)/account/+page.server.ts`         | `load`: returns `{ user }` from `locals.user`.                                                                                                                                                                                                                                                                             |
| `src/routes/(authenticated)/account/privacy/+page.svelte`    | Privacy settings (opt-out controls for aggregate submission from M21). URL: `/account/privacy`.                                                                                                                                                                                                                            |
| `src/routes/(authenticated)/account/privacy/+page.server.ts` | `load` + `actions` for privacy preference updates.                                                                                                                                                                                                                                                                         |
| `src/routes/(authenticated)/account/export/+server.ts`       | `GET`: streams `AccountExport` JSON with `Content-Disposition: attachment; filename=vibratone-export-{date}.json`. URL: `/account/export`.                                                                                                                                                                                 |
| `src/routes/(authenticated)/account/delete/+page.svelte`     | Two-step deletion confirmation with native `<dialog>`. URL: `/account/delete`.                                                                                                                                                                                                                                             |
| `src/routes/(authenticated)/account/delete/+page.server.ts`  | `actions.confirm`: soft-deletes account (sets `deleted_at`, destroys all sessions) in a single transaction, then calls `purgeDeletedAccounts(now)` with the retention window mocked to zero in tests so the integration test can assert zero rows remain immediately.                                                      |
| `src/routes/(authenticated)/account/migrate/+page.svelte`    | Migration form: serializes local state via `$state.snapshot()`, POSTs to the form action. URL: `/account/migrate`.                                                                                                                                                                                                         |
| `src/routes/(authenticated)/account/migrate/+page.server.ts` | `actions.import`: validates `LocalMigrationPayload.schemaVersion`, writes all collections in a transaction, returns `MigrationResult`.                                                                                                                                                                                     |
| `src/routes/sign-in/+page.svelte`                            | Sign-in form with `use:enhance`. `aria-live="assertive"` error region.                                                                                                                                                                                                                                                     |
| `src/routes/sign-in/+page.server.ts`                         | `actions.default`: validates credentials, calls `createSession`, sets `HttpOnly SameSite=Lax` session cookie.                                                                                                                                                                                                              |
| `src/routes/sign-out/+page.server.ts`                        | `actions.default`: calls `deleteSession`, clears cookie, calls `invalidateAll` via `use:enhance` result callback on the client.                                                                                                                                                                                            |
| `src/lib/components/auth-status.svelte`                      | Header component showing sign-in link or user email and sign-out trigger. Reads from `getSessionContext()`.                                                                                                                                                                                                                |
| `src/lib/components/sign-out-dialog.svelte`                  | Native `<dialog>` with two options: standard sign-out and sign-out-and-clear-local.                                                                                                                                                                                                                                        |
| `e2e/fixtures/auth.ts`                                       | Playwright fixtures extending `test` with `authenticatedPage` and `signedOutPage`.                                                                                                                                                                                                                                         |
| `e2e/global-setup.ts`                                        | Generates `e2e/fixtures/authenticated.json` and `e2e/fixtures/expired-session.json` before the test run. Anonymous is the default browser context—no fixture file needed.                                                                                                                                                  |
| `docs/data-retention.md`                                     | Lists exact localStorage keys that survive account deletion: `vibratone:session-score`, `vibratone:all-time-score`, `vibratone:settings`. Required by AC-06.                                                                                                                                                               |

### Types introduced

```ts
// src/lib/server/auth.ts

/** An account record stored in the database. */
export type AuthUser = {
	id: string;
	email: string;
	createdAt: Date;
};

/** An active session. One-to-many with AuthUser. */
export type AuthSession = {
	id: string;
	userId: string;
	expiresAt: Date;
};

/** The seam used in unit and integration tests. All auth operations go through this. */
export type AuthPort = {
	createSession(userId: string): Promise<{ token: string; session: AuthSession }>;
	validateSession(
		token: string
	): Promise<{ user: AuthUser; session: AuthSession } | { user: null; session: null }>;
	refreshSession(token: string): Promise<{ token: string; session: AuthSession } | null>;
	deleteSession(token: string): Promise<void>;
	deleteAccount(userId: string): Promise<void>;
	/** Remove all rows for accounts whose deleted_at is before `before`. Call with Date.now() in production; injectable in tests to simulate the retention window elapsing. */
	purgeDeletedAccounts(before: Date): Promise<void>;
};
```

```ts
// src/lib/server/migration.ts

/**
 * Assembled from localStorage by the migration page component and POSTed to
 * /account/migrate. The schemaVersion field is validated server-side before
 * any writes begin.
 *
 * Type stubs for AttemptEvent (from learning/analytics), FsrsCard (from
 * learning/scheduling), and SavedPack (from learning/protocols) are defined
 * inline here until those modules ship; see External Dependency Contracts.
 */
export type LocalMigrationPayload = {
	schemaVersion: number;
	attemptLog: AttemptEvent[];
	fsrsCards: FsrsCard[];
	savedPacks: SavedPack[];
	preferences: PersistedSettings;
};

export type MigrationResult = {
	imported: number;
	skipped: number;
	errors: string[];
};
```

```ts
// src/lib/context/session.ts
import { createContext } from 'svelte';
import type { AuthUser } from '$lib/server/auth';

export type SessionUser = { id: string; email: string };
export type SessionContext = { user: () => SessionUser | null };

export const [getSessionContext, setSessionContext] = createContext<SessionContext>();
```

```ts
// src/app.d.ts
import type { AuthUser, AuthSession } from '$lib/server/auth';

declare global {
	namespace App {
		interface Locals {
			user: AuthUser | null;
			session: AuthSession | null;
		}
	}
}
export {};
```

### SSR boundary for migration and deletion

`localStorageOrNull()` in `src/lib/persistence.ts` returns `null` on the server (guarded by `$app/environment` `browser`). Migration and deletion must be client-initiated:

1. The migration page component reads local state via `$state.snapshot()` to serialize reactive proxies before POST.
2. The form action at `(authenticated)/account/migrate/+page.server.ts` receives the JSON payload in `request.formData()` and writes to the database.
3. After the action resolves in the `use:enhance` result callback, the client calls `removeKey()` helpers to clear migrated `vibratone:*` storage keys—only on a 200 response.

Account deletion follows the same pattern: the server action destroys cloud data, then after action resolution the client optionally clears localStorage based on the user's explicit choice in the dialog.

## Dependencies

- **Milestone 21** (Anonymous Aggregate Efficacy and Global Puzzles): provides the running database, the aggregate submission infrastructure, and the privacy controls that the account privacy-settings page builds on. M22 adds new tables to the same database schema introduced by M21's dependency on M20 (Database Foundation). Both M21 and the DB boundary are prerequisites before M22 integration tests can run against real schemas.

## External Dependency Contracts

| Capability                               | Contract needed                                                                                                                                                                                                                                                                                                                    | Owner                                                                                                                  | Stub/mock plan                                                                                                                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Better Auth provider (`better-auth` npm) | `AuthPort` interface: `createSession(userId) → { token, session }`, `validateSession(token) → { user, session } \| nulls`, `refreshSession(token) → { token, session } \| null`, `deleteSession(token) → void`, `deleteAccount(userId) → void`. SvelteKit `hooks.server.ts` integration, `HttpOnly SameSite=Lax` cookie lifecycle. | npm — third-party, not @lostgradient. Decision documented in `docs/auth-provider.md` before M22 implementation begins. | `src/lib/server/auth.fake.ts` — in-memory implementation with injectable clock for expiry testing. Used in all unit and integration tests. Playwright uses real provider via `storageState` fixtures.  |
| `AttemptEvent` type                      | `{ id: string; pitchClass: number; correct: boolean; timestamp: number; [key: string]: unknown }` — stable enough for migration. Full shape defined in `learning/analytics`.                                                                                                                                                       | `learning/analytics` module (built progressively in prior milestones).                                                 | Define a minimal local type in `migration.ts` with a comment noting the canonical source is `learning/analytics`; replace the local definition with a direct import once that module exports the type. |
| `FsrsCard` type                          | `{ id: string; due: string; stability: number; difficulty: number; elapsed_days: number; scheduled_days: number; reps: number; lapses: number; state: number; last_review: string \| null }` — standard ts-fsrs shape.                                                                                                             | `learning/scheduling` module (built in prior milestones).                                                              | Same pattern: local type definition in `migration.ts` with a comment pointing to the canonical source; replace with a direct import once the module ships.                                             |
| `SavedPack` type                         | `{ id: string; name: string; config: Record<string, unknown>; createdAt: string }` — sufficient for migration transfer.                                                                                                                                                                                                            | `learning/protocols` module (built progressively).                                                                     | Same pattern as above.                                                                                                                                                                                 |
| Cinder account/profile UI components     | If Cinder lacks a settings-panel or data-deletion confirmation pattern, file issue against `@lostgradient/cinder` before M22 begins.                                                                                                                                                                                               | @lostgradient/cinder — we own this. File a GitHub issue if the required component is missing.                          | Build plain SvelteKit form components for profile, privacy settings, and delete confirmation as stubs using native `<dialog>`; replace with Cinder components when the issue resolves.                 |

## Acceptance Criteria

**AC-01: Anonymous routes accessible without session**
Playwright test: with no session cookie, navigating to `/`, `/practice`, `/placement`, `/puzzle`, and `/local-export` all return 200 and render the page. Test name: `auth-foundation > anonymous routes accessible without session`.

**AC-02: Account routes redirect unauthenticated**
Playwright test: with no session cookie, navigating to `/account`, `/account/privacy`, `/account/export`, and `/account/delete` each redirect to `/sign-in?returnTo=...`. Test name: `auth-foundation > account routes redirect unauthenticated`.

**AC-03: Sign-up value copy present before confirmation**
Playwright test: the sign-up flow displays the exact approved value-proposition copy before the account creation action is enabled. Test name: `auth-foundation > sign-up copy present before confirmation`.

**AC-04: Local progress intact after migration and sign-out**
Playwright test: after creating an account and completing import, sign out immediately. Confirm localStorage still contains progress records and the learner can complete an AP drill anonymously. Test name: `auth-foundation > local progress intact after migration and sign-out`.

**AC-05: Session expiry during drill preserves in-progress attempt**
Playwright test: simulate session expiry (invalidate token) while a drill prompt is active. Confirm the current attempt completes normally, then a re-auth prompt appears. The learner dismisses the prompt and continues anonymously. No progress is lost. Test name: `auth-foundation > session expiry during drill preserves in-progress attempt`.

**AC-06: Account deletion removes cloud data and lists local remainder**
Playwright test + integration test: after requesting account deletion and confirming, assert zero server-side rows for that `account_id` after the retention window (mocked to zero in tests). The deletion-confirmation dialog must enumerate the localStorage keys that persist after deletion. Test name: `auth-foundation > account deletion removes cloud data and lists local remainder`. The `docs/data-retention.md` file must exist in the repository (asserted by a CI static check).

**AC-07: Sign-out does not clear local progress**
Playwright test: sign in, practice, sign out. Confirm localStorage progress is unchanged and anonymous practice continues. Test name: `auth-foundation > sign-out does not clear local progress`.

**AC-08: Account table schema contains only approved columns**
Integration test: assert the account table schema at M22 ship contains exactly `account_id`, `email`, `created_at`, `deleted_at` — no additional columns. Session table separately contains `session_id`, `account_id`, `token_hash`, `expires_at`. Test name: `auth-foundation > account schema contains only approved columns`.

**AC-09: Auth flows keyboard navigable**
Playwright test: complete sign-in, sign-out dialog, privacy settings, and account deletion using keyboard only (Tab, Enter, Escape). Each focus state must be visible and each action must have an accessible label. Test name: `auth-foundation > auth flows keyboard navigable`.

**AC-10: Auth error states do not affect local progress**
Playwright test: simulate sign-in failure (bad credentials), network failure during sign-in, and network failure during deletion. Confirm: error state announced via `role="alert"`, local progress is unaffected, user can retry or continue anonymously. Test name: `auth-foundation > auth error states do not affect local progress`.

## Test Plan

### Unit tests

**`src/lib/server/auth.test.ts`** (using `auth.fake.ts` against in-memory data)

- `createSession > creates a session record with a future expiresAt`
- `createSession > returns a session token string`
- `validateSession > returns user and session for a valid non-expired token`
- `validateSession > returns nulls for an expired token`
- `validateSession > returns nulls for an unknown token`
- `deleteSession > removes the session record`
- `deleteAccount > removes sessions, attempt events, FSRS cards, saved packs, and account row in a transaction`
- `deleteAccount > on an unknown account ID throws NotFoundError`
- `purgeDeletedAccounts > removes all rows for accounts whose deleted_at is before the given date`
- `purgeDeletedAccounts > does not remove accounts whose deleted_at is after the given date`
- `refreshSession > extends a session expiring within 7 days and returns a new token`
- `refreshSession > returns null for an expired refresh token`

**`src/lib/server/auth.fake.ts` (injectable clock)**

- `fake > an injected past timestamp makes a freshly created session immediately expired`

**`src/lib/server/migration.test.ts`**

- `migrateDrillHistory > transfers AttemptEvent[] with correct userId`
- `migrateDrillHistory > is idempotent: importing the same attempt events twice does not double-count (keyed on event ID)`
- `migrateDrillHistory > rejects payloads with schemaVersion !== current (returns 422-equivalent error)`
- `migrateDrillHistory > rejects payloads with invalid AttemptEvent shape`
- `migrateDrillHistory > migration payload excludes any field that could carry raw audio`
- `migratePreferences > transfers PersistedSettings correctly`
- `migrateSavedPacks > transfers SavedPack[] with correct userId`

**`src/hooks.server.test.ts`** (via mock locals)

- `handle > populates locals.user and locals.session for a valid session cookie`
- `handle > sets locals.user and locals.session to null for a missing cookie`
- `handle > sets locals.user and locals.session to null for an expired token`
- `handle > silently renews a session expiring within 7 days`
- `handle > does not renew a session with more than 7 days remaining`

**`src/routes/(authenticated)/+layout.server.ts` unit test**

- `load > redirects to /sign-in?returnTo=%2Faccount when locals.user is null`
- `load > returns { user } when locals.user is present`

**`src/lib/server/auth-privacy.test.ts`**

- `session audit event > excludes email address from payload`
- `session audit event > excludes IP address from payload`
- `session audit event > includes only account_id, timestamp, and event type`

### Integration tests

Run against the in-memory fake auth adapter with a real in-memory database fixture. Not mocked at the database level.

**`src/lib/server/auth/integration/sign-in.test.ts`**

- `POST /sign-in with valid credentials sets a session cookie and returns 200`
- `POST /sign-in with invalid credentials returns 401 with an accessible error message`
- `POST /sign-out clears the session cookie and returns 200`
- `POST /sign-out when already signed out returns 200 (idempotent)`
- `GET /account after sign-in returns 200`
- `GET /account after sign-out returns 302 to /sign-in`

**`src/lib/server/auth/integration/session-refresh.test.ts`**

- `expired session cookie triggers automatic refresh when refresh token is valid`
- `expired session cookie with expired refresh token redirects to /sign-in`
- `refresh returns a new session cookie with an updated expiry`

**`src/lib/server/auth/integration/account-deletion.test.ts`**

- `DELETE /account/delete sets deleted_at and destroys all sessions for that account_id (account immediately inaccessible)`
- `DELETE /account/delete on an unauthenticated request returns 401`
- `purgeDeletedAccounts with retention window mocked to zero removes all rows for a soft-deleted account (zero rows remain — AC-06)`
- `after soft-deletion, a subsequent sign-in with the same credentials fails`
- `account table schema contains exactly account_id, email, created_at, deleted_at — no additional columns (AC-08)`

**`src/lib/server/auth/integration/anonymous.test.ts`**

- `anonymous AP practice session writes no account row`
- `anonymous AP practice session writes no session row`

### Playwright E2E tests (`e2e/auth.spec.ts`)

Fixtures: `e2e/global-setup.ts` generates `e2e/fixtures/authenticated.json` (signed-in cookie state) and `e2e/fixtures/expired-session.json` (signed-in then clock-advanced past expiry). Anonymous is the default browser context.

**Route guard (AC-01, AC-02)**

- `auth-foundation > anonymous routes accessible without session` — navigates to `/`, `/practice`, `/placement`, `/puzzle`, `/local-export` without session; all return 200
- `auth-foundation > account routes redirect unauthenticated` — navigates to `/account`, `/account/privacy`, `/account/export`, `/account/delete` without session; all redirect to `/sign-in?returnTo=...`
- `route-guard > after sign-in, returnTo redirects to the original destination`

**Sign-in flow**

- `sign-in > visitor can sign in with valid credentials and lands on the account page`
- `sign-in > visitor sees an accessible error announced via aria-live on invalid credentials`
- `auth-foundation > auth error states do not affect local progress` (AC-10)
- `sign-in > sign-in form is keyboard navigable with no mouse (AC-09 partial)`
- `sign-in > sign-in page is usable on phone viewport (375px)`
- `sign-in > sign-in page is usable on tablet viewport (768px)`

**Sign-out flow (AC-07)**

- `auth-foundation > sign-out does not clear local progress`
- `sign-out > sign-out dialog opens and closes with keyboard only`
- `sign-out > sign-out and clear local data removes all vibratone: keys from localStorage`
- `sign-out > sign-out dialog names which data stays in the browser`

**Migration (AC-04)**

- `auth-foundation > local progress intact after migration and sign-out`
- `migration > account creation flow shows explicit import prompt for existing local progress`
- `migration > learner can decline import and local data remains unchanged`
- `migration > learner confirms import and progress is visible in account`
- `migration > import is idempotent: importing same data twice does not double scores`
- `auth-foundation > sign-up copy present before confirmation` (AC-03)
- `migration > account creation flow is usable on phone viewport (375px)`

**Session expiry (AC-05)**

- `auth-foundation > session expiry during drill preserves in-progress attempt`

**Account deletion (AC-06)**

- `auth-foundation > account deletion removes cloud data and lists local remainder`
- `account > deletion requires explicit confirmation step (not one-click)`
- `account > deletion confirmation dialog is keyboard-navigable and focus-trapped (AC-09 partial)`
- `account > after deletion, local practice data (localStorage) is still present`
- `account > after deletion, app falls back to anonymous-local mode automatically`
- `account > deletion flow is usable on phone viewport (375px)`

**Profile and privacy**

- `profile > profile page is keyboard navigable`
- `profile > data export download link is present and labelled accessibly`
- `profile > privacy settings page is usable on phone viewport (375px)`
- `auth-foundation > auth flows keyboard navigable` (AC-09)

**CI static check**

- Assert `docs/data-retention.md` exists (part of AC-06).

## Verification

```
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

Manual smokes:

- Sign in on desktop Chrome and Safari; confirm `HttpOnly SameSite=Lax` session cookie is set.
- Sign in, navigate to `/practice`, complete a drill, sign out; confirm local score is unchanged.
- Attempt to navigate to `/account` without a session in an incognito window; confirm redirect to `/sign-in?returnTo=%2Faccount`.
- Sign in, visit `/account/export`, confirm a downloadable JSON file with the correct `Content-Disposition` header.
- Sign in, navigate to `/account/delete`, complete the two-step deletion; confirm server records are removed and the app operates anonymously.
- Verify all auth surfaces at 375 px viewport width with no horizontal scroll.
- Run a keyboard-only walkthrough of sign-in → practice → sign-out with no mouse.

## Non-Goals

- Do not require accounts for AP practice, relative-pitch, theory, production, daily puzzle, placement test, or local export.
- Do not gate the accountless local export introduced in prior milestones behind an account. Account-level data export is additive—it exports cloud-stored account data separately.
- Do not add paid entitlements or subscription checks—those are M23.
- Do not add cloud sync of FSRS state or preferences—that is M23.
- Do not add teacher or student account types—those are M24.
- Do not add public profiles, leaderboards, or community content.
- Do not perform automatic or silent migration on account creation. Migration is always a deliberate user action with a visible confirmation step.
- Do not add any auth requirement to drill routes after M22 ships.

## Completion Signal

M22 is complete when:

- `bun run check`, `bun run lint`, `bun run test:unit -- --run`, and `bun run test:e2e` all pass.
- All ten acceptance criteria have a corresponding named passing test.
- Anonymous AP practice, placement, daily puzzle, and local export each return 200 with no session cookie in the Playwright suite.
- A signed-in learner can import local progress, verify it appears in the account, sign out, and continue anonymous practice—all in a single Playwright test without progress loss.
- `docs/auth-provider.md` and `docs/data-retention.md` exist in the repository.
- The account table schema integration test asserts exactly four columns.
