# 21. Anonymous Aggregate Efficacy and Global Puzzles

## Outcome

A prospective learner who has not yet committed to the AP program can see credible, sample-sized, variance-honest aggregate proof that the program produces measurable results—without any account required to view it. Daily puzzle global stats reinforce the social proof loop the product needs to grow. Neither feature gates or modifies local-first practice for existing learners.

## Product Requirements

- Add opt-in anonymous aggregate efficacy submission. Submission fires once per completed program block per device (e.g., after the learner satisfies the final-mastery gate for the 12-pitch AP block). A single device generates at most one submission per completed block regardless of how many sessions it took. Periodic background sync and session-end triggers are out of scope.
- Capture the following fields in the submission payload: `schemaVersion`, `windowStart`, `windowEnd`, `protocol` settings (track, research mode, timbres, octave range), `coldTestAccuracy`, `responseTimeDeltaMs`, `pitchCountLearned`, `transferGap`, `retentionCurve` (four-sample nullable array), and `totalTrials`.
- Add a public aggregate outcome report generated server-side from database snapshots. The report includes median, interquartile range (IQR), and mean for key metrics alongside a visible caveat citing Wong et al. 2025. It never displays a mean alone. It distinguishes Vibratone's user aggregate from the study population.
- Add global daily puzzle stats and share counters—no account required to view or share.
- Add an operator dataset export endpoint: secret-gated, not reachable from any learner-facing route, with a k-anonymity floor applied before any row is returned.
- Enforce abuse-resistant rate limits on aggregate submission without requiring login. No more than `MAX_AGGREGATE_SUBMISSIONS_PER_WINDOW = 3` submissions are accepted from the same device within a 24-hour window. The rate-limit identifier (coarse salted IP hash) is discarded server-side after 48 hours and is never written to the learning-data table.
- Enforce abuse-resistant rate limits on puzzle share counter increments. No more than `MAX_PUZZLE_STATS_WRITES_PER_WINDOW = 5` share-counter POSTs are accepted from the same device within a 24-hour window. This limit applies only to the share-counter POST endpoint—not to puzzle stats GET reads.

### Report cohort definition (named constant)

The public report groups submissions by `trackId + researchMode` only. `timbres` and `octaveRange` are captured as metadata and surfaced in `protocolSummary` / `inclusionCriteria` as a human-readable range description (e.g., "mixed timbres, octaves 3–5"), but do NOT split the cohort. Splitting on those dimensions would fragment samples below `MIN_REPORT_SUBMISSIONS` indefinitely during early adoption.

```ts
/**
 * Fields that define report cohort membership.
 * Submissions with the same trackId and researchMode are pooled together
 * regardless of timbres or octaveRange.
 */
export const REPORT_COHORT_KEY_FIELDS = ['trackId', 'researchMode'] as const;
```

### Sample-size suppression (named constants)

These constants live in `learning/analytics/aggregate.ts` with code comments citing statistical caution and the honest-claims invariant as rationale:

- `MIN_REPORT_SUBMISSIONS = 30` — public report is suppressed entirely until at least this many complete-program submissions share the same `trackId` and `researchMode`.
- `MIN_CELL_COUNT = 10` — per-breakdown cells (e.g., per-pitch-class accuracy) are suppressed when the cell count falls below this value. Suppressed cells render as "not enough data" placeholders, not zeroes.
- `MAX_AGGREGATE_SUBMISSIONS_PER_WINDOW = 3` — per-device rate limit for aggregate submissions within a 24-hour window.
- `MAX_PUZZLE_STATS_WRITES_PER_WINDOW = 5` — per-device rate limit for puzzle share-counter increments within a 24-hour window. Prevents trivial share-count inflation. Applies to POST only; GET reads are not rate-limited.
- `DATASET_K_ANONYMITY_FLOOR = 5` — operator dataset export suppresses any row where the combination of protocol settings and pitch-count bucket appears fewer than this many times in the snapshot.

### Submission irrevocability (withdrawal resolution)

Anonymous submissions are irrevocable. No client-held deletion token is issued. The opt-in confirmation UI must display the following irrevocability disclosure before the learner can confirm: "This contribution is anonymous and cannot be individually removed once sent. You can turn off future submissions at any time." An opt-out toggle that blocks future submissions remains available and reversible at any time.

### Schema-version isolation

Reports aggregate only submissions sharing the same major schema version (integer field `schemaVersion`). When a snapshot contains submissions from multiple major versions, the report displays each version's subset count separately and labels which version produced the displayed figures. Cross-version aggregation is not performed.

## User Experience Requirements

- A learner can use the product fully—local practice, progress reports, daily puzzle play—without submitting aggregate data. No feature is gated on submission.
- Aggregate contribution must be opt-in, explained, and entirely separate from local progress reports. Declining or opting out does not alter local report content.
- The opt-in confirmation UI must display the irrevocability disclosure before the confirm action becomes available.
- The opt-out toggle must be available and reversible at any time after opting in.
- Public reports must show sample size, protocol settings, collection window, and caveats prominently. All numeric claims are accompanied by variance (median + IQR); no mean is shown in isolation.
- Daily puzzle global stats must fully render and be interactive with no account. No element is blurred, hidden, or replaced by a sign-in prompt.
- A learner who receives a 429 (rate-limit exceeded) sees a non-blocking informational message; no submission is stored for that request. The response body must contain a human-readable message string.
- **Puzzle-attempt disclosure (disclosed-automatic, not opt-in):** Puzzle attempt and score recording is disclosed-automatic. The puzzle page displays a one-line notice before the first attempt: "Your score is counted anonymously in the global tally—no account or personal data is stored." This notice is shown once per device, suppressed on subsequent visits via the `localStorage` key `vibratone:puzzle-notice-dismissed`. It is informational only—the learner is not required to dismiss it to play. It does not gate puzzle play.

## Data and Analytics Requirements

