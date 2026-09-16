# 18. Accountless Teacher and Assignment Exports

## Outcome

Give teachers a useful classroom trial path before Vibratone has accounts, billing, cloud sync, or a database. A teacher can create an assignment from a custom drill config, distribute it as a share link, collect results from learners on a shared device, and export a CSV—all without creating an account and without any data leaving the device unless the teacher explicitly exports it.

## Product Requirements

- Add assignment packs: a thin envelope around `CustomDrillConfig` (from Milestone 17) with target repetitions, a retention target (0–1 float), an optional due date, an assigner alias, a schema version, and a stable `id`.
- Add a local classroom roster: teacher-named aliases stored in `localStorage`, editable and deletable without a pointing device.
- Support one-device classroom mode: before each session, the learner picks their alias from the roster; results are attributed to that alias. There is no kiosk handoff screen, no session lock, and no auto-advance. This is a software-only alias-selection model.
- Add CSV export of per-learner results: pure client-side `Blob` download, no server involved.
- Add teacher share links that encode the assignment configuration (not the roster, not results) in the URL hash fragment, so the payload never reaches a server log. A learner who receives the link arrives at the alias-selection screen, selects their alias, and completes the assignment drill; results are attributed to the selected alias in the teacher's local roster.
- Add a printable practice plan: a styled `window.print()` view of assignment config and progress summary, accessible at `src/routes/print/[assignmentId]/+page.svelte`.
- Add a claims and evidence page (`/claims`): AP research citations, group-average outcome statistics, individual-variance caveat, and the accountless-assignment privacy boundary statement.
- Never collect unnecessary personal data. Permitted identifiers are teacher-chosen aliases only. No name, email, date of birth, or device fingerprint appears in any type, `localStorage` key, or CSV output.

### Assignment Pack Type (resolved)

```ts
// src/lib/learning/drills/assignment-pack.ts
export type AssignmentConfig = {
	schemaVersion: 1;
	id: string; // crypto.randomUUID()
	createdAt: number; // Date.now()
	assignerAlias: string;
	drillConfig: CustomDrillConfig; // from src/lib/learning/drills/custom-drill.ts
	targetRepetitions: number;
	retentionTarget: number; // 0–1 float, e.g. 0.80
	dueDate: string | null; // ISO 8601 date string or null
};

export type AssignmentPack = AssignmentConfig & {
	roster: string[]; // learner aliases; stored locally, never in the share link
	results: AssignmentResult[]; // accumulated locally
};

export type AssignmentResult = {
	learnerAlias: string;
	drillId: string;
	attempts: number;
	accuracy: number; // 0–1 float
	responseTimeMs: number;
	fsrsState: FSRSCardState; // from M17/M05 — type imported from scheduling/
	weakConcepts: string[]; // pitch-class label list
	completedAt: number; // Date.now()
};

export const ASSIGNMENT_PACKS_KEY = 'vibratone:assignment-packs';
```

`isAssignmentConfig()` and `isAssignmentPack()` type guards follow the `isScore()` / `isPersistedSettings()` / `isCustomDrillConfig()` pattern: validate every field, return `value is T`, no assertion casts.

### Share-Link Transport (resolved)

Teacher assignment share links encode `AssignmentConfig` (never `AssignmentPack`, never the roster, never accumulated results) in the **URL hash fragment** (`#…`), never in a query parameter. Hash fragments are not transmitted in HTTP requests, do not appear in server access logs or `Referer` headers, and are never sent to the server under any adapter. This is a correctness requirement, not a stylistic choice: the invariant "no assignment data written to a server" cannot be upheld with a query parameter under adapter-auto with SSR enabled.

The payload is URL-safe base64-encoded JSON. Maximum encoded size: 2 KB. Exceeding the limit causes `encodeAssignment()` to throw `AssignmentTooLargeError` and the share-link button to be disabled with a visible error.

**Share-link happy path (learner perspective):** A learner receives the link, navigates to the URL, and lands at the alias-selection screen. The landing route decodes the hash fragment client-side and stores the decoded `AssignmentConfig` in `createLearnerState()`. After selecting an alias, the learner is routed to `/learner/[alias]`, which is the single session host for **both** entry paths (share link and one-device classroom). This unification means session-running logic lives in exactly one place.

The entry route (`src/routes/learner/assign/+page.svelte`) decodes the hash, populates learner state, then navigates:

```ts
// src/routes/learner/assign/+page.svelte
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { decodeAssignment } from '$lib/learning/drills/assignment-share-link.ts';
import { getLearnerState } from '$lib/state/learner.svelte.ts';

if (browser) {
	try {
		const config = decodeAssignment(window.location.hash.slice(1));
		getLearnerState().setAssignmentConfig(config);
		// alias picker is shown next; after alias selection, goto('/learner/' + alias)
	} catch {
		// renders recoverable error inline
	}
}
```

