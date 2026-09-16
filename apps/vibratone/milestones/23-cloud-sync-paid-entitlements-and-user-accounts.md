# 23. Cloud Sync, Paid Entitlements, and User Accounts

## Outcome

Let learners opt into cross-device continuity and paid guided training without weakening the free local-first experience. Every feature a learner can access today in local-only mode remains accessible without a paid plan or account.

## Product Requirements

### Entitlement Matrix (Binding)

The following table defines the paid/free boundary. Features delivered in milestones 00–22 as local-only functionality remain free and local. Pro and specialist-pack gates apply exclusively to cloud, cross-device, and curated-content features introduced in this milestone and later.

| Feature                                  | Free (Local) | Consumer Pro | Specialist Pack | AP Program Unlock |
| ---------------------------------------- | ------------ | ------------ | --------------- | ----------------- |
| AP training, FSRS scheduling, cold tests | Yes          | —            | —               | —                 |
| Local analytics and confusion matrix     | Yes          | —            | —               | —                 |
| Local export (JSON, CSV)                 | Yes          | —            | —               | —                 |
| Daily puzzle, share cards                | Yes          | —            | —               | —                 |
| Custom drills (local only)               | Yes          | —            | —               | —                 |
| Cross-device cloud sync                  | No           | Yes          | —               | —                 |
| AI coach with cloud history              | No           | Yes          | —               | —                 |
| Synced practice packs and custom drills  | No           | Yes          | —               | —                 |
| Singer track content                     | No           | —            | Yes             | —                 |
| Producer track curated packs             | No           | —            | Yes             | —                 |
| Full 288-level AP program (curated)      | No           | —            | —               | Yes (one-time)    |

**Binding non-goal:** Any feature a learner can access today in local-only mode must remain accessible without a paid plan or account. Pro gates the cloud/cross-device/convenience layer—never local FSRS scheduling, local AP training, or local analytics.

### Billing Provider Decision (Resolved)

**Default provider:** Stripe, accessed via the `stripe` npm package.