- Aggregate records must be schema-versioned (`schemaVersion: 1`), and the server must reject payloads with an unknown or missing schema version with HTTP 422.
- Aggregate records must exclude raw microphone audio, direct personal identifiers (email, name, IP address, device fingerprint), and full local attempt history.
- The `AggregateEfficacyRecord` type is a computed roll-up from the attempt-event log and FSRS state introduced in the Local FSRS and AP Analytics milestone—it does not forward raw events.
- `AggregateEfficacyRecord.retentionCurve` is typed as `[number | null, number | null, number | null, number | null]` (days 0, 7, 14, 28). Day 0 is cold-test accuracy immediately before the first training session and is **never null**—a record is only built when a cold test exists. Days 7, 14, and 28 are back-computed from timestamps in the attempt-event log: day 7 uses the last cold-test accuracy in the window `[windowStart + 7d, windowStart + 14d)`, day 14 uses `[windowStart + 14d, windowStart + 21d)`, and day 28 uses attempts with `timestamp >= windowStart + 28d`. Days 7, 14, and 28 are `null` if no qualifying attempt exists for that window or if fewer than that many days have elapsed since `windowStart`.
- The public `PublicReportSnapshot` type must include distribution fields: `medianColdTestAccuracy`, `iqrColdTestAccuracy`, `medianPitchCountLearned`, `iqrPitchCountLearned`, and `retentionCurve` (averaged, length 4), alongside `mean*` fields. Null fields indicate insufficient data.
- Dataset exports apply a k-anonymity floor (`DATASET_K_ANONYMITY_FLOOR = 5`) and must strip direct identifiers; the operator dataset export is gated by a server-side secret, returns 401 without it, and is not reachable from any learner-facing route.
- Daily puzzle stats track `puzzleId` (date-keyed, UTC, server-derived), `attempts`, `scoreDistribution` (exactly a 10-bucket array), and `shareCount`. No account identifiers are stored.
- Rate-limit logic uses a DB-backed bucket table keyed by a coarse salted IP hash (first two IPv4 octets / first 32 IPv6 bits). The bucket `expires_at` timestamp is the only rate-limit data retained. The identifier is never joined to the learning-data table. Bucket rows are cleaned up lazily on read (delete where `expires_at < now()`)—no Redis or external KV store required.
- Report generation must be deterministic: two calls with the same fixed snapshot produce value-identical output (generation timestamp excluded from equality).
- Database unavailability must not break local practice, local progress reports, or daily puzzle play. The public report page falls back to a cached snapshot or an "unavailable" state without throwing.

## Accessibility Requirements

- Public aggregate reports must lead with a `<table>` in server-rendered HTML. The table has a `<caption>` and `aria-label`. Visual heatmap and chart layers are progressive enhancements using `{@attach}` (per project Svelte conventions) on a host element that is `aria-hidden="true"`, never the sole data surface.
- Daily puzzle global stats must be wrapped in a `role="region"` element with an `aria-label`. Live-updating counters must be wrapped in a `role="status" aria-live="polite" aria-atomic="true"` region.
- The share action must be keyboard-focusable and operable by keyboard (Enter activates it).
- The opt-in disclosure and opt-out toggle must be keyboard and screen-reader usable. All controls must meet a 44 × 44 px minimum tap target.
- Opt-in, disclosure, and opt-out copy must be fully visible and operable at 390 px viewport width without horizontal scroll.

## Module and Architecture Targets

### Pure analytics — `learning/analytics/`

| File                              | Exports                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `learning/analytics/aggregate.ts` | `AggregateEfficacyRecord` (type), `AggregateSchemaVersion = 1 as const`, `PublicReportSnapshot` (type), `DailyPuzzleStats` (type), `MIN_REPORT_SUBMISSIONS`, `MIN_CELL_COUNT`, `MAX_AGGREGATE_SUBMISSIONS_PER_WINDOW`, `MAX_PUZZLE_STATS_WRITES_PER_WINDOW`, `DATASET_K_ANONYMITY_FLOOR`, `REPORT_COHORT_KEY_FIELDS`, `AGGREGATE_SUBMITTED_BLOCKS_KEY`, `isAggregateEfficacyRecord` (type guard), `privacyFilter`, `buildAggregatePayload`, `buildBlockId`, `buildPublicReportSnapshot`, `generateBreakdownReport` |

**`AggregateEfficacyRecord`** shape (note nullable `retentionCurve` elements):

```ts
export const AGGREGATE_SCHEMA_VERSION = 1 as const;
export type AggregateSchemaVersion = typeof AGGREGATE_SCHEMA_VERSION;

export type AggregateEfficacyRecord = {
	schemaVersion: AggregateSchemaVersion;
	windowStart: string; // ISO 8601
	windowEnd: string; // ISO 8601
	protocol: {
		trackId: 'ap' | 'relative-pitch' | 'theory' | 'production';
		researchMode: boolean;
		timbres: string[];
		octaveRange: [number, number];
	};
	coldTestAccuracy: number; // 0–1
	responseTimeDeltaMs: number; // negative = faster
	pitchCountLearned: number;
	transferGap: number; // 0–1, accuracy on novel timbre minus trained timbre
	retentionCurve: [number | null, number | null, number | null, number | null]; // days 0, 7, 14, 28; day 0 never null
	totalTrials: number;
};
```

**`PublicReportSnapshot`** shape:

```ts
export type PublicReportSnapshot = {
	schemaVersion: AggregateSchemaVersion;
	generatedAt: string;
	collectionWindow: { start: string; end: string };
	sampleSize: number;
	status: 'published' | 'suppressed';
	suppressionReason?: 'insufficient_sample';
	inclusionCriteria: string[];
	protocolSummary: string;
	// Distribution — null means insufficient data for this metric
	meanColdTestAccuracy: number | null;
	medianColdTestAccuracy: number | null;
	iqrColdTestAccuracy: [number, number] | null; // [Q1, Q3]
	meanPitchCountLearned: number | null;
	medianPitchCountLearned: number | null;
	iqrPitchCountLearned: [number, number] | null;
	meanResponseTimeDeltaMs: number | null;
	retentionCurve: (number | null)[]; // averaged, length 4
	caveats: string[];
	schemaVersionSubsets?: { version: number; count: number }[];
};
```