The corresponding `src/routes/learner/assign/+page.ts` returns an empty object. `load` does not read the hash (the server never sees it). The rendered page shows a recoverable error when decoding fails or when the decoded `schemaVersion` is unrecognized—no blank page, no unhandled exception. Unknown `drillType` values (from future milestones) render an informational "this assignment type is not yet available" message rather than a 404.

**Session host (`/learner/[alias]`):** Reads the active assignment from `createLearnerState()` (populated by either entry path—one-device picker or share-link decode). Results are attributed to the `[alias]` param via `appendAttemptEventForAlias`. On `endSession()`, `selectedAlias` is set to `null` in learner state and the teacher retrieves the device for the next alias.

### Per-Alias Attempt Attribution (resolved)

`AttemptEvent` (M00 / M05) is **not modified**. Per-alias attribution uses a namespaced localStorage key pattern: `vibratone:attempts:v1:<aliasId>`. Each roster alias has its own isolated log. The non-classroom log key `vibratone:attempts:v1` (no alias suffix) remains unchanged for the AP trainer. Aggregation for cohort reports loads all matching keys.

Two new exports are added alongside the existing ones in `src/lib/learning/drills/attempt-log.ts`:

```ts
export function appendAttemptEventForAlias(aliasId: string, event: AttemptEvent): void;
export function loadAttemptLogForAlias(aliasId: string): AttemptEvent[];
```

### CSV Format (resolved)

- Encoding: UTF-8 with BOM (byte order mark `﻿` prefix) for Excel compatibility.
- Delimiter: comma. Quoting: RFC 4180—wrap any field containing a comma, double-quote, or newline in double-quotes; double any internal double-quote (`"` → `""`).
- Formula-injection guard: any cell whose first character is `=`, `+`, `-`, `@`, TAB, or CR is prefixed with a single quote (`'`) before quoting.
- Exact header row (after BOM): `learnerAlias,drillId,attempts,accuracy,responseTimeMs,fsrsState,weakConcepts`
- `weakConcepts` field: pipe-separated pitch-class label string, e.g. `F#|Bb|D`.
- `fsrsState` field: serialized as compact JSON (`JSON.stringify(result.fsrsState)`).
- `accuracy` field: decimal fraction to four decimal places, e.g. `0.8750`.

### Intra-Milestone Delivery Order

If the milestone runs long, later items defer to a follow-on without breaking the learner outcome.

1. **Assignment pack type + localStorage CRUD + CSV export** (must-have; validates the teacher data hypothesis).
2. **Alias picker + learner session attribution** (must-have; enables one-device classroom use).
3. **Teacher share links + learner share-link landing** (should-have; enables remote assignment distribution).
4. **Claims and evidence page** (should-have; required for AP honesty posture before milestone closes).
5. **Printable practice plan** (defer-last; styled `window.print()` view of assignment config and progress summary).

### Kill Criteria

- If encoding `AssignmentConfig` as a hash fragment exceeds 2 KB (after base64), share links are descoped to a downloadable `.json` config file. The teacher dashboard and CSV export remain fully functional via `localStorage`.
- If any field in the CSV export is found to constitute a direct personal identifier beyond a teacher-chosen alias, that field is removed and the omission is documented on the claims page.

## User Experience Requirements

- A teacher can create an assignment link without creating a teacher or student account.
- A learner can complete an assignment by selecting their alias from a roster on a shared device. No account, email, or real name is required.
- Before each assignment session, the learner picks their alias from a list of aliases the teacher has added. The Start button is disabled until an alias is selected.
- A learner who arrives via a share link lands on the alias-selection screen. After picking an alias and pressing Start, they complete the assignment and results are attributed to their alias.
- A teacher can export results for their own records as a CSV download; the export button is disabled until the teacher acknowledges the privacy disclosure.
- The product states clearly that accountless assignments are local and export-based—not cloud classroom management.
- Privacy boundaries are stated before any export. The `privacy-disclosure` component gates the export button.
- Share links reconstruct the assignment drill configuration from the hash fragment; they encode no roster aliases or accumulated results.
- Unknown drill types (from future milestones) decode gracefully: the share-link landing renders an informational message rather than a broken redirect or 404.

## Data and Analytics Requirements

- CSV export includes exactly: `learnerAlias`, `drillId`, `attempts`, `accuracy`, `responseTimeMs`, `fsrsState`, `weakConcepts`—no additional fields.
- Assignment packs store: `schemaVersion` (1), `id`, `createdAt`, `assignerAlias`, `drillConfig`, `targetRepetitions`, `retentionTarget`, `dueDate`, `roster`, `results`.
- Teacher share links carry only `AssignmentConfig`—no roster aliases, no attempt results.
- Local classroom data stays local unless the teacher explicitly exports it. No HTTP request to any remote origin is made during assignment pack creation, learner session completion, or CSV export.
- Cohort analytics aggregate attempt logs across all alias keys (`vibratone:attempts:v1:<aliasId>`) to surface weak concepts per learner and across the cohort.
- The `ASSIGNMENT_PACKS_KEY` constant (`'vibratone:assignment-packs'`) is defined in `src/lib/learning/drills/assignment-pack.ts` and re-exported from `src/lib/persistence.ts`.

