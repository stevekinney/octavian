# 20. Database Foundation

## Outcome

After this milestone, a learner who completes an AP practice session can choose to submit a single-session aggregate snapshot anonymously to a server. The snapshot proves the database boundary with the simplest possible write: five fields derived entirely from state that already exists in `state.svelte.ts`. Every existing local-first flow — AP training, FSRS scheduling, local analytics, local export/import — continues to work whether or not the learner submits, and whether or not the server is reachable.

The longitudinal AP efficacy aggregate (retention curve, cold-test accuracy, response-time change, transfer gap, weeks elapsed), public aggregate reports, daily puzzle global stats, research-mode dataset exports, and abuse-resistant rate limits are milestone 21.

## Product Requirements

- Introduce one submission path: a minimal AP session snapshot consisting of exactly `schema_version`, `attempt_count`, `correct_count`, `eligible_pitch_class_count`, and `submitted_at_utc_day`. No other fields exist on this payload.
- Choose and document the database stack in `docs/decisions/database.md` before implementation begins. This decision record is a hard prerequisite. **Resolved choice:** Bun.SQL backed by a SQLite file for local development and test, and a serverless Postgres provider (e.g., Neon) for staging and production. The same `src/lib/server/db.ts` interface abstracts both; `DATABASE_URL` in `$env/static/private` selects the target.
- Add server-side validation for every inbound write: allowlist check (extra fields → 400), size cap (payload over 4 KB → 413), schema-version check (missing or mismatched → 400), required-field check (any missing field → 400).
- Add origin validation in `src/hooks.server.ts` for all `POST /api/*` requests — `+server.ts` endpoints do not receive automatic CSRF protection from SvelteKit.
- Add a consent surface that shows every transmitted field by name before the first write and requires an explicit affirmative action.
- Add an opt-in toggle in settings that persists the learner's choice across reloads. The choice is three-state: `'unasked'`, `'granted'`, `'declined'`.
- Ensure the app, all existing local-first flows, and the daily practice loop are fully functional when the submission endpoint returns a 5xx response or is disabled via the `DISABLE_DB=true` environment variable.
- Physically isolate the database client so it is never imported outside `src/lib/server/` or `src/routes/api/**/*server.ts`. Enforce this boundary with an ESLint `no-restricted-imports` rule.
- Document retention: anonymous session-aggregate rows are eligible for automated bulk deletion 18 months after insertion. Document the mechanism in `docs/operations/retention.md`. Per-row deletion triggered by the learner is not supported because no identifier links a row to a browser or user.
- Document the anonymity and deletion model in `docs/privacy.md` before the consent surface is considered shippable. The copy must not imply per-user deletion is available.
- Keep a separate `audit_events` table for operational events (`submission_accepted`, `submission_rejected`, `schema_version_mismatch`). Audit rows hold no learning-outcome payload fields. Retain audit rows for 90 days.

## User Experience Requirements

- The app must clearly explain what leaves the device before any write occurs. The consent surface names every field that will be transmitted.
- A learner can decline and continue the full AP practice flow without error or degraded UX.
- A learner can change their mind by toggling the opt-in setting at any time. The setting persists across page reloads. Toggling off prevents all future writes; it does not delete local practice history, session scores, or FSRS card state.
- Database outages must not interrupt, block, or degrade local AP practice, FSRS card review, local analytics, or local export/import. A non-blocking `role="status"` banner communicates a submission failure; it disappears after 8 seconds or on user action and never pauses the drill loop.
- The banner message when the server is unavailable: "Could not reach the server. Your practice continues locally."

## Data and Analytics Requirements

- The session aggregate payload is defined by an **allowlist**, not a denylist. The allowlist contains exactly these fields and no others:

  | Field                        | Type     | Description                                                                                                         |
  | ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
  | `schema_version`             | `number` | Integer constant matching `SUBMISSION_SCHEMA_VERSION` in `src/lib/server/submission-schema.ts` (initial value: `1`) |
  | `attempt_count`              | `number` | Integer — total attempts in the session (`session.total` from `Score`)                                              |
  | `correct_count`              | `number` | Integer — correct answers in the session (`session.correct` from `Score`)                                           |
  | `eligible_pitch_class_count` | `number` | Integer 1–12 — how many pitch classes were active during the session                                                |
  | `submitted_at_utc_day`       | `string` | UTC date only (`YYYY-MM-DD`); no time, no timezone offset                                                           |