**`buildBlockId`** — canonical block identifier construction. Must be used by all call sites (protocol completion handler, acceptance tests) to ensure format consistency:

```ts
/**
 * Canonical block identifier format: '<trackId>:<schemaVersion>:<programBlockSlug>'
 * Example: 'ap:1:12-pitch'
 *
 * The schemaVersion is embedded so a v2 submission ('ap:2:12-pitch') cannot
 * collide with a v1 entry in AGGREGATE_SUBMITTED_BLOCKS_KEY.
 */
export function buildBlockId(
	trackId: AggregateEfficacyRecord['protocol']['trackId'],
	schemaVersion: AggregateSchemaVersion,
	programBlockSlug: string
): string {
	return `${trackId}:${schemaVersion}:${programBlockSlug}`;
}
```

The AP protocol module (`learning/protocols/ap.ts`) must export `AP_BLOCK_SLUG = '12-pitch' as const`. The primary block's `blockId` is therefore `buildBlockId('ap', AGGREGATE_SCHEMA_VERSION, AP_BLOCK_SLUG)` which yields `'ap:1:12-pitch'`.

**`buildAggregatePayload`** — assembles an `AggregateEfficacyRecord` from local FSRS state and attempt-event log. Before assembling, checks `localStorage` under `AGGREGATE_SUBMITTED_BLOCKS_KEY` (`'vibratone:aggregate-submitted-blocks'`) for already-submitted block identifiers; if the current block is present, returns `null`. On success, adds the `blockId` to the list before returning. Passes output through `privacyFilter` before returning.

```ts
export const AGGREGATE_SUBMITTED_BLOCKS_KEY = 'vibratone:aggregate-submitted-blocks';

import type { AttemptEvent } from './events.ts'; // from Local FSRS & AP Analytics milestone
import type { FsrsCard } from '../scheduling/fsrs.ts'; // from Local FSRS & AP Analytics milestone

export function buildAggregatePayload(
	blockId: string,
	storage: Storage | null,
	opts: {
		fsrsCards: FsrsCard[]; // per-card stability/retrievability from learning/scheduling
		attemptLog: AttemptEvent[]; // full attempt history for windowStart–windowEnd from learning/analytics
		protocol: AggregateEfficacyRecord['protocol'];
		windowStart: string; // ISO 8601 — first qualifying attempt timestamp
		windowEnd: string; // ISO 8601 — block completion timestamp
		totalTrials: number;
	}
): AggregateEfficacyRecord | null;
```

**`privacyFilter`** — strips any field not present in `AggregateEfficacyRecord` (raw attempt arrays, device fingerprints, audio buffers). Returns a new object; never mutates input. The server calls this as a second check after client-side filtering.

**`buildPublicReportSnapshot`** — groups submissions by `REPORT_COHORT_KEY_FIELDS` (`trackId + researchMode`) only. When `sampleSize < MIN_REPORT_SUBMISSIONS`, returns `status: 'suppressed'` with all metric fields `null`. Otherwise returns computed medians, IQRs, and means. Deterministic: identical input produces identical output.

**`generateBreakdownReport`** — returns per-cell results; cells with count `< MIN_CELL_COUNT` are returned as `{ suppressed: true }` rather than numeric values.

### Client submission wiring — `src/lib/submission.ts`

This module bridges `buildAggregatePayload` (pure builder) and `POST /api/aggregate` (endpoint). It is pure and testable. The call site lives in the AP protocol completion handler inside `learning/protocols/ap.ts`, not in any UI component. Components receive `SubmissionResult` as a prop and conditionally render the non-blocking 429 notice inside an `aria-live="polite"` region.

```ts
// src/lib/submission.ts

export type SubmissionResult =
	| { status: 'submitted' }
	| { status: 'skipped' } // already submitted this blockId, or consent off
	| { status: 'rate-limited'; retryAfterMs: number }
	| { status: 'error'; message: string };

/**
 * Checks consent, builds the aggregate payload, and POSTs it.
 * Returns a typed result so callers can surface the 429 non-blocking
 * message without knowing HTTP status codes.
 * Never throws; all network errors map to { status: 'error' }.
 */
export function submitAggregateIfEligible(
	blockId: string,
	opts: {
		attemptLog: AttemptEvent[];
		fsrsCards: FsrsCard[];
		protocol: AggregateEfficacyRecord['protocol'];
		windowStart: string;
		windowEnd: string;
		totalTrials: number;
	},
	storage: Storage | null,
	consentState: AggregateConsentRecord
): Promise<SubmissionResult>;
```

### Server helpers — `src/lib/server/`

All DB query logic, privacy filtering, and aggregation must live in `src/lib/server/` and be imported exclusively by `+page.server.ts` and `+server.ts` files. Never import these from `.svelte` components or universal `+page.ts` loads.