## Accessibility Requirements

- Teacher flows must be fully keyboard navigable: Tab, Space, and Enter alone complete every step—creating an alias, creating an assignment, acknowledging the privacy disclosure, triggering export, and copying the share link. No step requires a mouse.
- Roster aliases must be creatable and deletable without drag-only interactions. Edit via inline text field; delete via button. Alias reordering, if present, must support keyboard-accessible up/down buttons (drag-only reorder is not permitted as the sole mechanism). For MVP, reordering may be omitted; mark it deferred explicitly if absent.
- The share-link copy action announces success via an `aria-live="polite"` region (always in DOM, never conditionally mounted). The region announces "Link copied to clipboard" on success or "Failed to copy — link shown below" on failure; the message clears after 4000 ms.
- The CSV export action announces success via a `role="status"` live region (polite); failure via `role="alert"` (assertive).
- The alias picker on the learner route lists all roster aliases and is navigable by Tab and Space alone.
- The claims page is keyboard navigable; all external links have visible focus indicators.
- All flows render without horizontal scroll or clipped controls at 375 px (phone), 768 px (tablet), and 1280 px (desktop).

## Module and Architecture Targets

All new code lands in the locations below. No directories beyond those named here are introduced. New files in `learning/drills/` sit alongside M17's existing `custom-drill.ts` and `share-link.ts`.

### `src/lib/learning/drills/` (new files, extending existing sub-module)

| File                                                    | Exports / Responsibility                                                                                                                                                                                                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/learning/drills/assignment-pack.ts`            | `AssignmentConfig`, `AssignmentPack`, `AssignmentResult`, `ASSIGNMENT_PACKS_KEY`, `isAssignmentConfig()`, `isAssignmentPack()`, `saveAssignmentPack()`, `loadAssignmentPacks()`, `deleteAssignmentPack()`                                                             |
| `src/lib/learning/drills/assignment-pack.spec.ts`       | Unit tests for save/load/delete, type guard rejection cases, and schema version                                                                                                                                                                                       |
| `src/lib/learning/drills/assignment-share-link.ts`      | `encodeAssignment()`, `decodeAssignment()`, `AssignmentTooLargeError`, `AssignmentSchemaVersionError`, `MalformedAssignmentError` — hash-fragment codec, mirrors M17's `share-link.ts` pattern (base64url JSON, 2 KB cap, typed error classes, `schemaVersion` check) |
| `src/lib/learning/drills/assignment-share-link.spec.ts` | Unit tests for round-trip, size gate, schema version error, malformed input                                                                                                                                                                                           |

### `src/lib/learning/drills/attempt-log.ts` (extension — additive only)

Two new exports alongside the existing `appendAttemptEvent` / `loadAttemptLog`:

```ts
export function appendAttemptEventForAlias(aliasId: string, event: AttemptEvent): void;
export function loadAttemptLogForAlias(aliasId: string): AttemptEvent[];
```

Key pattern: `vibratone:attempts:v1:<aliasId>`. Existing non-classroom key `vibratone:attempts:v1` is unchanged.

New test additions go in `src/lib/learning/drills/attempt-log.spec.ts` (pre-existing file extended).

### `src/lib/learning/analytics/` (new files, extending existing sub-module)

| File                                                | Exports / Responsibility                                                                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/learning/analytics/csv-export.ts`          | `exportAssignmentResultsAsCsv(results: AssignmentResult[]): string` — pure function, UTF-8 BOM + RFC 4180 + formula-injection guard; no npm dependencies                                   |
| `src/lib/learning/analytics/csv-export.spec.ts`     | Unit tests for header row exactness, quoting, formula injection, BOM, pipe-joined weakConcepts                                                                                             |
| `src/lib/learning/analytics/cohort-summary.ts`      | `WeakConceptByAlias`, `CohortSummary`, `buildCohortSummary(roster: string[], threshold?: number): CohortSummary[]` — loads all alias logs, aggregates accuracy per pitch class per learner |
| `src/lib/learning/analytics/cohort-summary.spec.ts` | Unit tests                                                                                                                                                                                 |

### `src/lib/persistence.ts` (extension)

Re-export `ASSIGNMENT_PACKS_KEY` from `src/lib/learning/drills/assignment-pack.ts`.

### `src/lib/state/` (new state factories)