- Anonymous session aggregates exclude: raw microphone audio, note-by-note attempt history, FSRS card state, session identifiers, IP address, user agent, device fingerprint, per-install identifier, and any field not in the allowlist above.
- The server stores `schema_version` verbatim. If the received value does not equal `SUBMISSION_SCHEMA_VERSION`, the server returns 400 — no silent coercion.
- Audit events and session aggregates live in separate tables with separate retention schedules.
- The `eligible_pitch_class_count` field never reveals which specific pitch classes were trained — only the count. This preserves anonymity while still being meaningful for aggregate analysis.

## Accessibility Requirements

- The consent surface, the opt-in toggle in settings, and all error and unavailable states are keyboard-navigable and produce appropriate ARIA announcements.
- The consent dialog uses `<dialog>` with `aria-modal="true"`, `role="dialog"`, and `aria-labelledby` pointing to its heading. Focus is trapped inside the dialog when open and returned to the triggering element on close.
- The submission status banner uses `role="status"` and `aria-live="polite"`. A critical server error (5xx) uses `role="alert"` and `aria-live="assertive"`.
- The opt-in toggle is operable with the keyboard (Space/Enter) and carries an accessible label describing what will be shared.
- A Playwright accessibility test covers the consent surface, the status banner, and the opt-in toggle.
- All interactive elements in the consent and settings flows must meet WCAG 2.1 AA contrast at phone width (375 px).

## Module and Architecture Targets