| File                                | Purpose                                                                                                                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/aggregate.ts`       | `writeAggregateRecord`, `getLatestPublicReportSnapshot` — DB boundary for aggregate writes and snapshot reads                                                                |
| `src/lib/server/rate-limit.ts`      | `checkRateLimit` — DB-backed bucket; atomic `INSERT … ON CONFLICT DO UPDATE` against `rate_limit_bucket` table                                                               |
| `src/lib/server/puzzle-stats.ts`    | `getPuzzleStats`, `recordPuzzleAttempt`, `recordShareCount` — puzzle stats DB boundary; `recordPuzzleAttempt` and `recordShareCount` use atomic `UPDATE … SET col = col + 1` |
| `src/lib/server/operator-export.ts` | `streamOperatorDataset` — queries anonymized DB view, applies k-anonymity floor, streams NDJSON                                                                              |

The `rate_limit_bucket` schema (added to the M20 migration set):

```sql
CREATE TABLE rate_limit_bucket (
  key        TEXT         NOT NULL,
  count      INTEGER      NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ  NOT NULL,
  PRIMARY KEY (key)
);
```

`checkRateLimit` is keyed by a coarse salted IP hash sourced from `event.locals.clientAddressHash` (set in `hooks.server.ts`). Two IPs sharing the same first two IPv4 octets (or first 32 IPv6 bits) hash to the same bucket key. Bucket rows with `expires_at < now()` are cleaned up lazily on read; no scheduled job required.

**Important:** Do not use a module-level `Map` for rate limiting. Under `adapter-auto`, the runtime may be serverless and module-level state resets between invocations. The `rate_limit_bucket` table (already a dependency from M20) is the correct backing store.

### HTTP endpoints — `src/routes/api/`

| Route                                       | Method | Handler                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/api/aggregate/+server.ts`       | `POST` | Validate body (JSON, size limit) → type guard → rate-limit check → `privacyFilter` → `writeAggregateRecord`. Returns 400 (invalid JSON), 413 (oversized), 422 (unknown/missing `schemaVersion` or type guard failure), 429 + `Retry-After` + user-facing message string (rate-limit exceeded), 201 (success). Fires programmatically—not from a `<form>` action. |
| `src/routes/api/puzzle-stats/+server.ts`    | `GET`  | Returns `DailyPuzzleStats` for today's UTC puzzle. Not rate-limited.                                                                                                                                                                                                                                                                                             |
| `src/routes/api/puzzle-stats/+server.ts`    | `POST` | Increments share counter atomically via `recordShareCount`. Rate-limited: returns 429 + `Retry-After` on the 6th request within a 24-hour window from the same key; no counter is incremented on rejection.                                                                                                                                                      |
| `src/routes/api/operator-export/+server.ts` | `GET`  | Requires `Authorization: Bearer <OPERATOR_EXPORT_SECRET>` env var; returns 401 without it; returns `new Response(stream, { headers: { 'Content-Disposition': 'attachment; filename=vibratone-export.json' } })`. Not `json()`. Streams NDJSON with k-anonymity floor applied. Not reachable from any learner-facing route.                                       |

### Route pages

| File                                | Purpose                                                                                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/routes/report/+page.server.ts` | SSR load — queries DB for latest `PublicReportSnapshot`; sets `Cache-Control: public, max-age=300, stale-while-revalidate=3600`; returns `{ snapshot: PublicReportSnapshot \| null }`. Public, no auth. No `prerender = true`. |
| `src/routes/report/+page.svelte`    | Public aggregate report; table-first SSR, chart is progressive enhancement. `PublicReportSnapshot` received via `data` prop accessed directly or stored as `$state.raw(data.snapshot)`—never in a deep-reactive `$state`.      |
| `src/routes/puzzle/+page.server.ts` | SSR load — queries `DailyPuzzleStats` by today's UTC date alongside puzzle content; returns `{ puzzleStats: DailyPuzzleStats \| null }`. Stats travel in the same SSR payload—no separate client fetch for initial render.     |
| `src/routes/puzzle/+page.svelte`    | Puzzle play + global stats display. Passes `data.puzzleStats` as `initialStats` to `puzzle-global-stats.svelte`.                                                                                                               |

### `App.Locals` extension — `src/app.d.ts`

```ts
// src/app.d.ts
import type { DatabaseClient } from '$lib/server/db';

declare global {
	namespace App {
		interface Locals {
			db: DatabaseClient; // from M20's hooks.server.ts
			clientAddressHash: string | null; // coarse salted IP hash for rate limiting; null when unavailable
		}
	}
}

export {};
```

`hooks.server.ts` attaches these per-request in `handle`. Individual endpoints access the DB client via `event.locals.db`—never by importing and calling a DB module directly inside an endpoint.

### State factory — `src/lib/state/consent.svelte.ts`

Exports `createConsentState()` factory and `[getConsentState, setConsentState]` context pair. Do not introduce a module-level reactive variable—that would create an SSR-shared singleton.

```ts
export const AGGREGATE_CONSENT_KEY = 'vibratone:aggregate-consent';

export type AggregateConsentRecord = {
	version: 1;
	optedIn: boolean;
	optedInAt: string | null; // ISO 8601
};

/** Type guard required by loadJSON<AggregateConsentRecord>(...) */
export function isAggregateConsentRecord(value: unknown): value is AggregateConsentRecord;
```

SSR renders with `optedIn: false`. `onMount` upgrades to the stored value via:

```ts
const defaultConsent: AggregateConsentRecord = { version: 1, optedIn: false, optedInAt: null };
let consent = $state(
	loadJSON(localStorageOrNull(), AGGREGATE_CONSENT_KEY, defaultConsent, isAggregateConsentRecord)
);
```

Writes happen in deliberate action functions (`optIn`, `optOut`), never in `$effect`. This prevents SSR hydration mismatches.

### UI Components — `src/lib/components/`

| Component                    | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aggregate-consent.svelte`   | Opt-in/opt-out UI. Reads/writes `AGGREGATE_CONSENT_KEY` via `createConsentState()`. Displays irrevocability disclosure before confirm is available.                                                                                                                                                                                                                                                                                                                                               |
| `public-report.svelte`       | Renders `PublicReportSnapshot`. Always emits `<table>` with `<caption>` and `aria-label`. Suppressed state shows "not enough data yet" placeholder—no numeric claims. Heatmap/chart is progressive enhancement via `{@attach}` on an `aria-hidden="true"` element. `PublicReportSnapshot` is read-only server data; use `$state.raw` if lifted into local state.                                                                                                                                  |
| `puzzle-global-stats.svelte` | Renders `DailyPuzzleStats`. `role="region"` with `aria-label`. Live counters in `role="status" aria-live="polite" aria-atomic="true"` region. Accepts `initialStats: DailyPuzzleStats \| null` (from SSR) and `pollIntervalMs?: number` (default `30_000`). Uses `createSubscriber` from `svelte/reactivity` for 30-second client-side polling; cleanup fires automatically on destroy. Stats stored as `$state.raw<DailyPuzzleStats \| null>(initialStats)` and replaced wholesale on each poll. |
| `share-action.svelte`        | Calls `navigator.share()` with `navigator.clipboard.writeText()` fallback. `canShare = $derived(browser && 'share' in navigator)` prevents SSR crashes. Replaced by Cinder #322 when available.                                                                                                                                                                                                                                                                                                   |