All billing client code, webhook secret references, and Stripe SDK imports live under `src/lib/server/` (M20's machine-enforced server-only boundary). The billing integration is implemented behind a `BillingProvider` interface so the provider is swappable without changing entitlement logic or tests.

```typescript
// src/lib/server/billing.ts
export interface BillingProvider {
	createCheckoutSession(params: CheckoutParams): Promise<{ url: string }>;
	getEntitlementState(userId: string): Promise<EntitlementState>;
	cancelSubscription(subscriptionId: string): Promise<void>;
	getPortalUrl(userId: string): Promise<string>;
	constructWebhookEvent(rawBody: string, signature: string): Promise<BillingEvent>;
}

export type EntitlementState = {
	plan: 'free' | 'consumer-pro' | 'specialist-pack' | 'ap-unlock';
	status: 'active' | 'canceled' | 'past-due' | 'refunded' | 'expired' | 'grace';
	purchaseType: 'subscription' | 'one-time';
	validUntil: Date | null;
	cachedAt: Date;
};
```

Unit tests use `InMemoryBillingProvider` at `src/lib/server/billing.stub.ts`. Integration tests use Stripe test-mode keys injected via `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` environment variables, plus the Stripe CLI webhook-forwarding fixture. CI uses the in-memory mock; integration tests are tagged `integration` and run separately.

### Conflict Resolution Strategy (Canonical)

Cloud sync resolves conflicts by data type:

**Attempt events:** Append-and-deduplicate by `eventId`. Attempt events are immutable per the M00 schema. A merge is the union of local and cloud event sets; duplicate `eventId` values are silently dropped. No dialog is needed for event merges.

**FSRS state and analytics:** Never merged directly. Always recomputed from the merged event log. Recomputation is idempotent. There is no "FSRS stability wins" logic — derived state is a pure function of the event log.

**Mutable preferences (octave range, timbre, answer surface):** Last-write-wins by `updatedAt` UTC timestamp. When `|localTimestamp - cloudTimestamp| < 30 seconds`, display a one-time confirmation dialog with a before/after preview of the differing values. The learner's choice is applied and re-synced.

After any conflict resolution, a "restore local snapshot" action is available in account settings for 7 days. The snapshot is stored in IndexedDB (not cloud) under `vibratone:sync-snapshot:v1`.

### Downgrade and Lapse Policy

On subscription cancel or payment lapse: cloud sync goes read-only immediately (no new pushes; read/export access continues). Local data is always retained regardless of entitlement state. After 30 days in read-only state, cloud data is queued for deletion and the learner receives an in-app notification and email with a one-click export link. After deletion, the learner can resubscribe and re-sync from the device. Pro-gated UI features lock without data loss on the local device.

For one-time purchases (AP program unlock, specialist packs): refund transitions state to `never-purchased`; local content and local progress are retained; cloud-only entitlement checks fail gracefully.

### Offline Entitlement Grace Window (Concrete)

Entitlement state is cached in an `HttpOnly`, signed cookie set by `hooks.server.ts` on each successful DB verification. The cookie TTL is 72 hours. On a cache hit within 72 hours, Pro access is granted without a DB round-trip. At 72-hour expiry without successful refresh, a non-blocking banner renders: "Unable to verify subscription — features remain available until [timestamp]." After a 24-hour grace period beyond expiry (96 hours total without a successful refresh), Pro-gated features lock. Local training continues unaffected in all states.

### Account Deletion and Financial Record Handling

Learning data, personal profile, and preferences: permanently deleted within 30 days of request. Billing records (invoices, receipts, subscription events): retained per legal requirement (7 years US), documented in `PRIVACY.md`, and excluded from the deletion confirmation copy. The deletion confirmation UI discloses this distinction before the learner confirms. A post-deletion email confirms what was deleted and what was retained and why.

### Cloud Sync Mechanics

Sync upload is a deliberate server action (form action `?/syncNow` or an explicit `fetch` call from `onMount` after user consent), serializing local state via `$state.snapshot()` before sending. Sync download happens in the `(account)/sync/+page.server.ts` load function, merging cloud state with the local snapshot before page render. **Sync is never implemented inside a `$effect`** — reactive effects are browser-only, invisible to SSR, and untestable in Vitest.

## User Experience Requirements

- Free local AP training continues to work without an account.
- Cloud sync is opt-in. The opt-in modal lists each data type to be synced (attempt events, FSRS state, preferences, saved packs) and requires explicit confirmation before the first sync. No sync API call fires before confirmation.
- Conflict resolution shows a before/after preview of differing values. The learner can choose local or cloud. After resolution, a "restore local snapshot" option is available in account settings for 7 days.
- Paid-plan copy cites the Wong, Cheung, Ngan, and Wong 2025 research results and contains no guaranteed-outcome language ("you WILL develop perfect pitch," "guaranteed AP," "100% success").
- Entitlement failures must not corrupt local progress. Pro-gated features lock; local training continues.
- Cancellation, lapse, and downgrade paths all display clear, honest state transitions without data loss.
- Account deletion requires two explicit confirmation steps (native `<dialog>`) and discloses which data is retained for legal reasons before the learner confirms.

## Data and Analytics Requirements

- Cloud sync records preserve local schema versions via the versioned `SyncEnvelope` type.
- Conflict resolution records store the local and cloud snapshots, the chosen strategy, and resolution timestamp in IndexedDB before any resolution is applied.
- Billing events are stored in a physically separate table from learning analytics. No join between billing-event records and attempt-event records is performed by M23 code.
- Entitlement state is cached via a signed `HttpOnly` cookie (72h TTL); offline grace extends to 96h total before Pro features lock.
- Account export includes synced learning data (attempt events, FSRS state, saved packs, preferences) and entitlement metadata (plan name, purchase date, features). It does not include billing payment method details or raw card numbers.
- The export format is a single JSON file using the `SyncEnvelope` schema with MIME type `application/json`, making it self-documenting and importable by a future migration tool.

## Accessibility Requirements

- Upgrade, billing, entitlement, and sync-conflict flows are keyboard and screen-reader usable.
- Pricing and entitlement status are readable at 375px, 768px, and 1280px viewport widths without horizontal scroll.
- Billing errors have accessible recovery paths announced via `role="alert"`.
- Conflict resolution uses a native `<dialog>` element; focus is trapped; Escape closes without committing.
- All account management flows (sync opt-in, conflict resolution, export, deletion) pass the `Tab`/`Enter`/`Escape`-only smoke test.
- Account deletion dialog uses `role="alertdialog"` and `aria-modal="true"`.

## Module and Architecture Targets

### Server-Only Modules (under `src/lib/server/` — M20 machine-enforced boundary)

| File                                             | Action | Purpose                                                                                                                                                                                                           |
| ------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/billing.ts`                      | Create | `BillingProvider` interface, `EntitlementState` type, `CheckoutParams`, `BillingEvent` types; Stripe adapter implementation                                                                                       |
| `src/lib/server/billing.stub.ts`                 | Create | `InMemoryBillingProvider` — configurable fixture for all unit and Playwright tests; covers all five subscription states and three one-time-purchase states                                                        |
| `src/lib/server/entitlements.ts`                 | Create | `SubscriptionState`, `EntitlementSet`, `EntitlementFeature` types; `resolveEntitlements(userId, adapter)` — DB query + cookie write; `verifyEntitlementToken(token, secret)`                                      |
| `src/lib/server/sync.ts`                         | Create | `SyncEnvelope` type; `mergeEventLogs(local, cloud)` (append-and-dedup by `eventId`); `resolvePreferenceConflict(local, cloud)` (last-write-wins or dialog trigger at <30s delta); `detectConflicts(local, cloud)` |
| `src/lib/server/sync-conflict.ts`                | Create | `ConflictRecord` type; `writeConflictRecord(record)` — IndexedDB write before resolution; `resolveConflict(record, strategy)`                                                                                     |
| `src/lib/server/migrations/002-sync-billing.sql` | Create | Tables: `user_entitlements`, `billing_events`, `sync_records`, `pending_conflicts`                                                                                                                                |

### Account-Layer Client Modules (under `src/lib/account/`)

Account-layer modules **may** import from `src/lib/learning/`. The reverse import is **forbidden**: no file under `src/lib/learning/` may import from `src/lib/account/`. This preserves the free-tier structural guarantee.

| File                                     | Action | Purpose                                                                                                                                                                   |
| ---------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/account/sync-envelope.ts`       | Create | `SyncEnvelope` client-side builder; `buildSyncEnvelope()` assembles versioned payload via `$state.snapshot()` from local stores                                           |
| `src/lib/account/entitlements.svelte.ts` | Create | `createEntitlementState()` factory — reactive wrapper over the entitlement cookie; exposes `.has(feature: EntitlementFeature): boolean`; SSR-safe (reads cookie on mount) |
| `src/lib/account/sync.svelte.ts`         | Create | `createSyncState()` factory — tracks `'idle' \| 'syncing' \| 'conflict' \| 'error'`, last-synced timestamp, pending conflicts queue                                       |
| `src/lib/account/billing.svelte.ts`      | Create | `createBillingState()` factory — tracks `SubscriptionState`, renewal date, billing-error message; reads from server on mount, never from localStorage                     |

### Context Modules

| File                             | Action | Purpose                                                                                                                                                                     |
| -------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/context/entitlement.ts` | Create | `[getEntitlementContext, setEntitlementContext]` — follows the factory+context idiom from `src/lib/state.svelte.ts`; SSR-safe because context is subtree-scoped per request |

### Components (under `src/lib/components/`)

| File                                           | Action | Purpose                                                                                                                             |
| ---------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/feature-gate.svelte`       | Create | Renders `children` snippet when `has(feature)` is true, `locked` snippet otherwise. UX affordance only — not the security boundary. |
| `src/lib/components/sync-status.svelte`        | Create | Sync state badge (`idle/syncing/conflict/error`) with `role="status"`                                                               |
| `src/lib/components/conflict-resolver.svelte`  | Create | Native `<dialog>` conflict UI — shows local vs remote diff, emits `'local-wins' \| 'remote-wins'` strategy                          |
| `src/lib/components/pricing-card.svelte`       | Create | Plan tile: name, price, features, CTA; must not include AP-outcome guarantees; built locally until Cinder component ships           |
| `src/lib/components/subscription-badge.svelte` | Create | Subscription state badge; built locally until Cinder component ships                                                                |

### Routes

All `(account)` routes inherit the M22 authenticated layout guard. The `/pricing` route is public and SSR-rendered.

```
src/routes/
  (account)/
    sync/
      +page.svelte           # Sync opt-in toggle, status, manual trigger
      +page.server.ts        # Load: sync status + pending conflicts; actions: ?/enable, ?/disable, ?/syncNow
      conflicts/
        +page.svelte         # Pending conflict list and resolution UI
        +page.server.ts      # Load: ConflictRecord[]; action: ?/resolve
    billing/
      +page.svelte           # Subscription status, upgrade CTA, cancellation
      +page.server.ts        # Load: live EntitlementState from BillingProvider (never from client cache)
    export/
      +page.svelte           # Export trigger; shows data types; download link
      +page.server.ts        # Action: ?/exportData — streams SyncEnvelope JSON
    delete/
      +page.svelte           # Two-step deletion with native <dialog>
      +page.server.ts        # Action: ?/deleteAccount — DELETE cloud data; retain billing records
  pricing/
    +page.svelte             # Public SSR pricing page with AP variance citation
    +page.ts                 # Universal load for pricing tier data

  api/
    billing/
      webhook/
        +server.ts           # POST: verify Stripe signature, process billing events, update DB
    sync/
      upload/
        +server.ts           # POST: receive SyncEnvelope, merge, respond with merged cloud state
      download/
        +server.ts           # GET: return authoritative cloud state for merge
```

### `src/app.d.ts` Extension

```typescript
declare global {
	namespace App {
		interface Locals {
			user: null | { id: string; email: string }; // from M22
			subscription: SubscriptionState | null; // added in M23
			entitlements: EntitlementSet; // added in M23
		}
	}
}
export {};
```

### Canonical Type Definitions

```typescript
// src/lib/server/sync.ts

/** Wraps all versioned local payloads for a single cloud sync write. */
export type SyncEnvelope = {
	envelopeVersion: 1;
	accountId: string;
	deviceId: string; // stable per-device UUID, stored in localStorage
	capturedAt: number; // Date.now()

	attemptLog: {
		schemaVersion: 1; // matches AttemptEvent.version literal from M00
		events: AttemptEvent[];
	};

	fsrsState: {
		schemaVersion: number; // from FSRS-milestone export envelope
		cards: unknown; // opaque until consuming milestone defines FsrsExport
	};

	settings: {
		schemaVersion: 1;
		payload: PersistedSettings;
	};

	savedPacks: {
		schemaVersion: number;
		packs: unknown; // shape defined by AI Coach / Custom Practice milestone
	};
};
```

```typescript
// src/lib/server/sync-conflict.ts

export type ConflictStrategy = 'local-wins' | 'remote-wins';

/** Written to IndexedDB before any resolution is applied. */
export type ConflictRecord = {
	version: 1;
	detectedAt: number;
	local: SyncEnvelope;
	remote: SyncEnvelope;
	conflictingKeys: string[]; // e.g. ['settings']
	chosenStrategy: ConflictStrategy | null; // null = unresolved
	resolvedAt: number | null;
	resolvedEnvelope: SyncEnvelope | null;
};
```

```typescript
// src/lib/server/billing.ts

export type SubscriptionState =
	'active' | 'canceled' | 'past-due' | 'refunded' | 'expired' | 'grace';

export type EntitlementFeature =
	| 'consumer-pro'
	| 'ap-program'
	| 'specialist-pack:singer'
	| 'specialist-pack:producer'
	| 'specialist-pack:theory';

export type EntitlementSet = Set<EntitlementFeature>;

export type EntitlementState = {
	plan: 'free' | 'consumer-pro' | 'specialist-pack' | 'ap-unlock';
	status: SubscriptionState;
	purchaseType: 'subscription' | 'one-time';
	validUntil: Date | null;
	cachedAt: Date;
};
```

### Database Migration (`src/lib/server/migrations/002-sync-billing.sql`)

```sql
CREATE TABLE IF NOT EXISTS user_entitlements (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT    NOT NULL UNIQUE,
  plan            TEXT    NOT NULL DEFAULT 'free',
  status          TEXT    NOT NULL DEFAULT 'active',
  purchase_type   TEXT    NOT NULL DEFAULT 'subscription',
  valid_until     TEXT,
  updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS billing_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT    NOT NULL,
  event_type      TEXT    NOT NULL,
  provider_event_id TEXT  NOT NULL UNIQUE,
  payload         TEXT    NOT NULL,   -- JSON blob; not joined with learning tables
  occurred_at     TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_records (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT    NOT NULL,
  device_id       TEXT    NOT NULL,
  envelope_version INTEGER NOT NULL,
  captured_at     INTEGER NOT NULL,
  payload         TEXT    NOT NULL,   -- JSON blob of SyncEnvelope
  synced_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
```

### Security Model

Server-side enforcement lives in `src/hooks.server.ts`: for paid routes under `(account)/`, the hook validates the M22 session token, queries the entitlement record from the database via M20's `StorageAdapter`, and returns a redirect to `/pricing` for unauthorized requests. No paid route relies solely on the client `<FeatureGate>` component for access control. The client gate is a UX affordance only.

### `hooks.server.ts` Changes

```typescript
// src/hooks.server.ts (additions)
// 1. Verify entitlement cookie; populate event.locals.entitlements
// 2. On cache miss, query user_entitlements via StorageAdapter
// 3. On DB unavailable, degrade to free-tier entitlements (never throw)
// 4. Guard (account)/* routes: redirect to /pricing for non-authenticated requests
```

### Billing Webhook Handler Contract

`src/routes/api/billing/webhook/+server.ts` (POST):

1. Read raw body via `await request.arrayBuffer()` (required for HMAC verification).
2. Call `billingProvider.constructWebhookEvent(rawBody, request.headers.get('stripe-signature') ?? '')`. Return `new Response(null, { status: 400 })` on failure.
3. Parse event type and account ID from verified payload.
4. Dispatch by type: `customer.subscription.updated`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_succeeded`, `customer.subscription.deleted`, `charge.refunded`.
5. Update the `user_entitlements` DB record via M20's `StorageAdapter` extension.
6. Append a `billing_events` row.
7. Return `new Response(null, { status: 200 })`.

### AP-Claims Grep Gate

```bash
grep -rE "perfect pitch|guaranteed|will learn|100%" src/routes/pricing src/routes/\(account\)
# Must return no matches
```

## Dependencies

- **Milestone 22 — Auth Foundation:** Provides `event.locals.user` (session token, route guard helpers in `src/hooks.server.ts`, user record shape). M23 extends — but does not replace — the M22 auth pattern. M22 also handled local-to-account migration for first import; M23 provides ongoing sync.
- **Milestone 20 — Database Foundation:** Provides `StorageAdapter` interface, `createDatabase()` factory, migration runner, and the `src/lib/server/` isolation boundary. M23 adds migration `002-sync-billing.sql` and extends the adapter with entitlement and billing-event write methods.
- **M00 — Engine and Feasibility Spike:** Provides the `AttemptEvent` type (with `eventId` and immutable event semantics), plus `loadJSON`/`saveJSON`/`localStorageOrNull`/`removeKey` from `src/lib/persistence.ts`. `SyncEnvelope.attemptLog.events` is typed as `AttemptEvent[]`.
- **FSRS milestone (Local FSRS and AP Analytics):** Provides local FSRS card state and the local progress export format. `SyncEnvelope.fsrsState` must match the canonical export type from that milestone's `src/lib/learning/scheduling/` path. Until that type stabilizes, `fsrsState.cards` is typed as `unknown` with a runtime `schemaVersion` check.
- **AI Coach and Custom Practice milestone:** Defines the shape of `savedPacks`. `SyncEnvelope.savedPacks.packs` is typed as `unknown` until that milestone exports a stable type.

## External Dependency Contracts

| Capability                                                      | Owner                                                  | Contract needed                                                                                                                                                                                                                      | Stub / mock plan                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stripe billing (checkout, portal, webhooks, subscription state) | npm `stripe` + Stripe service (external, not ours)     | `BillingProvider` interface defined in `src/lib/server/billing.ts`; Stripe adapter in same file; Stripe test-mode keys via `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` env vars; Stripe CLI for integration-test webhook forwarding | `InMemoryBillingProvider` in `src/lib/server/billing.stub.ts` — configurable fixture map keyed by `userId`; covers all six subscription states (active, canceled, past-due, refunded, expired, grace) and three one-time-purchase states (owned, refunded, never-purchased) |
| Auth session from M22                                           | Milestone 22 (already a declared dependency)           | `event.locals.user: { id: string; email: string } \| null` from `src/hooks.server.ts`                                                                                                                                                | `createFakeSession(overrides?)` factory in `src/lib/test-helpers/auth.ts` (established by M22)                                                                                                                                                                              |
| Cinder `<PricingCard>` component                                | @lostgradient/cinder (we own it)                       | Props: `{ name: string; price: string; features: string[]; cta: string; onselect: () => void }`                                                                                                                                      | Build locally in `src/lib/components/pricing-card.svelte` until Cinder ships; file Cinder issue for the canonical component                                                                                                                                                 |
| Cinder `<SubscriptionBadge>` component                          | @lostgradient/cinder (we own it)                       | Props: `{ state: SubscriptionState }`                                                                                                                                                                                                | Build locally in `src/lib/components/subscription-badge.svelte` until Cinder ships; file Cinder issue                                                                                                                                                                       |
| `SyncEnvelope.fsrsState` export type                            | FSRS milestone output (`src/lib/learning/scheduling/`) | A stable `FsrsExport` type exported from that milestone; any schema change must bump `SyncEnvelope.envelopeVersion`                                                                                                                  | Type as `unknown` with a runtime `schemaVersion` number check until stable; unit tests mock the shape                                                                                                                                                                       |
| `SyncEnvelope.savedPacks` type                                  | AI Coach milestone output                              | Stable `SavedPacksExport` type                                                                                                                                                                                                       | Type as `unknown` with a runtime `schemaVersion` check                                                                                                                                                                                                                      |
| StorageAdapter extension                                        | M20 `src/lib/server/database.ts`                       | New methods: `upsertEntitlement`, `insertBillingEvent`, `upsertSyncRecord` added to the `StorageAdapter` interface                                                                                                                   | M20's existing in-memory `StorageAdapterStub` in `src/lib/server/database.stub.ts` extended with these methods for all M23 tests                                                                                                                                            |

## Acceptance Criteria

**AC1 — Free local practice is fully independent:**
A Playwright test (`e2e/free-local-practice.spec.ts`) completes a full AP training session, views local analytics, and exports local progress — asserting via network mock that zero requests are made to `/api/sync/`, `/api/billing/`, or any auth endpoint throughout.

**AC2 — Sync opt-in requires explicit consent with data disclosure:**
A Playwright test (`e2e/sync-opt-in.spec.ts`) asserts the sync modal lists all four data types (attempt events, FSRS state, preferences, saved packs) and verifies no call to `/api/sync/upload` fires before the learner confirms.

**AC3 — Conflict resolution shows before/after preview:**
A unit test (`src/lib/server/sync.spec.ts`) verifies `resolvePreferenceConflict` produces a `ConflictRecord` with non-null `conflictingKeys` when timestamps differ by fewer than 30 seconds. A Playwright test (`e2e/sync-conflict.spec.ts`) asserts the conflict dialog shows both local and cloud values and the learner's choice is applied.

**AC4 — Restore local snapshot is available for 7 days after conflict resolution:**
A Playwright test (`e2e/sync-conflict.spec.ts`) navigates to account settings within the 7-day window (clock mocked via `page.clock`) and asserts the "Restore local snapshot" action is present.

**AC5 — Pricing copy contains AP variance caveat and no guaranteed-outcome language:**
A Playwright test (`e2e/upgrade-claims.spec.ts`) asserts `/pricing` contains text matching the Wong et al. 2025 citation and asserts the grep gate `grep -rE "perfect pitch|guaranteed|will learn|100%"` returns no matches across `src/routes/pricing` and `src/routes/(account)`.

**AC6 — Consumer Pro checkout completes in Stripe test mode:**
An integration test (`src/routes/api/billing/webhook/+server.spec.ts`) with Stripe CLI webhook forwarding fires a `customer.subscription.updated` event and asserts the `user_entitlements` DB record transitions to `status: 'active'` and `plan: 'consumer-pro'`.

**AC7 — All subscription entitlement states are handled correctly:**
Unit tests (`src/lib/server/entitlements.spec.ts`) using `InMemoryBillingProvider` verify that each of the six subscription states (active, canceled, past-due, refunded, expired, grace) grants or denies the correct feature set per the entitlement matrix.

**AC8 — All one-time-purchase entitlement states are handled correctly:**
Unit tests (`src/lib/server/entitlements.spec.ts`) using `InMemoryBillingProvider` verify that each of the three one-time states (owned, refunded, never-purchased) grants or denies the correct feature set.

**AC9 — Entitlement offline grace window is enforced at concrete TTL boundaries:**
Unit tests (`src/lib/server/entitlements.spec.ts`) with mocked `Date.now` verify: cache hit within 72h grants Pro without a DB call; at exactly 72h the non-blocking banner renders; at 96h Pro features lock with a recoverable error state.

**AC10 — Account deletion removes learning data and retains billing records:**
An integration test (`src/routes/(account)/delete/+server.spec.ts`) asserts that after a deletion request, the `anonymous_submissions` and `sync_records` tables contain no rows for the user, while the `billing_events` table retains its rows.

**AC11 — Deletion confirmation modal discloses retained billing records:**
A Playwright test (`e2e/delete-account.spec.ts`) asserts the deletion modal contains disclosure text about billing record retention before the learner confirms.

**AC12 — Subscription cancellation transitions cloud sync to read-only:**
A unit test (`src/lib/server/billing.spec.ts`) verifies the downgrade state machine: cancel event → `status: 'canceled'` → cloud sync write-path blocked; read/export path active. A separate unit test verifies that after 30 simulated days, an export notification is enqueued.

**AC13 — Webhook endpoint rejects unverified payloads:**
A unit test (`src/routes/api/billing/webhook/+server.spec.ts`) asserts that a POST with an invalid or missing `stripe-signature` header returns HTTP 400 and makes no `StorageAdapter` calls.

## Test Plan

### Unit Tests

**`src/lib/server/sync.spec.ts` — Merge and Conflict Logic**

- `mergeEventLogs: union of local and cloud event arrays deduplicates by eventId`
- `mergeEventLogs: handles empty local log, empty cloud log, and both empty without throwing`
- `mergeEventLogs: local event retained when eventId exists in both (local-wins on duplicate)`
- `mergeEventLogs: merged log is the same regardless of input order (idempotent union)`
- `resolvePreferenceConflict: returns local settings when localUpdatedAt is more than 30s newer`
- `resolvePreferenceConflict: returns remote settings when cloudUpdatedAt is more than 30s newer`
- `resolvePreferenceConflict: returns ConflictRecord with null chosenStrategy when timestamps differ by fewer than 30s`
- `detectConflicts: returns empty array when local and cloud SyncEnvelopes are identical`
- `detectConflicts: returns conflictingKeys array listing settings when only settings differ`
- `mergeEventLogs: emits no analytics or billing events (spy assertion)`

**`src/lib/server/sync-conflict.spec.ts` — ConflictRecord Persistence**

- `writeConflictRecord: persists ConflictRecord to IndexedDB under vibratone:sync-snapshot:v1`
- `writeConflictRecord: overwrites a previous ConflictRecord for the same detectedAt`
- `resolveConflict with local-wins: sets chosenStrategy to local-wins and resolvedEnvelope to local`
- `resolveConflict with remote-wins: sets chosenStrategy to remote-wins and resolvedEnvelope to remote`
- `resolveConflict: sets resolvedAt to a valid timestamp after resolution`
- `resolveConflict: a ConflictRecord with chosenStrategy null is detectable as unresolved`

**`src/lib/server/entitlements.spec.ts` — Entitlement State Machine**

- `resolveEntitlements: status active grants consumer-pro feature set`
- `resolveEntitlements: status canceled reverts to free tier`
- `resolveEntitlements: status past-due transitions to grace`
- `resolveEntitlements: status refunded (subscription) removes paid entitlements`
- `resolveEntitlements: status expired removes paid entitlements`
- `resolveEntitlements: status grace grants Pro within 24h, blocks beyond 24h`
- `resolveEntitlements: one-time owned grants ap-program feature`
- `resolveEntitlements: one-time refunded transitions to never-purchased`
- `resolveEntitlements: never-purchased returns free feature set only`
- `verifyEntitlementToken: valid signed token within 72h returns EntitlementSet`
- `verifyEntitlementToken: token expired at exactly 72h returns null`
- `verifyEntitlementToken: tampered token returns null`
- `verifyEntitlementToken: does not throw when cookie is absent (SSR/incognito)`
- `entitlement cache: hit within 72h grants Pro without a DB call (adapter spy assertion)`
- `entitlement cache: at 72h expiry triggers refresh and non-blocking banner`
- `entitlement cache: at 96h without refresh, Pro features lock`

**`src/lib/server/billing.spec.ts` — Billing State Machine and Webhook**

- `InMemoryBillingProvider: getEntitlementState returns configured fixture for each state`
- `InMemoryBillingProvider: constructWebhookEvent returns BillingEvent for valid signature`
- `InMemoryBillingProvider: constructWebhookEvent throws for invalid signature`
- `handleWebhookEvent: customer.subscription.updated writes active status to DB`
- `handleWebhookEvent: invoice.payment_failed writes past-due status to DB`
- `handleWebhookEvent: customer.subscription.deleted writes canceled status to DB`
- `handleWebhookEvent: charge.refunded writes refunded status to DB`
- `handleWebhookEvent: does not call analytics event emitter for any billing event type (spy assertion)`
- `handleWebhookEvent: is idempotent — processing the same provider_event_id twice produces the same state`
- `downgrade state machine: cancel event → read-only immediately; 30 days lapsed → export notification enqueued; local data always retained`

**`src/lib/account/sync-envelope.spec.ts`**

- `buildSyncEnvelope: includes all required versioned fields (attemptLog, fsrsState, settings, savedPacks)`
- `buildSyncEnvelope: envelopeVersion is the literal 1`
- `buildSyncEnvelope: capturedAt is a valid Unix timestamp`
- `buildSyncEnvelope: deviceId is stable across two calls within the same session`
- `buildSyncEnvelope: uses $state.snapshot() — result is a plain object, not a reactive proxy`

**`src/lib/server/billing-webhook-handler.spec.ts` (isolation check)**

- `webhook handler: does not import from src/lib/learning/ — billing event processing stays isolated`

### Integration Tests

**`src/routes/api/billing/webhook/+server.spec.ts`**

- `POST /api/billing/webhook: returns 400 for missing stripe-signature header`
- `POST /api/billing/webhook: returns 400 for invalid HMAC signature`
- `POST /api/billing/webhook: processes customer.subscription.updated and returns 200; DB updated`
- `POST /api/billing/webhook: processes invoice.payment_failed and sets status to past-due`
- `POST /api/billing/webhook: processes customer.subscription.deleted and sets status to canceled`
- `POST /api/billing/webhook: billing_events table row written; learning tables untouched`

**`src/routes/api/sync/upload/+server.spec.ts`**

- `POST /api/sync/upload: authenticated user uploads SyncEnvelope; merged log returned`
- `POST /api/sync/upload: unauthenticated request returns 401`
- `POST /api/sync/upload: envelope with invalid schemaVersion returns 422`

**`src/routes/(account)/delete/+server.spec.ts`**

- `DELETE account: sync_records and user profile removed; billing_events row retained`
- `DELETE account: second delete returns 204 or 404, never 500 (idempotent)`
- `DELETE account: triggers confirmation email log entry`

### Playwright E2E Tests

**`e2e/free-local-practice.spec.ts`**

- `free-local-practice [1280x800]: full AP training round completes with zero calls to /api/sync/ or /api/billing/`
- `free-local-practice [1280x800]: local analytics are visible without auth`
- `free-local-practice [375x667]: practice round at phone width completes without horizontal scroll`

**`e2e/sync-opt-in.spec.ts`**

- `sync-opt-in [1280x800]: sync toggle is off by default; enabling shows data-disclosure modal listing all four data types`
- `sync-opt-in [1280x800]: no call to /api/sync/upload fires before explicit confirmation`
- `sync-opt-in [1280x800]: modal can be dismissed with Escape; focus returns to trigger`
- `sync-opt-in [1280x800]: modal announces role="dialog" and aria-labelledby to screen readers`
- `sync-opt-in [375x667]: data-disclosure copy is readable at phone width without overflow`

**`e2e/sync-conflict.spec.ts`**

- `sync-conflict [1280x800]: conflict dialog shows local and cloud values side-by-side`
- `sync-conflict [1280x800]: choosing local-wins applies local values and closes dialog`
- `sync-conflict [1280x800]: after resolution, sync status indicator returns to idle`
- `sync-conflict [1280x800]: dismissing without choosing leaves ConflictRecord.chosenStrategy null; local progress intact`
- `sync-conflict [1280x800]: restore local snapshot option present in account settings within 7-day window (clock mocked)`
- `sync-conflict [1280x800]: conflict dialog is keyboard-navigable (Tab cycles options, Enter confirms)`
- `sync-conflict [375x667]: all conflict options visible without horizontal scroll`

**`e2e/upgrade-claims.spec.ts`**

- `upgrade-claims [1280x800]: /pricing page contains AP variance caveat text (Wong et al. 2025)`
- `upgrade-claims [1280x800]: /pricing page does not contain "guaranteed", "perfect pitch guaranteed", or "100%"`
- `upgrade-claims [375x667]: pricing page readable at phone width without overflow`
- `upgrade-claims [768x1024]: pricing page readable at tablet width`
- `upgrade-claims [1280x800]: entitlement-gate interstitial does not contain guaranteed-outcome language`

**`e2e/entitlement-gate.spec.ts`**

- `entitlement-gate [1280x800]: free user sees upgrade prompt on consumer-pro gated route`
- `entitlement-gate [1280x800]: active subscriber sees paid content without upgrade prompt`
- `entitlement-gate [375x667]: upgrade prompt and CTA are fully visible at phone width`
- `entitlement-gate [1280x800]: past-due subscriber sees entitlement warning; local practice unaffected`
- `entitlement-gate [1280x800]: expired subscriber is redirected to /pricing`
- `entitlement-gate [1280x800]: upgrade prompt CTA is keyboard-navigable; Enter navigates to checkout`
- `entitlement-grace [1280x800]: non-blocking banner renders at 72h cache expiry (page.clock mock)`
- `entitlement-grace [1280x800]: Pro features lock at 96h without refresh`

**`e2e/checkout-flow.spec.ts`**

- `checkout-flow [1280x800]: clicking upgrade CTA initiates checkout session (InMemoryBillingProvider)`
- `checkout-flow [1280x800]: user returns from checkout with Pro entitlement in account settings`
- `cancel-flow [1280x800]: cancel via billing portal; sync immediately shows read-only state`

**`e2e/delete-account.spec.ts`**

- `delete-account [1280x800]: deletion modal discloses retained billing records before confirmation`
- `delete-account [1280x800]: deletion requires two explicit confirmation steps before firing`
- `delete-account [1280x800]: after deletion, local AP practice still works (localStorage untouched)`
- `delete-account [1280x800]: deletion dialog uses role="alertdialog" and aria-modal="true"`
- `delete-account [375x667]: confirm and cancel buttons both visible at phone width`

**`e2e/account-export.spec.ts`**

- `account-export [1280x800]: export downloads a JSON file containing envelopeVersion field`
- `account-export [1280x800]: export JSON does not contain billing payment method details`
- `account-export [1280x800]: export button is keyboard-reachable (Tab) and activatable (Enter)`

## Verification

Run in this order:

```bash
bun run check
bun run lint
bun run build
bun run test:unit -- --run
bun run test:e2e
```

`bun run build` is a required gate (inherited from M20): proves no `src/lib/server/*` module is imported by any client bundle. M23 adds more server-only modules (`billing.ts`, `entitlements.ts`, `sync.ts`) so the gate is strictly more important here.

**AP-claims grep gate (run after `bun run lint`):**

```bash
grep -rE "perfect pitch|guaranteed|will learn|100%" src/routes/pricing src/routes/\(account\)
# Expected: no output
```

**Build isolation check:**

```bash
grep -r "from.*lib/server" src/lib/account/ src/lib/components/ src/routes/+page.svelte
# Expected: no output (server imports must not appear in client-loadable paths)
```

**Manual checks after `bun run dev`:**

- Navigate to the practice route without signing in. Confirm a full AP round completes and local analytics are visible. Open browser Network panel and confirm no requests to `/api/sync/` or `/api/billing/`.
- Sign in as a test user. Navigate to account settings. Enable sync. Confirm the opt-in modal lists all four data types. Click Cancel. Confirm no upload fires.
- Simulate a conflict by modifying `vibratone:settings` in localStorage on one "device" (tab) and the server record on another. Reload. Confirm the conflict dialog appears.
- Navigate from an active practice session to `(account)/billing`. Return to practice. Confirm no zombie audio timer fires.
- Open `(account)/delete`. Confirm the deletion modal names which data will be deleted and which billing records will be retained before the confirm button is enabled.

## Non-Goals

- Do not require paid plans for local AP training, local FSRS scheduling, local analytics, local export, or daily puzzles. Any feature available in local-only mode before this milestone remains free.
- Do not add cloud classroom workflows (M24 scope).
- Do not add community content, public profiles, or leaderboards.
- Do not hide local export behind an account.
- Do not add a native mobile application.
- Do not implement AI coach with cloud history (cloud history is unlocked here as a Pro feature; the AI coach integration itself is a later milestone concern).
- Do not extract the billing or sync layer into a separate package. It stays in `src/lib/server/` within Vibratone.
- Do not add per-submission deletion tokens for anonymous aggregate data (M20/M21 scope; already decided as irrevocable).

## Completion Signal

This milestone is complete when:

1. `bun run build` exits 0 with no `src/lib/server/` client-import warnings.
2. `bun run test:unit -- --run` passes all named tests in `sync.spec.ts`, `sync-conflict.spec.ts`, `entitlements.spec.ts`, `billing.spec.ts`, `billing-webhook-handler.spec.ts`, and `sync-envelope.spec.ts`.
3. All integration tests in `webhook/+server.spec.ts`, `upload/+server.spec.ts`, and `delete/+server.spec.ts` pass.
4. `bun run test:e2e` passes all named Playwright specs: `free-local-practice.spec.ts`, `sync-opt-in.spec.ts`, `sync-conflict.spec.ts`, `upgrade-claims.spec.ts`, `entitlement-gate.spec.ts`, `checkout-flow.spec.ts`, `delete-account.spec.ts`, and `account-export.spec.ts`.
5. The AP-claims grep gate returns no matches.
6. Every existing Playwright spec from M00–M22 passes without modification, confirming no local-first flow was regressed.
7. A manual check confirms a full AP training session completes with zero network calls to billing or sync endpoints in the unauthenticated path.