| File                                   | Exports / Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/state/teacher.svelte.ts`      | `createTeacherState()` factory; `[getTeacherState, setTeacherState]` context pair. `$state<AssignmentPack[]>` for packs (loaded via `loadAssignmentPacks()`), `$state<string[]>` for roster aliases, `$state<boolean>` for `privacyAcknowledged`. Actions: `addAlias()`, `removeAlias()`, `saveAssignmentPack()`, `deleteAssignmentPack()`, `acknowledgePrivacy()`, `exportCsv()` (triggers client Blob download, never calls a server). No `$effect` used for persistence—saves are deliberate actions only. |
| `src/lib/state/teacher.svelte.spec.ts` | Unit tests for state factory                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/lib/state/learner.svelte.ts`      | `createLearnerState()` factory; `[getLearnerState, setLearnerState]` context pair. `$state<string \| null>` for `selectedAlias` (session-scoped, not persisted to `localStorage`). Session results accumulator. `selectAlias()`, `endSession()` actions.                                                                                                                                                                                                                                                      |
| `src/lib/state/learner.svelte.spec.ts` | Unit tests for state factory                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

Both follow the `createPracticeState()` + `createContext()` pattern from `src/lib/state.svelte.ts` exactly. `$state.raw` is used for large arrays. Factories are instantiated once in the relevant `+layout.svelte` or `+page.svelte` and distributed via `setContext`.

The active alias is **session-scoped** (`$state` in `createLearnerState()`, never persisted to `localStorage`). On `endSession()`, `selectedAlias` is set to `null`. Alias attempt data is isolated by alias in `localStorage`. No data from alias A appears in alias B's log.

### `src/routes/` (new routes)

| Route                                                  | Purpose                                                                                                                                                                      | Rendering                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `src/routes/teacher/+page.svelte`                      | Teacher dashboard: create assignment, manage roster, view per-learner results, trigger CSV export                                                                            | SSR default                     |
| `src/routes/teacher/+layout.svelte`                    | Provides `TeacherState` via `setTeacherState`; instantiates `createTeacherState()` once                                                                                      | —                               |
| `src/routes/teacher/+page.svelte.test.ts`              | Component tests                                                                                                                                                              | —                               |
| `src/routes/learner/+page.svelte`                      | Alias picker shown before each assignment session on shared device (one-device classroom flow)                                                                               | SSR default                     |
| `src/routes/learner/+page.svelte.test.ts`              | Component tests: alias selection, empty roster state, disabled Start button                                                                                                  | —                               |
| `src/routes/learner/[alias]/+page.svelte`              | Active assignment drill session attributed to the selected alias                                                                                                             | SSR default                     |
| `src/routes/learner/[alias]/+page.svelte.test.ts`      | Component tests                                                                                                                                                              | —                               |
| `src/routes/learner/assign/+page.svelte`               | Share-link landing: decodes `window.location.hash` client-side (guarded by `browser`); presents alias picker then drill session                                              | SSR default; client decode only |
| `src/routes/learner/assign/+page.ts`                   | Universal load: returns `{}`. Does NOT read the hash fragment (server never sees it).                                                                                        | —                               |
| `src/routes/learner/assign/+page.svelte.test.ts`       | Component tests: recoverable error states, schema version error, unknown drillType fallback                                                                                  | —                               |
| `src/routes/claims/+page.svelte`                       | Claims and evidence page: AP research citations, outcome caveats, privacy boundary statement                                                                                 | `export const prerender = true` |
| `src/routes/claims/+page.ts`                           | `export const prerender = true`                                                                                                                                              | —                               |
| `src/routes/claims/+page.svelte.test.ts`               | Component tests: citation text present, caveat text present                                                                                                                  | —                               |
| `src/routes/print/[assignmentId]/+page.svelte`         | Printable practice plan; reads assignment pack from `localStorage` by `assignmentId`; `@media print` CSS. Teacher navigates to this route and uses the browser Print dialog. | SSR default; client read only   |
| `src/routes/print/[assignmentId]/+page.svelte.test.ts` | Component test: renders assignment config, progress summary present                                                                                                          | —                               |

No `+page.server.ts` or `+server.ts` files are introduced. All persistence is `localStorage`-only. CSV export is a client-side `Blob` download. Share links use the URL hash—no server round-trip.

### `src/lib/components/` (new components)