## Dependencies

- **Milestone 20 (Database Foundation):** Consumes the `rate_limit_bucket` table, anonymous aggregate outcome schemas, daily-puzzle-stats schemas, public-report-snapshot schemas, retention/deletion procedures, server-boundary validation helpers, and `localStorageOrNull`/`loadJSON`/`saveJSON` persistence primitives. Also provides the `DatabaseClient` type attached to `event.locals.db` via `hooks.server.ts`.
- **Local FSRS and AP Analytics milestone (earlier):** Consumes the `AttemptEvent` log type from `learning/analytics/events.ts` and the `FsrsCard` type from `learning/scheduling/fsrs.ts` as source data for `buildAggregatePayload`. The `AggregateEfficacyRecord` is a computed roll-up, not a raw event forward.
- **Research-Derived AP Level Progression milestone (earlier):** Defines the 12-pitch final-mastery gate that triggers `buildAggregatePayload`. The `AP_BLOCK_SLUG = '12-pitch' as const` constant is exported by `learning/protocols/ap.ts`; the canonical `blockId` is `buildBlockId('ap', AGGREGATE_SCHEMA_VERSION, AP_BLOCK_SLUG)` yielding `'ap:1:12-pitch'`. This is a pure string constructed at the call site from known-at-completion values—no runtime lookup required.
- **Public AP Beta and Proof Loop milestone (earlier):** Consumes the per-user share-payload pattern and the research-mode toggle.

## External Dependency Contracts

### Cinder `#319` — matrix/heatmap visualization

**Contract:** A component accepting `{ labels: string[], values: number[], suppressedCells: boolean[] }` that renders a heatmap grid and includes a text-summary fallback. Integrated via `{@attach}` on a host element that is `aria-hidden="true"`.