| Path                                                               | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/db.ts`                                             | Bun.SQL/Postgres client singleton. Reads `DATABASE_URL` from `$env/static/private`. Never imported outside `src/lib/server/` or `+server.ts` route files. Exported interface: `insert(table, values)`, `query(sql, params)`.                                                                                                                                                                                                                                                                                                    |
| `src/lib/server/submission-schema.ts`                              | Exports `SUBMISSION_SCHEMA_VERSION = 1`, `MAX_SUBMISSION_BYTES = 4096`, the `SessionAggregate` type, and the `isSessionAggregate(value: unknown): value is SessionAggregate` manual type-guard (matching the project's existing guard pattern from `persistence.ts`).                                                                                                                                                                                                                                                           |
| `src/lib/server/submission-validator.ts`                           | `validateSubmission(raw: unknown): ValidationResult` — runs allowlist check, size check, schema-version check, and required-field check in that order. Returns `{ ok: true, data: SessionAggregate }` or `{ ok: false, status: 400 \| 413, error: string, field?: string }`.                                                                                                                                                                                                                                                    |
| `src/lib/server/submission-service.ts`                             | `submitSession(payload: SessionAggregate): Promise<void>` — writes validated rows. Short-circuits when `DISABLE_DB` env var is set to `"true"`. Never called directly from client code.                                                                                                                                                                                                                                                                                                                                         |
| `src/lib/server/audit-service.ts`                                  | `logAuditEvent(type: AuditEventType, payload: Record<string, unknown>): Promise<void>` — writes to `audit_events`. Called from the `+server.ts` handler on accept and reject. Payload holds the field name on rejection, never the field value.                                                                                                                                                                                                                                                                                 |
| `src/routes/api/submissions/+server.ts`                            | `POST` handler. Validates origin (via `hooks.server.ts`), validates body with `submission-validator.ts`, returns 400/413 on failure, calls `submission-service.ts` and `audit-service.ts` on success, returns 201. Returns 503 with `{ error: 'service unavailable' }` when the DB throws.                                                                                                                                                                                                                                      |
| `src/hooks.server.ts`                                              | `handle` hook that rejects non-GET requests to `/api/*` where `Origin` does not match `event.url.origin` (returns 403). `handleError` logs full error server-side, returns typed `App.Error` with no stack trace or SQL text to the client.                                                                                                                                                                                                                                                                                     |
| `src/app.d.ts`                                                     | Extended with `App.Locals { auditRequestId: string }` and `App.Error { message: string; requestId?: string }`.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/lib/submission-consent.svelte.ts`                             | `createConsentState()` factory following the `createPracticeState()` pattern: Svelte 5 runes, distributed via `createContext`, persists to localStorage under key `vibratone:submission-consent` using `loadJSON`/`saveJSON`/`localStorageOrNull` from `persistence.ts`. Returns `{ consent: ConsentState, grantConsent(), declineConsent(), submissionStatus, lastError, submitSession(score, eligibleCount) }`. No import from `src/lib/server/`. `submitSession` is fire-and-forget; calls `fetch('/api/submissions', ...)`. |
| `src/lib/components/submission-consent.svelte` + `.svelte.test.ts` | Native `<dialog>` opt-in modal. Props: `open: boolean; onConsent: (granted: boolean) => void`. Shows the allowlisted fields, requires explicit action (button press), traps focus, announces via `aria-modal="true"` and `aria-labelledby`. Escape closes as decline (`onConsent(false)`). SSR default: banner visible (treat consent as unknown until `onMount` reads localStorage).                                                                                                                                           |
| `src/lib/components/submission-status.svelte` + `.svelte.test.ts`  | Non-blocking status banner. `role="status"` / `aria-live="polite"` for soft failures; `role="alert"` / `aria-live="assertive"` for 5xx. Auto-dismisses after 8 s. Never interrupts drill loop.                                                                                                                                                                                                                                                                                                                                  |
| `src/routes/settings/+page.svelte`                                 | Gains the opt-in toggle wired to `createConsentState()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `migrations/0001_session_aggregates.sql`                           | Creates `session_aggregates` table: `id serial primary key`, `schema_version integer not null`, `attempt_count integer not null`, `correct_count integer not null`, `eligible_pitch_class_count integer not null`, `submitted_at_utc_day date not null`, `created_at timestamptz default now()`.                                                                                                                                                                                                                                |
| `migrations/0002_audit_events.sql`                                 | Creates `audit_events` table: `id serial primary key`, `event_type text not null`, `occurred_at timestamptz default now()`, `detail jsonb`.                                                                                                                                                                                                                                                                                                                                                                                     |
| `docs/decisions/database.md`                                       | Technology decision record (prerequisite — must exist before implementation sprint begins).                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `docs/privacy.md`                                                  | Anonymous submission model, non-reversibility, 18-month bulk retention purge.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `docs/operations/retention.md`                                     | 18-month retention window for `session_aggregates`, 90-day window for `audit_events`, documented `bun run db:prune` script, staging verification steps.                                                                                                                                                                                                                                                                                                                                                                         |

**Type contracts:**

```typescript
// src/lib/server/submission-schema.ts

export const SUBMISSION_SCHEMA_VERSION = 1;
export const MAX_SUBMISSION_BYTES = 4096;

export type ConsentState = 'unasked' | 'granted' | 'declined';

export type AuditEventType =
	'submission_accepted' | 'submission_rejected' | 'schema_version_mismatch';

export type SessionAggregate = {
	schema_version: number;
	attempt_count: number;
	correct_count: number;
	eligible_pitch_class_count: number;
	submitted_at_utc_day: string;
};

export type ApiError = {
	error: string;
	field?: string;
};

export function isSessionAggregate(value: unknown): value is SessionAggregate {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		v.schema_version === SUBMISSION_SCHEMA_VERSION &&
		typeof v.attempt_count === 'number' &&
		Number.isInteger(v.attempt_count) &&
		typeof v.correct_count === 'number' &&
		Number.isInteger(v.correct_count) &&
		typeof v.eligible_pitch_class_count === 'number' &&
		Number.isInteger(v.eligible_pitch_class_count) &&
		v.eligible_pitch_class_count >= 1 &&
		v.eligible_pitch_class_count <= 12 &&
		typeof v.submitted_at_utc_day === 'string' &&
		/^\d{4}-\d{2}-\d{2}$/.test(v.submitted_at_utc_day)
	);
}
```

**SvelteKit boundary invariant:** `src/lib/server/db.ts` imports `$env/static/private`. SvelteKit's module guard prevents any client-loadable file from importing anything under `src/lib/server/`. The `submitSession` function in `submission-consent.svelte.ts` calls `fetch('/api/submissions', ...)` — it never imports from `src/lib/server/` directly.

**No prerender on affected routes:** `src/routes/api/submissions/+server.ts` and any routes under `src/routes/settings/` must not carry `export const prerender = true`. Verify with `bun run check`.

## Dependencies

- **Milestone 19** (Unified Today Surface and Launch Documentation): the suite predecessor. All local-first practice flows, FSRS scheduling state, local analytics, local export/import, and the session `Score` type (from `scoring.ts`) are available through the 19→18→...→00 chain. The `loadJSON`, `saveJSON`, and `localStorageOrNull` helpers from `src/lib/persistence.ts` exist today and require no new milestone work.
- **`docs/decisions/database.md`**: must exist and record the chosen DB provider, driver, local-dev setup, staging/production plan, and credential management before the implementation sprint begins. This is a prerequisite gate, not a deliverable deliverable alongside the code.

The original source file referenced "Milestone 12 Production Track and Suite Integration" and "milestone 02 (local export/import)" using the pre-renumbering scheme. Those map to canonical milestones 19 and 05 respectively. Milestone 05's export/import infrastructure is inherited through the 19→...→05 chain and is not listed as a separate formal dependency.

## External Dependency Contracts

| Capability                                                               | Owner                                                                                                                                  | Contract                                                                                                                                                                                                                                | Stub/Mock Plan                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Serverless Postgres provider** (e.g., Neon `@neondatabase/serverless`) | npm — no upstream issue needed. Canonical choice: Neon with the HTTP-based serverless driver compatible with edge/serverless adapters. | Used only inside `src/lib/server/db.ts`. Connection string from `DATABASE_URL` in `$env/static/private`. Must provide `sql` tagged-template or parameterized-query API. Must not require a persistent TCP pool (serverless constraint). | Unit tests mock `src/lib/server/db.ts` entirely — the mock returns `{ id: 1 }` on insert and `[]` on query. Integration tests use Bun.SQL backed by a fresh SQLite tmp file (`/tmp/vibratone-test-${Date.now()}.db`) created in `beforeEach` and deleted in `afterEach`. No live Neon connection in CI. |
| **Bun.SQL (built-in)**                                                   | Bun runtime — no external package                                                                                                      | Used in development and test as the local SQLite driver. Same query interface abstracted behind `src/lib/server/db.ts`.                                                                                                                 | Already available — no stub needed for local development.                                                                                                                                                                                                                                               |
| **SvelteKit `+server.ts` handlers**                                      | SvelteKit (built into the project) — no external ticket                                                                                | `POST /api/submissions` returns 201/400/413/503 with `ApiError` body on non-201. `handle` hook in `hooks.server.ts` enforces origin check before handler runs.                                                                          | n/a                                                                                                                                                                                                                                                                                                     |
| **`vibratone:submission-consent` localStorage key**                      | Internal — no external ticket                                                                                                          | Written and read by `src/lib/submission-consent.svelte.ts` using existing `loadJSON`/`saveJSON`/`localStorageOrNull` helpers. Key namespace matches project convention.                                                                 | Tests use existing jsdom localStorage mock pattern from `persistence.spec.ts`.                                                                                                                                                                                                                          |

No Octavian or Cinder issues are required for this milestone. The submission schema and validator are pure server-side TypeScript with no dependency on any upstream subpath export.

## Acceptance Criteria

Each criterion is a concrete pass/fail check. The named test(s) that cover it are listed in brackets.

**Scope boundary**

1. The only live submission path is the AP session aggregate. No daily-puzzle aggregate, no AP efficacy curve, no public report, and no global stats page is built in this milestone. [Covered by the non-goals and the allowlist unit test: `submission-validator rejects payload with unlisted field`]

**Consent surface**

2. A consent surface appears before any write. It lists every field that will be transmitted (as named in the allowlist above), requires an explicit affirmative action (button press), and makes no network call without it. [`e2e: consent surface — no HTTP write fires without affirmative action`]

3. Pressing Escape on the consent dialog counts as declining (`onConsent(false)`). No write fires. [`submission-consent.svelte.test.ts: pressing Escape closes dialog and emits onConsent(false)`]

**Payload validation**

4. The server rejects any payload containing a field not in the allowlist with a 400 response. [`submission-validator rejects payload with unlisted field`; `POST /api/submissions with extra field returns 400`]

5. The server rejects any payload exceeding `MAX_SUBMISSION_BYTES` (4 096 bytes) with a 413 response. [`submission-validator rejects payload over MAX_SUBMISSION_BYTES`; `POST /api/submissions with oversized payload returns 413`]

6. The server rejects a payload missing `schema_version` with a 400 response. [`submission-validator rejects payload missing schema_version`; `POST /api/submissions missing schema_version returns 400`]

7. The server rejects a payload where `schema_version` does not equal `SUBMISSION_SCHEMA_VERSION` with a 400 response. [`submission-validator rejects payload with wrong schema_version`]

8. The server rejects a payload missing any other required field with a 400 response. [`submission-validator rejects payload missing required field — each field separately`]

**Opt-in and reversibility**

9. No write reaches the database endpoint unless the learner has taken the explicit consent action in the current session. [`submission-consent.svelte.ts: submitSession is no-op when consent !== 'granted'`; `e2e: no HTTP write fires before affirmative consent action`]

10. A learner can disable future submissions by setting the toggle to `'declined'`. A Playwright test sets the toggle to declined, completes a practice round, and asserts no HTTP write occurs. [`e2e: opt-in toggle declined — no HTTP write fires after practice round`]

11. Toggling off does not delete or mutate local session score, FSRS card state, or practice history. [`submission-consent.svelte.ts: declineConsent does not mutate local Score state`]

12. The consent state (`'unasked'` | `'granted'` | `'declined'`) persists to localStorage under `vibratone:submission-consent` and survives page reload. [`submission-consent.svelte.ts: grantConsent persists 'granted' to localStorage`; `e2e: opt-in toggle state survives page reload`]

**Schema versioning**

13. Every write payload includes `schema_version` equal to `SUBMISSION_SCHEMA_VERSION` exported from `src/lib/server/submission-schema.ts`. [`submission-schema: SUBMISSION_SCHEMA_VERSION constant is present and equals 1`]

14. A CI check confirms the constant value matches the migration file version. [`submission-schema: SUBMISSION_SCHEMA_VERSION matches 0001_session_aggregates.sql schema_version column expectation`]

**Local-first fallback**

15. AP practice sessions, FSRS card review, local analytics, local export/import, and session scoring all function normally when `POST /api/submissions` returns 503. A Playwright test simulates a 503 and confirms the practice flow completes, local score increments, no error blocks the UI, and no local storage state is mutated. [`e2e: server 503 — local practice round completes, local score unchanged, no blocking error`]

16. The submission service short-circuits to a no-op when `DISABLE_DB=true` is set in the environment. [`submission-service: short-circuits when DISABLE_DB is set`]

**Physical isolation**

17. No import of `src/lib/server/db.ts`, `submission-schema.ts`, `submission-service.ts`, or `audit-service.ts` exists in `src/lib/audio.ts`, `learning/drills`, `learning/scheduling`, `learning/analytics`, `learning/protocols`, or any client-loadable `.svelte.ts` file. An ESLint `no-restricted-imports` rule enforces this; a dry-run test asserts non-zero exit when a fixture file violates it. [`db-isolation: ESLint rule — file in src/lib/server/ importing audio.ts exits non-zero`; `db-isolation: ESLint rule — audio.ts importing src/lib/server/ exits non-zero`]

**Privacy documentation**

18. `docs/privacy.md` states that anonymous submissions are not individually reversible after transmission and that rows are deleted in bulk after 18 months. It does not imply per-user deletion is available. [Doc review as part of completion signal]

19. `docs/operations/retention.md` documents the 18-month retention window, 90-day audit-events window, `bun run db:prune` mechanism, and staging verification steps. [Doc review as part of completion signal]

**Accessibility**

20. The consent surface, opt-in toggle, and status banner are keyboard-navigable. The consent dialog traps focus. The toggle is operable via Space/Enter. [`e2e: consent surface — keyboard only — affirmative action reachable and activatable`; `e2e: opt-in toggle — Space toggles state`]

21. The consent dialog announces its state via `aria-modal="true"` and `aria-labelledby`. The status banner uses `role="status"` / `aria-live="polite"`. [`submission-consent.svelte.test.ts: renders with role="dialog" and aria-modal="true"`; `submission-status.svelte.test.ts: aria-live region present in DOM`]

**Origin guard**

22. A non-GET request to `/api/submissions` with a mismatched `Origin` header returns 403 before the handler is reached. [`POST /api/submissions with mismatched Origin returns 403`]

## Test Plan

### Unit tests — `src/lib/server/`

**`src/lib/server/submission-validator.spec.ts`** (AC 4–8)

- `submission-validator rejects payload with unlisted field` — adds `extra_field: 'x'` to otherwise-valid payload; asserts `{ ok: false, status: 400 }`
- `submission-validator rejects payload over MAX_SUBMISSION_BYTES` — sends a JSON string of length 4097; asserts `{ ok: false, status: 413 }`
- `submission-validator rejects payload at exactly MAX_SUBMISSION_BYTES + 1` — boundary case; asserts 413
- `submission-validator accepts payload at exactly MAX_SUBMISSION_BYTES` — boundary case; asserts `{ ok: true }`
- `submission-validator rejects payload missing schema_version` — asserts `{ ok: false, status: 400, field: 'schema_version' }`
- `submission-validator rejects payload with wrong schema_version` — sends `schema_version: 0`; asserts 400
- `submission-validator rejects payload missing attempt_count` — asserts 400
- `submission-validator rejects payload missing correct_count` — asserts 400
- `submission-validator rejects payload missing eligible_pitch_class_count` — asserts 400
- `submission-validator rejects payload missing submitted_at_utc_day` — asserts 400
- `submission-validator accepts a well-formed payload` — sends all five fields; asserts `{ ok: true, data: SessionAggregate }`

**`src/lib/server/submission-schema.spec.ts`** (AC 13–14)

- `SUBMISSION_SCHEMA_VERSION is 1`
- `MAX_SUBMISSION_BYTES is 4096`
- `isSessionAggregate returns true for a valid payload`
- `isSessionAggregate rejects missing schema_version`
- `isSessionAggregate rejects schema_version !== SUBMISSION_SCHEMA_VERSION`
- `isSessionAggregate rejects eligible_pitch_class_count outside 1–12`
- `isSessionAggregate rejects non-date-format submitted_at_utc_day`
- `SUBMISSION_SCHEMA_VERSION matches the integer in 0001_session_aggregates.sql` — reads migration file and asserts the constant matches

**`src/lib/server/submission-service.spec.ts`** (AC 9, 16)

- `submission-service short-circuits when DISABLE_DB is set` — sets `process.env.DISABLE_DB = 'true'`, mocks `db.insert`, calls `submitSession`, asserts `db.insert` never called
- `submission-service calls db.insert with validated payload when DISABLE_DB is unset` — mocks `db.insert` to return `{ id: 1 }`, asserts it is called with the correct shape

**`src/lib/server/db-isolation.spec.ts`** (AC 17)

- `ESLint no-restricted-imports rule — fixture file in src/lib/server/ importing audio.ts exits non-zero` — runs `eslint --no-eslintrc -c <fixture-config> <fixture-file>` in child process, asserts exit code > 0
- `ESLint no-restricted-imports rule — fixture file audio.ts importing src/lib/server/db exits non-zero`
- `ESLint no-restricted-imports rule — fixture file in learning/drills importing src/lib/server exits non-zero`
- `ESLint no-restricted-imports rule — compliant server file exits zero`

### Unit tests — `src/lib/`

**`src/lib/submission-consent.svelte.spec.ts`** (AC 9–12)

- `createConsentState initializes to "unasked" when localStorage is empty`
- `createConsentState reads persisted consent from localStorage on init`
- `grantConsent sets consent to "granted" and persists to localStorage`
- `declineConsent sets consent to "declined" and persists to localStorage`
- `submitSession is no-op when consent is "unasked"`
- `submitSession is no-op when consent is "declined"`
- `submitSession calls fetch when consent is "granted"`
- `submitSession sets submissionStatus to "error" on fetch rejection`
- `submitSession sets submissionStatus to "error" when server returns 400`
- `submitSession sets submissionStatus to "success" on 201`
- `declineConsent does not mutate Score state` — verifies a mock Score object is untouched after `declineConsent()`

### Component tests — `src/lib/components/`

**`src/lib/components/submission-consent.svelte.test.ts`** (AC 2–3, 20–21)

- `renders with role="dialog" and aria-modal="true" when open`
- `heading is referenced by aria-labelledby`
- `Accept button is reachable by Tab from open state`
- `Decline button is reachable by Tab within dialog boundary`
- `pressing Escape closes dialog and emits onConsent(false)`
- `clicking Accept emits onConsent(true)`
- `clicking Decline emits onConsent(false)`
- `focus trap: Tab does not leave dialog boundary`
- `SSR default: renders banner visible when mounted is false`
- `hides banner after onConsent(true) is received and consent persists`

**`src/lib/components/submission-status.svelte.test.ts`** (AC 21)

- `renders nothing when submissionStatus is "idle"`
- `renders visible message when submissionStatus is "error"`
- `error message is inside element with role="status" and aria-live="polite"`
- `renders assertive region with role="alert" when server returns 5xx`
- `banner does not prevent keyboard access to elements beneath it`
- `banner auto-dismisses after 8 seconds (fake timers)`

### API handler tests — `src/routes/api/submissions/`

**`src/routes/api/submissions/+server.spec.ts`** (AC 4–8, 22)

- `POST with valid payload and matching Origin returns 201`
- `POST with mismatched Origin returns 403`
- `POST with extra field returns 400`
- `POST with oversized payload returns 413`
- `POST missing schema_version returns 400 with field`
- `POST with wrong schema_version returns 400`
- `POST missing required field returns 400 (each field tested separately)`
- `POST when db.insert throws returns 503 with ApiError body`
- `POST creates an audit_events row on accept`
- `POST creates an audit_events row with event_type "submission_rejected" on validation failure`

### Integration tests — `src/lib/server/`

Use Bun.SQL backed by a fresh SQLite tmp file per test. Created in `beforeEach`, deleted in `afterEach`. Never mock the database in integration tests.

**`src/lib/server/db-integration.spec.ts`** (AC 4–8, 14–15)

- `insert valid SessionAggregate returns row with id and created_at`
- `reading back inserted row returns all five payload fields with no additional fields` — `Object.keys(row).sort()` matches allowlist
- `two sessions inserted for same utc_day both persist — no deduplication at insert time`
- `insert with schema_version mismatch throws validation error before DB write`
- `audit_events table row created on successful insert`
- `audit_events row does not contain attempt_count or correct_count` — separation check
- `rows inserted with created_at older than 18 months are returned by retention query`

### Playwright e2e — `e2e/database-foundation.spec.ts`

All server-outage simulation uses `page.route('/api/submissions', route => route.fulfill({ status: 503 }))`.

**Consent flow** (AC 2–3, 9–10, 12)

- `consent surface — appears before any write on first visit`
- `consent surface — no HTTP POST fires on page load before consent action`
- `consent surface — no HTTP POST fires during a complete practice round before consent action`
- `consent surface — Accept button grants consent, hides surface, persists across reload`
- `consent surface — Decline button keeps practice functional, no HTTP POST fires`
- `consent surface — no HTTP write fires without affirmative action`

**Opt-in toggle** (AC 10–12)

- `opt-in toggle declined — no HTTP write fires after practice round`
- `opt-in toggle state survives page reload (granted stays granted)`
- `opt-in toggle state survives page reload (declined stays declined)`

**Local-first fallback** (AC 15)

- `server 503 — local practice round completes, local score unchanged`
- `server 503 — no UI blocking error interrupts drill`
- `server 503 — status banner becomes visible and accessible`
- `server recovers (201) — status banner removed`

**Accessibility — keyboard only** (AC 20–21)

- `consent surface — Tab cycles through interactive elements without leaving dialog`
- `consent surface — Escape closes dialog without consent`
- `consent surface — Enter on Accept button grants consent`
- `opt-in toggle — Space toggles state`
- `status banner for DB unavailable — aria-live region text appears on failure`

**Responsive smoke** (AC 20)

- `phone (375×667) — consent dialog fully visible and scrollable, buttons reachable`
- `tablet (768×1024) — opt-in toggle visible in settings without horizontal scroll`
- `desktop (1280×800) — consent dialog and status banner lay out without overflow`

## Verification

```sh
bun run check           # TypeScript and SvelteKit type check; no prerender violations
bun run lint            # ESLint including no-restricted-imports rule for server boundary
bun run test:unit --run # All unit and integration tests (server + component projects)
bun run test:e2e        # All Playwright specs
```

Manual smokes:

- Complete a practice round with consent granted → confirm 201 in browser devtools Network tab.
- Complete a practice round with the toggle set to declined → confirm no request to `/api/submissions` appears.
- Kill the dev DB connection (`DISABLE_DB=true bun run dev`) → confirm practice, scoring, and export all work normally; status banner appears and dismisses.
- Confirm `docs/decisions/database.md`, `docs/privacy.md`, and `docs/operations/retention.md` exist and are non-placeholder.
- Run `bun run check` and confirm no route carries `export const prerender = true` in the `api/submissions` subtree.

## Non-Goals

- Do not add auth.
- Do not add cloud sync.
- Do not add paid entitlements.
- Do not add teacher or student accounts.
- Do not store raw microphone audio or direct personal identifiers.
- Do not build the public aggregate AP efficacy report view — that belongs to milestone 21.
- Do not add the daily-puzzle aggregate submission path — daily puzzle global stats belong to milestone 21.
- Do not implement the longitudinal AP efficacy aggregate (retention curve, cold-test accuracy, response-time change, transfer gap, training weeks elapsed) — those belong to milestone 21.
- Do not build the research-mode anonymized dataset export — milestone 21.
- Do not add abuse-resistant rate limiting beyond payload-size and schema validation — full rate-limit strategy belongs to milestone 21.
- Do not implement individual per-user data deletion triggered from the UI — anonymous submissions carry no identifier and are not individually reversible after transmission.
- Do not gate any local-first feature on database write success.
- Do not introduce a per-install or per-session UUID — no identifier links a row to a browser or user.

## Completion Signal

This milestone is complete when:

- `bun run check`, `bun run lint`, `bun run test:unit --run`, and `bun run test:e2e` all pass green.
- A learner who grants consent and completes an AP practice round sees a 201 response in devtools with no PII in the payload.
- A learner who declines or has not consented completes the same round with zero HTTP writes.
- AP practice, FSRS card review, local scoring, local analytics, and local export all function normally with `DISABLE_DB=true`.
- `docs/decisions/database.md`, `docs/privacy.md`, and `docs/operations/retention.md` exist, are non-placeholder, and are reviewed as part of the milestone sign-off.
- The ESLint `no-restricted-imports` rule is committed to `eslint.config.js` and CI passes with it active.