| Component                                           | Props / Responsibility                                                                                                                                                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/alias-roster.svelte`            | `aliases: string[]`, `onadd`, `onedit`, `ondelete` — keyboard navigable; add/edit via inline text field; delete via button; alias `{#each}` keyed on stable alias ID (never array index) to preserve keyboard focus during edits |
| `src/lib/components/assignment-share-action.svelte` | Local stub wrapping `encodeAssignment()` + `navigator.clipboard.writeText()`; `aria-live="polite"` region always in DOM; deleted when Cinder #322 ships. Must pass the same accessibility assertions as the real component.      |
| `src/lib/components/privacy-disclosure.svelte`      | Renders as native `<dialog>` (no modal library). Fires `onacknowledge` callback on user confirmation. Gates the export button until acknowledged.                                                                                |

## Dependencies

- **Milestone 17** (AI Coach and Custom Practice) — provides `CustomDrillConfig`, `isCustomDrillConfig()`, `encodePack()` / `decodePack()` codec patterns (which `assignment-share-link.ts` mirrors), `DrillPackMetadata`, the `share-action.svelte` stub, `FSRSCardState` (via M17's transitive dependency on M05), `AttemptEvent` (same transitive path), and `saveJSON` / `loadJSON` from `src/lib/persistence.ts`. Milestone 05 (Local FSRS and AP Analytics) is the ultimate origin of the persistence and FSRS contracts; it is consumed here transitively through Milestone 17, not as a direct dependency edge.

Acyclicity confirmed: 17 → 18. No forward dependency.

## External Dependency Contracts

| Dependency                                     | Contract                                                                                                                                                                                                                                          | Owning Ticket                                                   | Stub / Mock Plan                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cinder `<ShareAction />`                       | `<ShareAction payload={string} onsuccess={() => void} onfailure={() => void} />` — Web Share API with clipboard fallback and `aria-live` region                                                                                                   | Cinder [#322](https://github.com/stevekinney/cinder/issues/322) | `src/lib/components/assignment-share-action.svelte` — local stub using `navigator.clipboard.writeText(link)` with the same `aria-live="polite"` always-in-DOM pattern. Deleted when #322 ships. The stub must pass identical accessibility assertions (role, live region text timing). |
| `CustomDrillConfig` + share-link codec pattern | `AssignmentConfig.drillConfig` reuses `CustomDrillConfig` exactly from `src/lib/learning/drills/custom-drill.ts`. The `assignment-share-link.ts` codec mirrors M17's `share-link.ts` pattern—but encodes to the hash fragment, not a query param. | Established in Milestone 17 — no new ticket required.           | No stub needed; codec is implemented in this milestone following the M17 pattern.                                                                                                                                                                                                      |
| `FSRSCardState`                                | Type consumed as `AssignmentResult.fsrsState`. Originates in M05, flows through M17.                                                                                                                                                              | Milestone 05 / Milestone 17 — no new ticket required.           | For unit tests: fixture `{ state: 'review', stability: 1, difficulty: 5, due: Date.now(), reps: 3, lapses: 0 }`. Export `stubFSRSState(overrides?)` from `src/lib/testing/fixtures.ts`.                                                                                                |
| `AttemptEvent`                                 | Consumed as-is in the per-alias log. Namespaced key extension is additive—no schema bump.                                                                                                                                                         | Milestone 05 / Milestone 17 — no new ticket required.           | Imported directly; no stub needed.                                                                                                                                                                                                                                                     |

## Acceptance Criteria

Each criterion is a single observable state with a concrete verification method.

**AC-18-01 (Assignment pack round-trip):** Given a teacher creates an `AssignmentPack` via `saveAssignmentPack()`, `loadAssignmentPacks()` returns the same pack with identical field values after re-reading from `localStorage`. Verified by a unit test asserting field-level equality before and after a save/load cycle.

**AC-18-02 (Schema version guard):** Given a hash fragment whose decoded `schemaVersion` is not `1`, the learner share-link landing renders a recoverable error state with a human-readable message—not a blank page or unhandled exception. Verified by a Playwright test navigating to a URL with a synthetically stale `schemaVersion`.

**AC-18-03 (Share-link size gate):** Given an `AssignmentConfig` whose base64-encoded JSON exceeds 2 KB, `encodeAssignment()` throws `AssignmentTooLargeError` and the share-link button is disabled with a visible error message. Verified by a unit test with a synthetically large config and a Playwright test asserting button disabled state.

**AC-18-04 (Share-link round-trip — codec):** Given an `AssignmentConfig`, `encodeAssignment(config)` followed by `decodeAssignment(result)` returns an object deeply equal to the original (roster and results excluded). Verified by unit tests covering at least two config shapes.

**AC-18-05 (Share-link in hash fragment):** Given a teacher copies a share link, the copied URL contains the encoded payload in the hash fragment (`#…`), not in a query string. Verified by a unit test asserting `encodeAssignment()` output contains no `?` character, and a Playwright test asserting the copied URL contains `#` and no `?assignment=` substring.

**AC-18-06 (Share-link happy path — learner flow):** Given a learner navigates to a valid share link, the alias picker is shown. After selecting an alias and pressing Start, the learner can complete the assignment drill and the resulting `AssignmentResult` records the selected alias in `learnerAlias`. Verified by a Playwright test that navigates to a valid share-link URL, selects an alias, completes one drill prompt, and asserts the alias appears in the exported CSV.

**AC-18-07 (Alias selection before session):** Given a local roster with at least two aliases, the learner route renders an alias picker before starting any drill. The Start button is disabled with no alias selected and enabled after selection. Verified by a Playwright test asserting the Start button's `disabled` attribute before and after alias selection.

**AC-18-08 (Result attribution):** Given a learner completes an assignment session after selecting alias "Student A", the resulting `AssignmentResult` records `learnerAlias: 'Student A'`. Verified by a unit test on the result accumulator and a Playwright test asserting the alias appears in the exported CSV.

**AC-18-09 (CSV header exactness):** The first line of a CSV export from `exportAssignmentResultsAsCsv()` (after the BOM prefix bytes) is exactly `learnerAlias,drillId,attempts,accuracy,responseTimeMs,fsrsState,weakConcepts`. Verified by a unit test asserting strict string equality of the header line.

**AC-18-10 (CSV RFC 4180 quoting):** Given an `AssignmentResult` whose `learnerAlias` contains a comma (e.g., `"Smith, J."`), the exported CSV wraps that field in double-quotes per RFC 4180. Verified by a unit test asserting the output string contains `"Smith, J."` in the first data column.

**AC-18-11 (CSV formula-injection guard):** Given an `AssignmentResult` whose `learnerAlias` begins with `=`, the exported CSV prefixes that cell with a single quote so the alias does not execute as a formula in spreadsheet applications. Verified by a unit test asserting the output cell for the alias starts with `'=`.

**AC-18-12 (Privacy disclosure gates export):** The export button on the teacher dashboard is disabled until the teacher interacts with and dismisses the `privacy-disclosure` component. After dismissal, the button becomes enabled. Verified by a Playwright test asserting the button's `disabled` attribute before and after the acknowledgement action.

**AC-18-13 (No server write):** No HTTP request to any non-localhost origin is made during assignment pack creation, learner session completion, or CSV export. Verified by a Playwright test with `page.on('request', ...)` asserting zero non-localhost network requests during those flows.

**AC-18-14 (Claims page content):** The page at `/claims` renders all of the following: the Wong, Cheung, Ngan, and Wong 2025 citation; the phrase "7.08 pitches" (group average outcome); a visible individual-variance caveat; and a statement that accountless assignments are local and not cloud-managed. Verified by a Playwright test asserting each string is present and visible.

**AC-18-15 (No auth, database, billing, or cloud storage required):** All features—assignment creation, learner sessions, CSV export, share links, claims page—function with no network connectivity after the page is loaded. Verified by a Playwright test that throttles network to offline after initial page load and asserts teacher dashboard and export remain functional.

**AC-18-16 (Keyboard-navigable teacher flow):** A keyboard-only user can complete the full teacher flow—open dashboard, create alias, create assignment, acknowledge privacy disclosure, and download CSV—without using a pointing device. Verified by a Playwright test using keyboard-only navigation (Tab, Space, Enter) throughout.

**AC-18-17 (Alias roster keyboard accessibility):** Each alias in the roster can be edited and deleted using Tab, Enter, and Space alone with no mouse required. Verified by a Playwright accessibility assertion on the alias roster component.

**AC-18-18 (Responsive layouts):** The teacher dashboard, alias picker, and share-link landing render without horizontal scroll or clipped controls at 375 px (phone), 768 px (tablet), and 1280 px (desktop). Verified by Playwright responsive smoke tests at each width.

**AC-18-19 (Per-alias log isolation):** Attempt events appended for alias A under key `vibratone:attempts:v1:<aliasId-A>` are not returned by `loadAttemptLogForAlias(aliasId-B)`. Verified by a unit test appending to alias A and asserting alias B's log remains empty.

**AC-18-20 (Printable plan renders):** The route at `/print/[assignmentId]` renders the assignment config (drill type, target repetitions, due date) and an available progress summary from local results. A `@media print` stylesheet is applied. Verified by a Playwright test navigating to the print route with a saved `assignmentId` and asserting the config fields are visible and the page does not throw.

## Test Plan

### Unit tests (`src/lib/learning/drills/assignment-pack.spec.ts`)

- `saveAssignmentPack persists to ASSIGNMENT_PACKS_KEY in localStorage`
- `saveAssignmentPack stored object contains id, schemaVersion, assignerAlias, drillConfig, targetRepetitions, retentionTarget, dueDate, and createdAt`
- `loadAssignmentPacks returns empty array when no packs are saved`
- `loadAssignmentPacks returns all saved packs in creation order`
- `deleteAssignmentPack removes the correct pack and leaves others intact`
- `isAssignmentPack rejects an object missing schemaVersion`
- `isAssignmentPack rejects an object with schemaVersion !== 1`
- `isAssignmentPack rejects an object missing assignerAlias`
- `isAssignmentConfig rejects a config with retentionTarget outside [0, 1]`
- `isAssignmentConfig accepts a config with retentionTarget of exactly 0`
- `isAssignmentConfig accepts a config with retentionTarget of exactly 1`

### Unit tests (`src/lib/learning/drills/assignment-share-link.spec.ts`)

- `encodeAssignment then decodeAssignment round-trips a minimal config`
- `encodeAssignment then decodeAssignment round-trips a config with all fields populated`
- `encodeAssignment output contains no '?' character (hash-fragment transport confirmed)`
- `encodeAssignment throws AssignmentTooLargeError when encoded size exceeds 2 KB`
- `decodeAssignment throws AssignmentSchemaVersionError when schemaVersion is not 1`
- `decodeAssignment throws MalformedAssignmentError when input is not valid base64`
- `decodeAssignment throws MalformedAssignmentError when base64 decodes to non-JSON`

### Unit tests (`src/lib/learning/analytics/csv-export.spec.ts`)

- `exportAssignmentResultsAsCsv output begins with UTF-8 BOM`
- `exportAssignmentResultsAsCsv header row is exactly learnerAlias,drillId,attempts,accuracy,responseTimeMs,fsrsState,weakConcepts`
- `exportAssignmentResultsAsCsv produces one data row per result`
- `exportAssignmentResultsAsCsv RFC 4180 quotes an alias containing a comma`
- `exportAssignmentResultsAsCsv RFC 4180 quotes an alias containing a double-quote, doubling the internal quote`
- `exportAssignmentResultsAsCsv RFC 4180 quotes an alias containing a newline`
- `exportAssignmentResultsAsCsv formula-injection prefix: alias beginning with = is prefixed with single quote`
- `exportAssignmentResultsAsCsv formula-injection prefix: alias beginning with + is prefixed with single quote`
- `exportAssignmentResultsAsCsv joins weakConcepts with a pipe separator`
- `exportAssignmentResultsAsCsv returns only the header row for an empty results array`
- `exportAssignmentResultsAsCsv output is parseable by a standards-compliant CSV parser and round-trips to the input`

### Unit tests (`src/lib/learning/drills/attempt-log.spec.ts` — additions only)

- `appendAttemptEventForAlias writes to vibratone:attempts:v1:<aliasId>`
- `appendAttemptEventForAlias does not write to vibratone:attempts:v1 (the non-classroom key)`
- `loadAttemptLogForAlias reads from vibratone:attempts:v1:<aliasId>`
- `loadAttemptLogForAlias for alias A does not include events appended for alias B`
- `loadAttemptLogForAlias returns empty array when no log exists for the given aliasId`

### Unit tests (`src/lib/learning/analytics/cohort-summary.spec.ts`)

- `buildCohortSummary returns one entry per alias with attempt count`
- `buildCohortSummary correctly aggregates accuracy across multiple attempt events`
- `buildCohortSummary identifies weak concepts as pitch classes below the accuracy threshold`
- `buildCohortSummary returns empty array when no aliases have attempt logs`
- `buildCohortSummary ties in accuracy sort deterministically by pitchClass label`

### Unit tests (`src/lib/state/teacher.svelte.spec.ts`)

- `createTeacherState loads packs from ASSIGNMENT_PACKS_KEY on init`
- `addAlias persists to roster and alias appears in state.roster`
- `removeAlias removes the correct alias and persists the updated roster`
- `saveAssignmentPack persists to ASSIGNMENT_PACKS_KEY and pack appears in state.packs`
- `acknowledgePrivacy sets privacyAcknowledged to true`
- `privacyAcknowledged is false on init`

### Unit tests (`src/lib/state/learner.svelte.spec.ts`)

- `createLearnerState initializes with selectedAlias null`
- `selectAlias sets selectedAlias without persisting to localStorage`
- `endSession sets selectedAlias to null`

### Component tests (`src/routes/teacher/+page.svelte.test.ts`)

- `TeacherDashboard export button is disabled before privacy disclosure is acknowledged`
- `TeacherDashboard export button is enabled after privacy disclosure is acknowledged`
- `TeacherDashboard renders empty state when no assignment packs are saved`
- `TeacherDashboard renders pack name, due date, and learner count for each saved pack`

### Component tests (`src/routes/learner/+page.svelte.test.ts`)

- `AliasPicker renders all roster aliases`
- `AliasPicker Start button is disabled with no alias selected`
- `AliasPicker Start button is enabled after alias selection`

### Component tests (`src/routes/learner/assign/+page.svelte.test.ts`)

- `ShareLinkLanding renders drill from decoded hash config`
- `ShareLinkLanding renders recoverable error when hash decodes to schemaVersion !== 1`
- `ShareLinkLanding renders recoverable error when hash is malformed base64`
- `ShareLinkLanding renders informational message for unknown drillType`

### Component tests (`src/routes/claims/+page.svelte.test.ts`)

- `ClaimsPage renders the Wong Cheung Ngan and Wong 2025 citation text`
- `ClaimsPage renders the 7.08 pitches group-average outcome`
- `ClaimsPage renders individual variance caveat`
- `ClaimsPage renders the accountless-assignment local-only privacy boundary statement`

### Component tests (`src/routes/print/[assignmentId]/+page.svelte.test.ts`)

- `PrintablePlan renders assignment drillType and targetRepetitions`
- `PrintablePlan renders dueDate when present and omits it gracefully when null`
- `PrintablePlan renders a progress summary section`

### Playwright tests (`e2e/teacher.spec.ts`)

- `teacher can create an alias and see it appear in the roster`
- `teacher can delete an alias and it disappears from the roster`
- `teacher share-link copy announces success via aria-live region`
- `teacher share-link URL contains hash fragment and no query string assignment parameter`
- `share-link with config exceeding 2 KB shows disabled button and visible error`
- `export button is disabled before privacy acknowledgement and enabled after`
- `CSV download contains expected header row after export`
- `no HTTP requests to remote origins during assignment creation and export`
- `teacher dashboard — phone (375 px): all controls visible without horizontal scroll`
- `teacher dashboard — tablet (768 px): alias roster and assignment list co-exist without overlap`
- `teacher dashboard — desktop (1280 px): no layout overflow`
- `keyboard-only user completes full teacher flow without mouse`
- `teacher dashboard and CSV export remain functional after network is set offline post-load`

### Playwright tests (`e2e/learner.spec.ts`)

- `alias picker shows all roster aliases`
- `Start button is disabled with no alias selected`
- `Start button is enabled after alias selection`
- `completed session result is attributed to the selected alias`
- `alias picker — phone (375 px): picker list readable without horizontal scroll`
- `alias picker — tablet (768 px): alias names and Start button co-exist without overlap`

### Playwright tests (`e2e/learner-share-link.spec.ts`)

- `learner navigates to a valid share link, selects alias, completes drill, and alias appears in exported CSV`
- `share-link landing with malformed base64 in hash shows recoverable error`
- `share-link landing with stale schemaVersion in hash shows recoverable error`
- `share-link landing with unknown drillType shows informational not-yet-available message`
- `share-link landing — phone (375 px): alias picker and drill controls visible without horizontal scroll`
- `share-link landing — tablet (768 px): drill and alias picker co-exist without overlap`

### Playwright tests (`e2e/claims.spec.ts`)

- `claims page renders citation text for Wong Cheung Ngan and Wong 2025`
- `claims page renders 7.08 pitches group-average outcome text`
- `claims page renders individual variance caveat text`
- `claims page is keyboard navigable`
- `claims page external citation links are present and href matches the expected citation URL (structural assertion, not a live HTTP request)`

### Playwright tests (`e2e/print.spec.ts`)

- `print route renders assignment config fields without error`
- `print route applies @media print stylesheet (print-only elements are present in DOM)`

## Verification

Run the standard gate commands:

```
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

Manual smokes:

- Confirm the copied share link URL contains `#` and no `?assignment=` substring.
- Confirm the teacher dashboard export button remains disabled until the privacy disclosure is dismissed.
- Confirm the CSV file opens correctly in Excel (UTF-8 BOM recognized, no formula execution in alias column).
- Confirm no DevTools network request to a remote origin appears during assignment creation, learner session, or export (check with browser DevTools network panel).
- Confirm the learner Start button is disabled with no alias selected.
- Confirm the claims page is readable at 375 px, 768 px, and 1280 px without horizontal scroll.
- Confirm the assignment creation and alias picker flows are completable with Tab + Enter + Space alone (no mouse).
- Confirm a share link with an unknown `drillType` renders the "assignment type not yet available" message rather than a 404 or unhandled error.
- Confirm the print route at `/print/[assignmentId]` renders without error for a known `assignmentId` in `localStorage`.

## Non-Goals

- Do not require teacher accounts.
- Do not require student accounts.
- Do not add billing, subscriptions, or paid entitlements.
- Do not add a database.
- Do not add LMS integrations. CSV export is not required to conform to any LMS import format; LMS compatibility is deferred to the future Cloud Classroom, Community, and Integrations milestone.
- Do not add cloud classroom sync.
- Do not overclaim AP outcomes in any teacher-facing copy.
- Do not implement kiosk or handoff mode (auto-advance to the next alias after session end).
- Do not allow drag-only alias reordering as the sole reorder mechanism; keyboard-accessible reorder is required if reordering is present. For MVP, alias reordering may be omitted.
- Do not encode roster aliases or accumulated results in share links under any circumstances.
- Do not add `+page.server.ts` or `+server.ts` files; all persistence is `localStorage`-only.

## Completion Signal

This milestone is complete when:

- A teacher can create accountless assignment packs, add learner aliases to a roster, and generate a share link encoded exclusively in the hash fragment.
- A learner who navigates to a share link can select their alias, complete the drill, and have results attributed to that alias, confirmed by the alias appearing in the exported CSV.
- Results can be exported as a RFC 4180-compliant CSV with a UTF-8 BOM and formula-injection guard, gated behind a privacy disclosure.
- The claims page at `/claims` is live, prerendered, and contains the Wong, Cheung, Ngan, and Wong 2025 citation, the "7.08 pitches" group-average outcome, and the accountless-assignment privacy boundary statement.
- All unit tests, component tests, and Playwright specs from the Test Plan are green.
- The standard gate commands (`bun run check`, `bun run lint`, `bun run test:unit -- --run`, `bun run test:e2e`) all pass.
- No network request to a remote origin is made during any teacher or learner flow, as confirmed by the Playwright egress assertion.