**Owning ticket:** [cinder#319](https://github.com/stevekinney/cinder/issues/319)

**Stub plan:** The `<table>` fallback in `public-report.svelte` is the required accessibility surface and ships first regardless. No junior is blocked waiting for #319—the table IS the deliverable; the heatmap layer is additive. The `{@attach}` integration point is written as a no-op stub that is replaced when #319 ships.

### Cinder `#322` — share action component

**Contract:** A component accepting a text/URL payload and invoking `navigator.share()` with a `navigator.clipboard.writeText()` fallback.

**Owning ticket:** [cinder#322](https://github.com/stevekinney/cinder/issues/322)

**Stub plan:** `src/lib/components/share-action.svelte` implements the contract directly using `navigator.share()` + clipboard fallback. `canShare = $derived(browser && 'share' in navigator)` prevents SSR crashes. Replaced by the Cinder component when #322 ships.

### Rate-limit backing store

**Contract:** Atomic `INSERT … ON CONFLICT DO UPDATE` against `rate_limit_bucket` table. Key = salted hash of (IP-prefix + endpoint + time-bucket). Supports `expires_at`-based cleanup. No Redis or external KV store required.

**Owning ticket:** Depends on M20 DB choice (table schema provided above).

**Stub plan:** `rate_limit_bucket` table in the M20 database. Cleanup runs lazily on read. In unit tests, mock `checkRateLimit` to return pass/fail for specific test cases.

### `AttemptEvent` type

**Contract:** The attempt-event shape produced by the Local FSRS and AP Analytics milestone. Imported from `learning/analytics/events.ts`. Must include at minimum `timestamp: string`, `sessionType: 'cold-test' | 'practice'`, and per-attempt outcome fields.

**Owning ticket:** Local FSRS and AP Analytics milestone.

**Stub plan:** In unit tests, construct minimal plain-object stubs matching the expected fields. No mock library required.

### `FsrsCard` type

**Contract:** FSRS card state per pitch class, imported from `learning/scheduling/fsrs.ts`. Includes at minimum `stability`, `retrievability`, and scheduling state fields.

**Owning ticket:** Local FSRS and AP Analytics milestone.

**Stub plan:** In unit tests, use hardcoded plain-object FSRS state stubs. `buildAggregatePayload` unit tests supply these directly.

## Acceptance Criteria

1. **Local practice unaffected by opt-out:** A Playwright run that declines the aggregate opt-in prompt, completes an AP session, and opens the local progress report route encounters no aggregate opt-in prompt and sees report content identical to that of a learner who has submitted aggregate data.

2. **Pre-submission disclosure visible before confirm:** The opt-in UI displays the irrevocability disclosure ("This contribution is anonymous and cannot be individually removed once sent") before the confirm action is available. A Playwright assertion confirms the disclosure text is visible and the confirm button is initially absent or disabled.

3. **Report suppressed below `MIN_REPORT_SUBMISSIONS`:** A unit test seeds a snapshot with 29 qualifying submissions, calls `buildPublicReportSnapshot`, and asserts the return value has `status: 'suppressed'` and `suppressionReason: 'insufficient_sample'`. The `/report` route renders a "not enough data yet" placeholder with no numeric claims and no chart.

4. **Report published at `MIN_REPORT_SUBMISSIONS`:** A unit test seeds exactly 30 qualifying submissions and asserts `buildPublicReportSnapshot` returns `status: 'published'` with non-null `medianColdTestAccuracy` and `iqrColdTestAccuracy`.

5. **Report determinism:** A unit test seeds a fixed snapshot, calls `buildPublicReportSnapshot` twice with the same input, and asserts value-identical output (same sample size, same statistics, same caveats). Generation timestamp is excluded from the equality assertion.

6. **Variance-honest public report:** The rendered `/report` page displays median and IQR for pitch classes learned at 90%+ accuracy alongside the mean—not a mean alone. The page includes a visible caveat citing Wong et al. 2025 and explicitly distinguishes Vibratone's aggregate from the study population. A Playwright assertion confirms the IQR element, caveat text, and population-distinction copy are present.

7. **Global puzzle stats render without login:** The `/puzzle` page and global stats fully render and are interactive with no account. No element is blurred, hidden, or replaced by a sign-in prompt. A logged-out Playwright run can view stats, play the puzzle, and invoke the share action without any authentication step.

8. **Rate limit enforced with user-facing message:** A test client that posts 4 aggregate submissions within a 24-hour window receives a 429 response with a `Retry-After` header on the fourth request. The fourth submission is not stored in the analytics table. The response body includes a user-facing informational message string (non-empty).

9. **Operator dataset export is not learner-accessible:** A Playwright run that navigates all learner-facing routes finds no link or button that reaches `/api/operator-export`. A direct `GET` to `/api/operator-export` without the `OPERATOR_EXPORT_SECRET` env variable returns 401.

10. **Per-cell suppression in breakdown report:** A unit test seeds a breakdown where one cell has 9 qualifying submissions, calls `generateBreakdownReport`, and asserts that cell is `{ suppressed: true }` rather than a numeric value.

11. **Schema-version isolation:** A unit test seeds a snapshot with schema v1 and v2 submissions, calls `buildPublicReportSnapshot`, and asserts the result contains `schemaVersionSubsets` with two separately labeled entries rather than a merged aggregate.

12. **Submission fires at most once per completed program block:** A unit test calls `buildAggregatePayload` twice with the same `blockId` (`buildBlockId('ap', 1, '12-pitch')` → `'ap:1:12-pitch'`) and a shared in-memory stub for `localStorage`, and asserts the second call returns `null`. A separate test with a different `blockId` asserts the second call returns a valid record. After first submission, `AGGREGATE_SUBMITTED_BLOCKS_KEY` in localStorage contains the `blockId`.

13. **Unknown schema version rejected:** `POST /api/aggregate` with `schemaVersion: 99` returns 422. Any parseable payload with `schemaVersion: 1` but missing `coldTestAccuracy` also returns 422. Unparseable JSON returns 400.

14. **Oversized payload rejected:** `POST /api/aggregate` with a body exceeding the configured byte limit returns 413.

15. **Puzzle attempt counter is atomic:** An integration test confirms that `recordPuzzleAttempt` issues an atomic `UPDATE … SET attempts = attempts + 1` at the SQL layer (verified by asserting the generated SQL form or by inspection of the server helper), not a read-modify-write in application code. `recordShareCount` is likewise verified as atomic.

16. **Operator export not linked from learner routes:** A Playwright run navigating all learner-facing routes (`/`, `/report`, `/puzzle`) finds no link or button whose `href` or `onclick` targets `/api/operator-export`. A direct `GET /api/operator-export` without the `OPERATOR_EXPORT_SECRET` env variable returns 401.

## Test Plan

### Unit — `learning/analytics/aggregate.spec.ts`

- `isAggregateEfficacyRecord: returns true for a well-formed payload`
- `isAggregateEfficacyRecord: returns false when schemaVersion is missing`
- `isAggregateEfficacyRecord: returns false when schemaVersion is not 1`
- `isAggregateEfficacyRecord: returns false when coldTestAccuracy is absent`
- `isAggregateEfficacyRecord: returns false when retentionCurve does not have exactly 4 elements`
- `privacyFilter: returns a new object (does not mutate input)`
- `privacyFilter: strips fields not present in AggregateEfficacyRecord`
- `privacyFilter: removes any field containing a raw audio buffer or data URI`
- `buildPublicReportSnapshot: returns status suppressed when count is 29 (< MIN_REPORT_SUBMISSIONS)`
- `buildPublicReportSnapshot: returns status suppressed when count is exactly MIN_REPORT_SUBMISSIONS - 1`
- `buildPublicReportSnapshot: returns status published when count equals MIN_REPORT_SUBMISSIONS`
- `buildPublicReportSnapshot: published snapshot includes medianColdTestAccuracy and iqrColdTestAccuracy`
- `buildPublicReportSnapshot: published snapshot includes medianPitchCountLearned and iqrPitchCountLearned`
- `buildPublicReportSnapshot: published snapshot includes retentionCurve of length 4`
- `buildPublicReportSnapshot: published snapshot includes sampleSize, collectionWindow, inclusionCriteria, and caveats`
- `buildPublicReportSnapshot: is deterministic — two calls with the same input produce value-identical output`
- `buildPublicReportSnapshot: isolates schema v1 and v2 submissions into schemaVersionSubsets instead of merging`
- `buildPublicReportSnapshot: pools submissions with different timbres into a single cohort when trackId and researchMode match`
- `generateBreakdownReport: suppresses cells with count < MIN_CELL_COUNT as { suppressed: true }`
- `generateBreakdownReport: returns numeric values for cells with count >= MIN_CELL_COUNT`
- `buildAggregatePayload: returns an AggregateEfficacyRecord for a first-time blockId`
- `buildAggregatePayload: returns null when blockId is already present in AGGREGATE_SUBMITTED_BLOCKS_KEY`
- `buildAggregatePayload: does not return null for a different blockId even after a first-time submission`
- `buildAggregatePayload: written record does not contain raw audio or direct identifier fields`
- `buildAggregatePayload: retentionCurve[0] (day 0) is never null`
- `buildAggregatePayload: retentionCurve[3] (day 28) is null when fewer than 28 days have elapsed since windowStart`
- `buildAggregatePayload: retentionCurve[3] is a number when 28+ days of cold-test attempt log data exist`
- `buildAggregatePayload: blockId matching ap:1:12-pitch pattern is stored in AGGREGATE_SUBMITTED_BLOCKS_KEY after first submission`
- `buildBlockId: returns ap:1:12-pitch for trackId ap, schemaVersion 1, slug 12-pitch`

### Unit — `src/lib/submission.spec.ts`

- `submitAggregateIfEligible: does not call fetch when consentState.optedIn is false, returns skipped`
- `submitAggregateIfEligible: returns skipped without calling fetch when buildAggregatePayload returns null (already submitted)`
- `submitAggregateIfEligible: returns rate-limited with retryAfterMs parsed from Retry-After header when server responds 429`
- `submitAggregateIfEligible: returns submitted on 201`
- `submitAggregateIfEligible: returns error without throwing when fetch rejects (network failure)`
- `submitAggregateIfEligible: returns error on 503 (DB unavailable)`

### Unit — `src/lib/server/rate-limit.spec.ts`

- `checkRateLimit: allows 3 submissions within a 24-hour window from the same key`
- `checkRateLimit: returns false on the 4th submission within the window`
- `checkRateLimit: returns Retry-After information on rejection`
- `checkRateLimit: resets the bucket after the window expires`
- `checkRateLimit: two distinct IP hashes have independent buckets`
- `checkRateLimit: the rate-limit key is never written to the analytics table`
- `checkRateLimit: two IPs sharing the same first two IPv4 octets are treated as the same bucket key`
- `checkRateLimit: rate-limit bucket row is absent (expired) after expires_at passes 48-hour TTL`
- `checkRateLimit: uses hashed key, not raw IP`

### Unit — `src/routes/api/aggregate/+server.spec.ts`

- `POST /api/aggregate: returns 400 for invalid JSON body`
- `POST /api/aggregate: returns 422 when schemaVersion is missing`
- `POST /api/aggregate: returns 422 when schemaVersion is not 1`
- `POST /api/aggregate: returns 422 for a parseable body with schemaVersion: 1 but missing coldTestAccuracy`
- `POST /api/aggregate: returns 413 when body exceeds the byte limit`
- `POST /api/aggregate: returns 429 when rate limit exceeded, with Retry-After header`
- `POST /api/aggregate: 429 response body contains a user-facing informational message string`
- `POST /api/aggregate: does not store the rejected submission when rate-limited`
- `POST /api/aggregate: calls privacyFilter before writing to DB`
- `POST /api/aggregate: returns 201 for a valid, under-limit payload`

### Unit — `src/routes/api/puzzle-stats/+server.spec.ts`

- `POST /api/puzzle-stats: returns 429 on the 6th request within a 24-hour window from the same key`
- `POST /api/puzzle-stats: does not increment the share counter when rate limit exceeded`

### Unit — `src/routes/api/operator-export/+server.spec.ts`

- `GET /api/operator-export: returns 401 when OPERATOR_EXPORT_SECRET is absent`
- `GET /api/operator-export: returns 401 when Authorization header does not match secret`
- `GET /api/operator-export: returns NDJSON with Content-Disposition attachment when authorized`
- `GET /api/operator-export: suppresses rows below DATASET_K_ANONYMITY_FLOOR in output`
- `GET /api/operator-export: no row in output contains a direct identifier field`
- `GET /api/operator-export: includes rows where group count equals exactly DATASET_K_ANONYMITY_FLOOR (boundary value)`

### Unit — `src/lib/server/puzzle-stats.spec.ts`

- `getPuzzleStats: returns attempt count, score distribution, and share count for a valid UTC date`
- `getPuzzleStats: returns empty stats (not an error) for a valid date with no submissions`
- `getPuzzleStats: rejects a future puzzle date with 400`
- `getPuzzleStats: does not return account identifiers in the stats payload`
- `getPuzzleStats: scoreDistribution is exactly a 10-element array`
- `recordPuzzleAttempt: uses atomic DB increment (does not read-modify-write)`
- `recordPuzzleAttempt: derives puzzleId server-side from UTC date, not client-supplied value`
- `recordShareCount: uses atomic DB increment for share counter (does not read-modify-write)`

### Integration — `src/lib/server/aggregate.integration.spec.ts`

- `anonymous submission create path: POST /api/aggregate stores a record with correct schemaVersion`
- `report read path: getLatestPublicReportSnapshot reflects the submitted record after DB commit`
- `report snapshot reproducibility: calling buildPublicReportSnapshot twice from the same DB-seeded rows yields identical aggregates`
- `database unavailable: submission endpoint returns 503 and local practice flow is unaffected`
- `database unavailable: report page falls back to cached snapshot or "unavailable" state without throwing`
- `database unavailable: puzzle stats endpoint returns empty stats or a cached value without throwing`
- `database unavailable: puzzle page renders without an unhandled error when the DB is unreachable`

### Component — `src/lib/components/aggregate-consent.svelte.test.ts`

- `aggregate-consent: renders irrevocability disclosure before confirm action is available`
- `aggregate-consent: opt-in writes AGGREGATE_CONSENT_KEY to localStorage`
- `aggregate-consent: opt-out sets optedIn: false without deleting the key`
- `aggregate-consent: is operable by keyboard (Enter and Space on the toggle)`
- `aggregate-consent: at 390px viewport, all copy is visible without horizontal scroll`

### Component — `src/lib/state/consent.svelte.test.ts`

- `createConsentState: optedIn is false before onMount regardless of localStorage value`
- `createConsentState: optedIn upgrades to the stored value after onMount completes`
- `createConsentState: optOut sets optedIn: false and persists the record without deleting the key`

### Component — `src/lib/components/public-report.svelte.test.ts`

- `public-report: always renders a <table> element regardless of snapshot status`
- `public-report: renders "not enough data yet" copy when status is suppressed`
- `public-report: does not render numeric claims when status is suppressed`
- `public-report: renders sampleSize, medianColdTestAccuracy, and iqrColdTestAccuracy when published`
- `public-report: renders each entry in caveats[]`
- `public-report: table has a <caption> element`
- `public-report: table has an aria-label attribute`

### Component — `src/lib/components/puzzle-global-stats.svelte.test.ts`

- `puzzle-global-stats: renders attempts, score distribution, and share count without auth state`
- `puzzle-global-stats: has role="region" with an aria-label`
- `puzzle-global-stats: live counter is wrapped in aria-live="polite" region`
- `puzzle-global-stats: live counter has aria-live="polite" and aria-atomic="true"`
- `puzzle-global-stats: at 390px viewport, stats are readable without horizontal scroll`
- `puzzle-global-stats: stops polling when component is destroyed (clearInterval called on teardown)`
- `puzzle-global-stats: first-visit disclosure notice text matches documented disclosure copy`

### Component — `src/lib/components/share-action.svelte.test.ts`

- `share-action: calls navigator.share() when the share API is available`
- `share-action: falls back to navigator.clipboard.writeText() when navigator.share is not present`
- `share-action: canShare is false server-side (SSR does not call navigator APIs)`
- `share-action: is keyboard-operable (Enter key activates the share action)`

### Playwright — `e2e/aggregate-opt-in.spec.ts`

- `learner declines opt-in: local progress report renders without aggregate prompt (network interception confirms no POST to /api/aggregate)`
- `learner who declined opt-in: local progress report content matches that of a learner who submitted aggregate data`
- `pre-submission disclosure text is visible before confirm action is available`
- `opted-in learner: POST to /api/aggregate is observed after program-block completion`
- `opted-out learner: aggregate opt-out toggle is present, toggleable, and persists across reload`
- `opt-in UI is keyboard-navigable: Tab moves between controls, disclosure is read before confirm`

### Playwright — `e2e/public-report.spec.ts`

- `public report below threshold renders suppressed state with no numeric claims`
- `public report shows IQR element and Wong 2025 caveat text`
- `public report shows copy that explicitly distinguishes Vibratone user aggregate from the Wong 2025 study population`
- `public report shows schemaVersionSubsets when multiple schema versions present`
- `public report renders a <table> element in SSR HTML before JS executes (domcontentloaded check)`
- `aggregate report table is present in SSR HTML before JS hydrates (raw request.get check)`
- `public report at 375px, 768px, and 1280px viewport widths renders without overflow`
- `report page response includes Cache-Control: public, max-age=300, stale-while-revalidate=3600 header`

### Playwright — `e2e/daily-puzzle-global.spec.ts`

- `logged-out user: puzzle page and global stats render without login gate`
- `logged-out user: no element on the puzzle page is blurred, aria-hidden, or replaced by a sign-in prompt`
- `logged-out user: share action is available and keyboard-focusable without authentication`
- `puzzle page: first-visit disclosure notice is visible before the first attempt`
- `puzzle page: notice is not visible on second visit (localStorage key vibratone:puzzle-notice-dismissed set)`
- `navigating to a future puzzle date shows "not yet available" message, not a 500`
- `puzzle stats panel at 375px, 768px, and 1280px renders without overflow`
- `share button increments displayed count after POST resolves`

### Playwright — `e2e/operator-export.spec.ts`

- `learner routes (/, /report, /puzzle) contain no link or button targeting /api/operator-export`
- `GET /api/operator-export without secret returns 401`

## Verification

Run these gates in order:

```
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

**Manual smokes:**

- Load `/report` in a browser with JS disabled and confirm a data table with `<caption>` renders.
- Load `/puzzle` logged out and confirm stats and share action are fully visible with no blurred or hidden elements.
- Toggle the aggregate opt-in, reload, and confirm the choice persists via `localStorage`.
- Disable the database and confirm local practice and local progress reports continue to function.
- Send 4 `POST /api/aggregate` requests within 60 seconds from the same IP and confirm the 4th returns 429 with `Retry-After` and a human-readable message string in the body.
- Send 6 `POST /api/puzzle-stats` (share) requests from the same IP and confirm the 6th returns 429.
- `GET /api/operator-export` without the `OPERATOR_EXPORT_SECRET` env variable and confirm 401.
- Visit `/puzzle` in a fresh private window and confirm the first-visit disclosure notice appears, then reload and confirm it is absent.

## Non-Goals

- Do not add auth or user accounts.
- Do not add leaderboards tied to identity.
- Do not publish claims when submission count is below `MIN_REPORT_SUBMISSIONS = 30` or cell count is below `MIN_CELL_COUNT = 10`.
- Do not store raw microphone audio.
- Do not perform cross-schema-version aggregation in a single report figure.
- Do not issue per-submission deletion tokens; the opt-in copy resolves this by disclosing irrevocability before submission.
- Do not make the operator dataset export reachable from any learner-facing route.
- Do not display a mean without accompanying variance (median + IQR) in any public aggregate figure.
- Do not use in-memory counters (module-level `Map`) for rate limiting; adapter-auto can deploy to serverless runtimes where module-level state resets per invocation.
- Do not prerender the `/report` or `/puzzle` pages with `export const prerender = true`; report data changes and puzzle stats update continuously.
- Do not ship a client-side `Blob`/`URL.createObjectURL` flow for the operator export; the endpoint streams server-side with `Content-Disposition: attachment`.
- Do not use SSE for puzzle stats; SSE requires persistent server connections incompatible with adapter-auto's serverless deployment targets. Client-side polling via `createSubscriber` is the correct mechanism.
- Do not gate puzzle play on the first-visit disclosure notice dismissal; the notice is informational only.

## Completion Signal

This milestone is complete when Vibratone can publish variance-honest anonymous aggregate AP outcomes and global daily puzzle stats without introducing accounts, all new server endpoints are covered by named tests, the public report page passes the table-first SSR check, every acceptance criterion above has a passing named test, and the AC-to-test traceability matrix is fully covered with no gaps.
