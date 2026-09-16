# 17. AI Coach and Custom Practice

## Outcome

A learner receives a deterministic coaching recommendation with a plain-prose explanation of why the recommended drill was chosen—derived entirely from local FSRS and confusion data, with no AI provider required. The interleaved scheduler, custom drill builder, and saved packs build on this foundation in the delivery order defined in the Intra-Milestone Delivery Order section. If the milestone runs long, items 2–4 in that order defer to a follow-on without losing the minimum-viable outcome.

## Product Requirements

- Add deterministic recommendations from local analytics: weak pitch classes, confusion pairs, FSRS retention state, and suggested sessions.
- Add "why this drill" explanations generated from deterministic data first.
- Add an opt-in AI rewrite of deterministic explanations using a user-supplied API key stored in `localStorage`. The key and a structured analytics summary (defined in the AI Data Contract section) are sent directly from the browser to the AI provider's API. No server-side proxy is introduced in this milestone; server infrastructure for AI is explicitly deferred to after Milestone 20 (Database Foundation).
- The user must acknowledge a data disclosure panel before the API key is saved. The disclosure names which fields are sent (weak pitch-class labels, confusion pairs, FSRS due counts by track, selected tracks) and which are never sent (raw audio, full review logs, FSRS stability/difficulty values, microphone data, PII).
- Add a custom drill builder that spans all four tracks: AP, Relative Pitch (scale-degree, interval, chord), Theory, and Producer. Producer drills are in scope because Milestone 15 ships before this milestone.
- Add an interleaved practice scheduler that mixes due cards across user-selected tracks.
- Add saved practice packs.
- Add share links for custom drill configurations.
- Keep a deterministic fallback at all times; AI rewrite is purely cosmetic—a plain-text overlay on text that already exists.

### AI Provider Model (resolved)

The AI rewrite feature uses a user-supplied API key stored in `localStorage` under `vibratone:ai-coach-key`. The key and a structured analytics summary are sent directly from the browser to the provider's API endpoint. The user selects a provider from a radio selector in `ai-coach-settings.svelte`: either `'openai'` or `'anthropic'`. Both providers support direct browser requests when the appropriate header is set (`anthropic-dangerous-direct-browser-access: true` for Anthropic; OpenAI permits browser-origin requests by default). No SDK npm package is required; both providers accept raw `fetch` calls with the correct headers. A Vibratone-owned server proxy is explicitly deferred until after Milestone 20 (Database Foundation).

**Provider call shapes (raw fetch, no SDK):**

- Anthropic: `fetch('https://api.anthropic.com/v1/messages', { headers: { 'x-api-key': key, 'anthropic-dangerous-direct-browser-access': 'true', 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, messages, max_tokens }) })`
- OpenAI: `fetch('https://api.openai.com/v1/chat/completions', { headers: { 'Authorization': 'Bearer ' + key }, body: JSON.stringify({ model, messages }) })`

`MockAiClient` returns a deterministic fixture string and is the default in all unit and Playwright tests. No AI SDK `import()` is required; zero AI SDK code is evaluated when the feature is not configured.

### AI Usage State Schema (resolved)

```ts
// stored in localStorage under 'vibratone:ai-coach-state'
interface AiCoachState {
	enabled: boolean;
	provider: 'openai' | 'anthropic';
	keyDisplayHint: string; // last 4 chars of the key only, for display
	callCount: number;
	lastCalledAt: string | null; // ISO 8601 timestamp
}
```

The `provider` field is constrained to `'openai' | 'anthropic'` only. The API key itself is stored separately under `vibratone:ai-coach-key` and is never included in analytics events, exports, share links, or the `AiCoachState` record.

### AI Data Contract (resolved)

The only data sent to the AI provider in a coach rewrite request is a structured text summary. Permitted fields:

- Up to 12 weak pitch-class labels (e.g., "F#, Bb, D").
- Up to 5 confusion pairs as note-name strings (e.g., "G confused with A").
- FSRS state summary: count of due cards by track; no card IDs, no stability or difficulty values.
- The user's selected tracks (e.g., "AP, Relative Pitch").

Excluded from AI requests: raw audio data, `Float32Array`, `AudioBuffer`, `Blob`, full review logs, FSRS card stability or difficulty parameters, microphone data of any kind, and any personally identifiable information.

### Provider Selection UX

Provider selection lives in `src/lib/components/ai-coach-settings.svelte`. This component renders:

- A disclosure panel (`<details>` element or element with `role="dialog"`) naming every sent field and every excluded field.
- A provider radio selector (`openai` / `anthropic`).
- An API key input (`type="password"`, `autocomplete="off"`).
- A Save button with `aria-disabled` set to `true` until the disclosure checkbox has been checked.

The Save button must not write to `localStorage` under `vibratone:ai-coach-key` until the disclosure checkbox is acknowledged. `ai-coach-settings.svelte` is instantiated on the `/coach` route inside a conditional block: shown when `AiCoachState.enabled` is `false` and the user requests AI explanations. It is not a separate route.

### Share-Link Format (resolved)

Share links use URL-safe base64-encoded JSON appended as a single `?pack=` query parameter. The payload is a `CustomDrillConfig` object with a `schemaVersion` field. Maximum encoded size: 2 KB. Configurations exceeding 2 KB after encoding fail validation before the share-link button is enabled, and the user sees a human-readable error. Decoding an unrecognized `schemaVersion` surfaces a recoverable error state—not a blank page or unhandled exception.

### Intra-Milestone Delivery Order

To manage risk, features ship in this order. If the milestone runs long, later items defer to a follow-on without breaking the stated learner outcome.

1. Deterministic recommendations + coach-card UI (must-have; the learner outcome depends on this alone).
2. Interleaved scheduler + saved practice packs.
3. Share links for custom drills and packs.
4. AI-rewritten explanations—ships if and only if **both** of the following are true before milestone close: (a) the `rewriteExplanation()` Playwright test (`coach page shows AI-rewritten explanation when valid key is configured`) passes against a live `MockAiClient` without flakiness across three consecutive CI runs, and (b) the data disclosure gate Playwright test (AC-17-16) passes. If either condition is unmet at milestone close, AI-rewritten explanations are deferred to a follow-on spike.

### Kill Criteria

- If the AI rewrite feature requires any server-side infrastructure (proxy, key management, rate limiting) to function safely, that portion is deferred to after Milestone 20 (Database Foundation).
- If share-link decoding requires a lookup service rather than pure URL encoding, share links are descoped to URL-only configurations without saved-pack sharing.

## User Experience Requirements

- The learner sees what to practice next and why, in plain prose, before starting any drill.
- AI output is never the only source of a recommendation; deterministic text is always present and always the primary output.
- Custom drill configuration must be reviewable before the learner starts.
- Share links reconstruct the same drill configuration on load.
- Interleaved practice must respect selected tracks; AP-only learners receive no Relative Pitch or Producer prompts.
- Explanation text is always plain prose—no markdown. The AI rewrite prompt instructs the model to return plain text only, eliminating any `{@html}` or sanitization question. The `coach-card` component renders AI output as a text node, never parsed as HTML.

## Data and Analytics Requirements

- Recommendation inputs are local and inspectable. `buildCoachPayload()` is a pure function consuming local analytics state only.
- Store custom drill configurations under `vibratone:custom-drill-configs` in `localStorage` using the existing `saveJSON`/`loadJSON` pattern from `src/lib/persistence.ts`.
- Store saved practice pack metadata under `vibratone:drill-packs` in `localStorage` using the same pattern.
- Store AI usage state under `vibratone:ai-coach-state` (schema above). Store the API key separately under `vibratone:ai-coach-key`.
- Track interleaved-session composition by track and card type, appended to `localStorage` under `vibratone:interleaved-sessions:v1` as `InterleavedSessionEvent` objects.
- The local progress export function `exportLocalProgress()` (added to `src/lib/persistence.ts`) must never include the AI API key value. An export generated after a key is saved contains no field matching the key.

## Accessibility Requirements

- Recommendation explanations are text-first and are the first visible content on the coach surface.
- The drill builder must be fully keyboard navigable: every control is reachable and activatable using Tab, Space, and Enter alone, with no mouse required.
- Share-link copy success or failure is announced via an `aria-live="polite"` region. The region is **always rendered in the DOM**—not conditionally mounted—so the text change triggers the announcement rather than DOM insertion. The region announces "Link copied to clipboard" on success or "Failed to copy — link shown below" on failure. The message clears after 4000 ms via a `setTimeout` cleaned up in `onDestroy`. Tests for this clearance must use `vi.useFakeTimers()` / `vi.advanceTimersByTime(4001)`—no real wall-clock waits.
- Interleaved sessions clearly identify the current track and prompt type in a visible, screen-reader-exposed `<h2>` or labelled region that updates on each new prompt via `aria-live="polite"`.

## Module and Architecture Targets

All new code lands in the following locations. No additional directories beyond those named here are introduced.

### learning/ modules

| File                                                 | Exports / Responsibility                                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/learning/analytics/coach-payload.ts`        | `CoachPayload` type, `buildCoachPayload()` pure function consuming local analytics state                                                                           |
| `src/lib/learning/analytics/coach-payload.spec.ts`   | Unit tests for payload shape and audio-primitive exclusion                                                                                                         |
| `src/lib/learning/analytics/recommendations.ts`      | `WeakConceptSummary`, `ConfusionPair`, `RecommendationSet`, `deterministicRecommendations()`                                                                       |
| `src/lib/learning/analytics/recommendations.spec.ts` | Unit tests                                                                                                                                                         |
| `src/lib/learning/analytics/coach-ai.ts`             | `AiCoachState`, `CoachAiDisabledError`, `rewriteExplanation()`, `MockAiClient` — browser fetch to provider API, deterministic fallback on any error                |
| `src/lib/learning/analytics/coach-ai.spec.ts`        | Unit tests (including static import assertion, runtime behavioral check, and `MockAiClient` spy)                                                                   |
| `src/lib/learning/analytics/session-events.ts`       | `InterleavedSessionEvent` type, `appendInterleavedSessionEvent()`, `loadInterleavedSessionLog()`, `INTERLEAVED_SESSIONS_KEY = 'vibratone:interleaved-sessions:v1'` |
| `src/lib/learning/analytics/session-events.spec.ts`  | Unit tests                                                                                                                                                         |
| `src/lib/learning/scheduling/interleave.ts`          | `TrackId`, `DueCard`, `InterleavingPolicy`, `mergeQueues()`, `filterBySelectedTracks()`                                                                            |
| `src/lib/learning/scheduling/interleave.spec.ts`     | Unit tests                                                                                                                                                         |
| `src/lib/learning/scheduling/practice-pack.ts`       | `DrillPackMetadata`, `isDrillPackMetadata()`, `savePack()`, `loadPacks()`, `deletePack()`                                                                          |
| `src/lib/learning/scheduling/practice-pack.spec.ts`  | Unit tests                                                                                                                                                         |
| `src/lib/learning/drills/custom-drill.ts`            | `CustomDrillConfig`, `ConceptSelector`, `validateCustomDrill()`, `isCustomDrillConfig()`, `CUSTOM_DRILL_CONFIGS_KEY`, `DRILL_PACKS_KEY`                            |
| `src/lib/learning/drills/custom-drill.spec.ts`       | Unit tests                                                                                                                                                         |
| `src/lib/learning/drills/share-link.ts`              | `encodePack()`, `decodePack()`, `PackTooLargeError`, `SchemaVersionError`, `MalformedPackError`                                                                    |
| `src/lib/learning/drills/share-link.spec.ts`         | Unit tests                                                                                                                                                         |

### Type Contracts

#### `TrackId` and `DueCard` (`src/lib/learning/scheduling/interleave.ts`)

```ts
export type TrackId = 'ap' | 'relative-pitch' | 'theory' | 'producer';

export type DueCard = {
	/** Stable unique key: protocol-specific identity encoded as a string. */
	id: string;
	track: TrackId;
	drillType: string;
	dueAt: number; // Unix ms
	fsrsState: FSRSCardState; // from learning/scheduling, established in M05
	/** Protocol-specific identity bag — opaque to the interleaver. */
	cardIdentity: Record<string, unknown>;
};

export type InterleavingPolicy = 'sequential' | 'random' | 'fsrs-due';
```

Each protocol module exports a `toDueCard(fsrsCard): DueCard` adapter. The interleaver is agnostic to per-track encoding.

**Merge algorithm (concrete):**

```ts
/**
 * Merge and filter due-card queues from multiple tracks.
 * @param queues - One array per track, in track registration order.
 * @param selectedTracks - Only cards whose track is in this list are returned.
 * @param policy - Sort/ordering strategy.
 * @param seed - Optional integer seed for deterministic Fisher-Yates shuffle
 *   when policy is 'random'. When omitted, Date.now() is used (non-deterministic).
 */
export function mergeQueues(
	queues: DueCard[][],
	selectedTracks: TrackId[],
	policy: InterleavingPolicy,
	seed?: number
): DueCard[];
```

The function: filters to cards whose `track` is in `selectedTracks`; sorts ascending by `dueAt` when policy is `'fsrs-due'` (ties broken by `id` lexicographic order for determinism); maintains insertion order by track when policy is `'sequential'`; applies a seeded Fisher-Yates shuffle when policy is `'random'` (seed required for deterministic tests); returns the deduplicated result—no card `id` appears twice. When `selectedTracks` is empty, returns an empty array.

#### `CustomDrillConfig` (`src/lib/learning/drills/custom-drill.ts`)

```ts
export type CustomDrillConfig = {
	schemaVersion: 1;
	id: string; // crypto.randomUUID()
	createdAt: number; // Date.now()
	tracks: TrackId[];
	drillTypes: string[];
	eligibleConcepts: ConceptSelector[];
	interleavingPolicy: InterleavingPolicy;
};

export type ConceptSelector =
	| { track: 'ap'; pitchClasses: number[]; timbres: string[] }
	| { track: 'relative-pitch'; scaleDegrees: number[]; modes: string[] }
	| { track: 'theory'; conceptTypes: string[] }
	| { track: 'producer'; drillTypes: string[]; parameters: string[] };

export const CUSTOM_DRILL_CONFIGS_KEY = 'vibratone:custom-drill-configs';
export const DRILL_PACKS_KEY = 'vibratone:drill-packs';
```

`isCustomDrillConfig()` is a runtime type guard following the `isScore()` / `isPersistedSettings()` pattern: validates all fields, returns `value is CustomDrillConfig`. It is the only path through `loadJSON` for this type—no assertion casts. `isCustomDrillConfig` must reject: (a) missing or non-`1` `schemaVersion`, (b) empty `tracks` array, (c) unknown `TrackId` values. `validateCustomDrill` must reject: zero eligible pitch classes, octave range where `lo > hi`, empty `drillTypes`, and unknown `TrackId` values.

#### `DrillPackMetadata` (`src/lib/learning/scheduling/practice-pack.ts`)

```ts
export type DrillPackMetadata = {
	id: string;
	name: string;
	configIds: string[];
	selectedTracks: TrackId[];
	createdAt: number;
	lastRunAt: number | null;
};
```

`isDrillPackMetadata()` type guard follows the same pattern.

#### `CoachPayload` (`src/lib/learning/analytics/coach-payload.ts`)

```ts
export type CoachPayload = {
	weakPitchClasses: string[]; // at most 12 labels
	confusionPairs: string[]; // at most 5, e.g. "G confused with A"
	fsrsDueCounts: Record<TrackId, number>; // no card IDs, no stability/difficulty
	selectedTracks: TrackId[];
	// Structural guarantee: no audio-related field can appear here.
};
```

`buildCoachPayload()` is a pure function consuming local analytics state. It never reads microphone data or any browser audio API. A TypeScript compile-time assertion confirms no field on `CoachPayload` is assignable to `ArrayBuffer` or `AudioBuffer`.

#### `InterleavedSessionEvent` (`src/lib/learning/analytics/session-events.ts`)

```ts
export type InterleavedSessionEvent = {
	version: 1;
	sessionId: string;
	slotIndex: number;
	trackId: TrackId;
	drillId: string;
	cardId: string; // FSRS card identity from Milestone 05
	dueAt: number; // FSRS due timestamp
	completedAt: number; // Date.now() after slot completes
};

export const INTERLEAVED_SESSIONS_KEY = 'vibratone:interleaved-sessions:v1';
```

### src/routes/ (new routes)

| Route                                     | Purpose                                                                                                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/coach/+page.svelte`           | Deterministic recommendations with optional AI-rewritten explanation overlay; hosts `ai-coach-settings.svelte` when `AiCoachState.enabled` is `false`                             |
| `src/routes/coach/+page.svelte.test.ts`   | Component tests: no-AI-key fallback, recommendation display, disclosure gate                                                                                                      |
| `src/routes/builder/+page.svelte`         | Multi-track custom drill builder with pre-start config review                                                                                                                     |
| `src/routes/builder/+page.svelte.test.ts` | Component tests: keyboard navigation, validation states                                                                                                                           |
| `src/routes/builder/+page.ts`             | Universal load: decodes `?pack=` query param, validates schema via `isCustomDrillConfig`, returns parsed config or error shape—runs SSR-safely without `window` or `localStorage` |
| `src/routes/packs/+page.svelte`           | Saved packs list                                                                                                                                                                  |
| `src/routes/packs/+page.svelte.test.ts`   | Component tests: empty state, pack display                                                                                                                                        |
| `src/routes/packs/[packId]/+page.svelte`  | Pack detail and run—loads pack from `localStorage` by id                                                                                                                          |

No `+page.server.ts` or `+server.ts` files are introduced in this milestone. All persistence is `localStorage`-only. The AI API call originates in the browser. A server-side AI proxy is a non-goal explicitly deferred to after Milestone 20.

### src/lib/components/ (new components)

| Component                                       | Props / Responsibility                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/coach-card.svelte`          | `recommendation: WeakConceptSummary`, `explanation: string`, `provenance: 'deterministic' \| 'ai'` — shows plain-text explanation as a text node (never `{@html}`), source badge, and a "why this drill" section                                                                                                                                           |
| `src/lib/components/ai-coach-settings.svelte`   | `onSave: (provider: 'openai' \| 'anthropic', key: string) => void`, `onDisable: () => void` — disclosure panel, provider radio selector, API key input (`type="password"`, `autocomplete="off"`), Save button (`aria-disabled` until disclosure acknowledged). Key written to `localStorage` only after disclosure checkbox is checked and Save activated. |
| `src/lib/components/drill-builder-form.svelte`  | `onsubmit: (config: CustomDrillConfig) => void` — keyboard navigable; shows per-field inline validation errors; Start button disabled until `validateCustomDrill(config)` returns no errors (equivalently, while the builder state's `$derived` `isValidConfig` is `false`)                                                                                |
| `src/lib/components/interleaved-session.svelte` | Wraps an active interleaved practice run; announces `currentTrack` and `promptType` via `aria-live="polite"` on each prompt                                                                                                                                                                                                                                |
| `src/lib/components/share-action.svelte`        | Local stub: `navigator.clipboard.writeText()` with the `aria-live="polite"` pattern—always mounted in DOM, announces copy result, clears after 4000 ms via `setTimeout`. Deleted when Cinder #322 ships.                                                                                                                                                   |

### State Factories

Follow the existing `createPracticeState()` + `createContext` pattern from `src/lib/state.svelte.ts` exactly. Module-level `$state` is forbidden for any per-session or per-user data—it leaks across SSR requests.

Three new factories, each instantiated once in the relevant `+page.svelte`, distributed via `setContext`, torn down in `onDestroy`:

- **`createCoachState()`** in `src/lib/state/coach.svelte.ts` — contains `recommendations` (`$derived` from local FSRS/analytics data), `savedPacks` (`$state<DrillPackMetadata[]>` loaded via `loadJSON`), `savedConfigs` (`$state<CustomDrillConfig[]>`), `aiExplanation` (`$state<string | null>`), `provenance` (`$state<'deterministic' | 'ai'>('deterministic')`), `savePack()` deliberate action, `requestAiExplanation()` user-triggered action. AI fetch is never called automatically. On AI failure after a prior successful call, `provenance` reverts to `'deterministic'`.
- **`createBuilderState()`** in `src/lib/state/builder.svelte.ts` — builder form state. `isValidConfig` is `$derived(selectedTracks.length > 0 && drillTypes.length > 0)`. Start button is `disabled={!isValidConfig}`.
- **`createPackState()`** in `src/lib/state/packs.svelte.ts` — saved pack metadata, loaded via `loadJSON`.

Large attempt-event arrays use `$state.raw` (replacement semantics). Saves are deliberate actions—never inside a `$effect`.

### Persistence Keys and Extensions

Extend `src/lib/persistence.ts` with:

```ts
export const CUSTOM_DRILL_CONFIGS_KEY = 'vibratone:custom-drill-configs';
export const DRILL_PACKS_KEY = 'vibratone:drill-packs';
export const AI_COACH_STATE_KEY = 'vibratone:ai-coach-state';
// The API key itself lives under 'vibratone:ai-coach-key' — not a typed constant.

/**
 * Collect all vibratone:* localStorage keys except vibratone:ai-coach-key,
 * serialize as a JSON object keyed by storage key name, and return the JSON string.
 * Must not read vibratone:ai-coach-key at any point.
 */
export function exportLocalProgress(): string;
```

Add unit test to `src/lib/persistence.spec.ts`:

- `exportLocalProgress does not include vibratone:ai-coach-key value when the key is present in localStorage`

### Share-Link Codec (`src/lib/learning/drills/share-link.ts`)

```ts
/** Encode a CustomDrillConfig as a URL-safe base64 string. Throws PackTooLargeError if > 2 KB. */
export function encodePack(config: CustomDrillConfig): string;

/** Decode a ?pack= token. Throws SchemaVersionError or MalformedPackError on any failure. */
export function decodePack(token: string): CustomDrillConfig;

export class PackTooLargeError extends Error {}
export class SchemaVersionError extends Error {}
export class MalformedPackError extends Error {}
```

`decodePack` throws typed errors rather than returning `null` so callers can distinguish the failure mode. `+page.ts` catches and maps these to a recoverable UI error state. The schema-version check is explicit (`value.schemaVersion !== 1 → SchemaVersionError`). In development, a `console.warn` with the failure reason is emitted before throwing.

## Dependencies

- **Milestone 13** (Theory Explorers and Natural-Language Drill Builder)—the drill schema, the natural-language drill-builder validator, Octavian #28/#29 usage patterns, and the theory-track card identity that the custom drill builder extends.
- **Milestone 11** (Relative Pitch and Singer Track)—scale-degree card identity (`scaleDegree × key × mode`), RP FSRS card state, and `toDueCard()` adapter for the relative-pitch track.
- **Milestone 15** (Producer Track)—producer card identity (`drillType × parameter`), producer FSRS card state, and `toDueCard()` adapter for the producer track. Because M15 ships before this milestone, producer drills are in scope for the custom drill builder and cross-track interleaver.

The FSRS/analytics contract (`FSRSCardState`, `AttemptEvent`, `loadJSON`/`saveJSON`) originates in Milestone 05 (Local FSRS and AP Analytics) and flows through the track milestones above. It is consumed via those milestones' exports; Milestone 05 is not a direct dependency of this milestone.

**Acyclicity confirmed:** all direct deps (11, 13, 15) have lower milestone numbers than 17. FSRS/analytics (Milestone 05) and answer-surfaces work (Milestone 06) are available transitively through those milestones. No forward dependency.

## External Dependency Contracts

| Dependency                              | Contract                                                                                                                                                                                                                                                                                                  | Owning Ticket                                                     | Stub / Mock Plan                                                                                                                                                                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `octavian/sequences` (drill generation) | `generateDrillSequence(config: CustomDrillConfig, seed: number): DrillPrompt[]` — deterministic given a seed                                                                                                                                                                                              | Octavian [#28](https://github.com/stevekinney/octavian/issues/28) | `src/lib/stubs/octavian-drill-generator.stub.ts` — seed-based Fisher-Yates shuffle over a concept array, same type signature. Deleted when #28 ships.                                                                                                            |
| `octavian/sequences` (symbol parsing)   | `parseSymbol(input: string): Note \| Interval \| Chord \| null` — recognizes note names, solfege, scale-degree numbers, chord tokens                                                                                                                                                                      | Octavian [#29](https://github.com/stevekinney/octavian/issues/29) | Builder v1 accepts only values from a predefined picklist; free-text parsing is gated on #29. Stub: `src/lib/stubs/octavian-symbol-parser.stub.ts` returns `null` for any input not in the picklist. Deleted when #29 ships.                                     |
| Cinder share action                     | `<ShareAction payload={string} onsuccess={() => void} onfailure={() => void} />` — Web Share API with clipboard fallback and `aria-live` region                                                                                                                                                           | Cinder [#322](https://github.com/stevekinney/cinder/issues/322)   | `src/lib/components/share-action.svelte` — local stub using `navigator.clipboard.writeText()` with the `aria-live="polite"` pattern. Always mounted in DOM. Deleted when #322 ships. The stub must pass the same accessibility assertions as the real component. |
| AI provider (OpenAI)                    | `fetch('https://api.openai.com/v1/chat/completions', { headers: { Authorization: 'Bearer ' + key }, body: JSON.stringify({ model, messages }) })` — raw fetch, browser-origin permitted by default                                                                                                        | None (internal)                                                   | `MockAiClient` exported from `src/lib/learning/analytics/coach-ai.ts`—returns deterministic fixture text. Used as default in all unit and Playwright tests.                                                                                                      |
| AI provider (Anthropic)                 | `fetch('https://api.anthropic.com/v1/messages', { headers: { 'x-api-key': key, 'anthropic-dangerous-direct-browser-access': 'true', 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, messages, max_tokens }) })` — raw fetch, browser-origin permitted with the dangerous-access header | None (internal)                                                   | Same `MockAiClient`                                                                                                                                                                                                                                              |
| Progress export function                | `exportLocalProgress(): string` — serializes all `vibratone:*` localStorage keys except `vibratone:ai-coach-key` as a JSON object, returns the JSON string                                                                                                                                                | None (internal)                                                   | Implement directly in `src/lib/persistence.ts`; no external dep.                                                                                                                                                                                                 |
| FSRS card state                         | `FsrsCard` with `due: number`, `stability: number`, `difficulty: number`, `state: 'new' \| 'learning' \| 'review' \| 'relearning'`; `getWeakCards(tracks: TrackId[]): FsrsCard[]`; `getConfusionMatrix(): ConfusionMatrix`                                                                                | Milestone 05 (`learning/scheduling/fsrs.ts`)                      | If Milestone 05 has not shipped when work begins, stub `FsrsCard` locally and replace the import when available. Stub `getWeakCards` to return all cards with `due <= Date.now()` and `getConfusionMatrix` to return an empty record.                            |

## Acceptance Criteria

Each criterion is a concrete pass/fail check.

**AC-17-01 (Deterministic fallback):** Given the AI API key is absent or `AiCoachState.enabled` is `false` or the AI provider returns a 5xx error, `deterministicRecommendations()` returns a non-empty `RecommendationSet` generated solely from local FSRS due state and confusion-pair data. Verified by a unit test that stubs `rewriteExplanation` to throw and asserts the fallback result is non-empty.

**AC-17-02 (AI data isolation):** The payload serialized and sent to the AI provider contains only permitted fields (`weakPitchClasses`, `confusionPairs`, `fsrsDueCounts`, `selectedTracks`) and the API key appears only in the request header—never in the serialized request body. Verified by two unit tests in `coach-ai.spec.ts`: (1) spy on the fetch body argument, JSON-parse it, and assert no property is named `stability`, `difficulty`, `reviewLog`, `fullHistory`, or any audio-type field; (2) assert the API key is present in the `Authorization` or `x-api-key` header and absent from the parsed body. Also assert: `weakPitchClasses` has length ≤ 12; `confusionPairs` has length ≤ 5; no value fails the audio-primitive check.

**AC-17-03 (Share-link round-trip):** Given a `CustomDrillConfig` object, `encodePack(config)` followed by `decodePack(result)` returns an object deeply equal to the original. Verified by unit tests covering at least 3 distinct config shapes (AP-only, multi-track with all four tracks, maximum-complexity near the size limit).

**AC-17-04 (Share-link size gate):** Given a `CustomDrillConfig` whose base64-encoded JSON exceeds 2 KB, `encodePack(config)` throws `PackTooLargeError`. Verified by unit tests at exactly 2048 bytes (succeeds) and exactly 2049 bytes (throws).

**AC-17-05 (Stale schema version):** Given a `?pack=` query parameter whose decoded `schemaVersion` field does not match `1`, the builder route renders a recoverable error state with a human-readable message. Verified by a Playwright test that navigates to a URL with a synthetically stale `schemaVersion`.

**AC-17-06 (Malformed share link):** Given a `?pack=` query parameter that is not valid base64 or not valid JSON, the builder route renders a recoverable error state. Verified by a Playwright test that navigates to a URL with a corrupt `?pack=` value.

**AC-17-07 (Interleave track isolation):** Given a learner who has selected only the AP track, `mergeQueues()` returns cards exclusively from the AP card pool. Verified by a unit test with a seeded card store containing AP, Relative Pitch, Theory, and Producer cards, asserting the output array contains no non-AP card ids.

**AC-17-08 (Interleave ordering):** Given a mixed queue with the `'fsrs-due'` policy, `mergeQueues()` returns cards sorted ascending by `dueAt`, with ties broken by card `id` lexicographic order. Verified by a unit test asserting `result[i].dueAt <= result[i+1].dueAt` for all adjacent pairs, and that a tie-break test with equal `dueAt` values produces lexicographic order by `id`.

**AC-17-09 (No duplicate cards):** `mergeQueues()` never returns the same card `id` twice in one result. Verified by a unit test with cards intentionally duplicated across track inputs.

**AC-17-10 (Saved pack persistence):** Given a learner who saves a practice pack and reloads the page, the pack appears in the packs list with its original name and configuration. Verified by a Playwright test that creates, saves, reloads, and asserts pack presence.

**AC-17-11 (Invalid custom drill blocked):** Given a `CustomDrillConfig` with no tracks selected, `validateCustomDrill(config)` returns a validation error and the drill start button is disabled. Per-field inline errors are shown (not a single top-level message). Verified by a unit test and a Playwright test.

**AC-17-12 (Keyboard-navigable builder):** A keyboard-only user can complete the full build flow—open builder, select tracks, configure filters, preview configuration, save pack, and copy share link—without using a pointing device. Verified by a Playwright test using keyboard-only navigation (Tab, Space, Enter) throughout.

**AC-17-13 (Share-link copy announcement):** When the share-link copy action completes, an element with `aria-live="polite"` that is always present in the DOM announces "Link copied to clipboard" (success) or "Failed to copy — link shown below" (failure). Verified by a Playwright accessibility assertion on the `aria-live` region's text content, plus a component test asserting the element is present in the DOM before any copy action.

**AC-17-14 (AI key not in exports):** A local progress export generated after an AI key is saved contains no field matching the key value. Verified by a unit test that saves a synthetic key to `localStorage` under `vibratone:ai-coach-key`, calls `exportLocalProgress()`, and asserts the returned JSON string does not contain the synthetic key value.

**AC-17-15 (No audio imports in coach-ai module):** `src/lib/learning/analytics/coach-ai.ts` contains no reference to `getUserMedia`, `AnalyserNode`, `MediaStreamAudioSourceNode`, or `AudioContext`. Verified by a CI grep gate (see Verification) plus a supplementary runtime test in `coach-ai.spec.ts` confirming `AudioContext` is never invoked during module evaluation or during `rewriteExplanation` execution with `MockAiClient`.

**AC-17-16 (Disclosure gate before key-save):** Given a user who activates the AI explanation feature, the API key is not written to `localStorage` under `vibratone:ai-coach-key` until the data disclosure panel checkbox has been checked and the Save button activated. Verified by a Playwright test that: (1) navigates to the coach page; (2) activates the AI setup flow; (3) enters a synthetic key string; (4) attempts to save without acknowledging the disclosure; (5) asserts `localStorage.getItem('vibratone:ai-coach-key')` is `null`; (6) acknowledges the disclosure and saves; (7) asserts the key is now present.

**AC-17-17 (Markdown-free AI output rendering):** Given a `MockAiClient` configured to return a string containing markdown tokens (`**bold**`, `` `code` ``, `# heading`), the `coach-card` component renders the raw string as a text node. No `<strong>`, `<em>`, `<code>`, `<h1>`–`<h6>` element produced by a markdown parser is present in the rendered DOM. Verified by a `coach-card.svelte.test.ts` component test asserting `element.querySelector('strong, em, code, h1, h2, h3')` returns `null` when the explanation prop contains markdown tokens.

**AC-17-18 (Extended CoachPayload exclusion check):** The `CoachPayload` object passed to the `MockAiClient` spy in `coach-ai.spec.ts` satisfies all of: no property named `stability`, `difficulty`, `reviewLog`, or `fullHistory`; `weakPitchClasses` has length ≤ 12; `confusionPairs` has length ≤ 5. Verified by extending the existing `MockAiClient spy` test with explicit property-presence assertions.

## Test Plan

### Unit tests (`src/lib/learning/analytics/coach-payload.spec.ts`)

- `buildCoachPayload returns only permitted fields — no Float32Array, ArrayBuffer, or Blob properties`
- `buildCoachPayload includes at most 12 weak pitch-class labels`
- `buildCoachPayload includes at most 5 confusion pairs`
- `buildCoachPayload output satisfies the CoachPayload type guard at runtime`
- `CoachPayload type has no field assignable to ArrayBuffer or AudioBuffer (compile-time satisfies assertion)`

### Unit tests (`src/lib/learning/analytics/recommendations.spec.ts`)

- `deterministicRecommendations returns weak concepts sorted by confusion frequency`
- `deterministicRecommendations returns empty array (not undefined) when no FSRS cards are due and no confusion data exists`
- `deterministicRecommendations does not include pitch classes with accuracy above threshold in weak list`
- `deterministicRecommendations falls back to deterministic output when rewriteExplanation throws`
- `deterministicRecommendations result is deterministic for identical analytics input (same input produces identical output on two calls)`

### Unit tests (`src/lib/learning/analytics/coach-ai.spec.ts`)

- `rewriteExplanation throws CoachAiDisabledError when AiCoachState.enabled is false`
- `rewriteExplanation returns deterministic text when provider returns 5xx`
- `rewriteExplanation returns deterministic text on network error`
- `rewriteExplanation returns deterministic text when provider returns 200 with an empty content array`
- `rewriteExplanation returns deterministic text when provider returns 200 with a non-text content block`
- `rewriteExplanation returns deterministic text on AbortController timeout — uses vi.useFakeTimers(); do not convert to a real wait`
- `MockAiClient spy confirms CoachPayload argument: no property named stability, difficulty, reviewLog, or fullHistory; weakPitchClasses length ≤ 12; confusionPairs length ≤ 5` (AC-17-18)
- `request body serialized to the AI provider contains only weakPitchClasses, confusionPairs, fsrsDueCounts, and selectedTracks — spy on the serialized fetch body` (AC-17-02 layer)
- `API key is sent only in the Authorization or x-api-key header, never in the serialized request body` (AC-17-02 layer)
- `AiCoachState stored under vibratone:ai-coach-state contains keyDisplayHint (last 4 chars) but never the full key value`
- `callCount increments by 1 on each successful rewriteExplanation call`
- `lastCalledAt is set to a valid ISO 8601 string after a successful call`
- `callCount and lastCalledAt are unchanged when rewriteExplanation throws CoachAiDisabledError`
- `coach-ai.ts source contains no import from getUserMedia, AnalyserNode, MediaStreamAudioSourceNode, or AudioContext` (static string-search; AC-17-15 primary)
- `importing coach-ai.ts does not invoke AudioContext constructor during module evaluation or during rewriteExplanation execution with MockAiClient` (runtime behavioral check; AC-17-15 supplementary)

### Unit tests (`src/lib/learning/analytics/session-events.spec.ts`)

- `appendInterleavedSessionEvent appends to localStorage under vibratone:interleaved-sessions:v1`
- `loadInterleavedSessionLog returns events in insertion order`
- `malformed localStorage value returns empty array without throwing`

### Unit tests (`src/lib/learning/drills/custom-drill.spec.ts`)

- `validateCustomDrill returns error when tracks array is empty`
- `validateCustomDrill returns error when drillTypes array is empty`
- `validateCustomDrill returns error when unsupported drill type is combined with AP-only timbre`
- `validateCustomDrill passes a minimal valid AP-only config`
- `validateCustomDrill returns error when eligibleConcepts has zero pitch classes`
- `isCustomDrillConfig rejects a config missing schemaVersion`
- `isCustomDrillConfig rejects a config with an unknown track name`
- `isCustomDrillConfig rejects a config where schemaVersion is not 1`
- `isCustomDrillConfig rejects a config where tracks is empty`

### Unit tests (`src/lib/learning/drills/share-link.spec.ts`)

- `encodePack then decodePack round-trips an AP-only config`
- `encodePack then decodePack round-trips a multi-track config (AP, Relative Pitch, Theory, Producer)`
- `encodePack then decodePack round-trips a config near the 2 KB size limit`
- `encodePack succeeds when encoded size is exactly 2048 bytes`
- `encodePack throws PackTooLargeError when encoded size is exactly 2049 bytes`
- `decodePack throws SchemaVersionError when schemaVersion is not 1`
- `decodePack throws MalformedPackError when base64 is invalid`
- `decodePack throws MalformedPackError when base64 decodes to non-JSON`
- `decodePack throws MalformedPackError when JSON is valid, schemaVersion is 1, but the object fails isCustomDrillConfig (e.g., tracks contains unknown name 'banjo')`
- `decodePack throws MalformedPackError when tracks field is an integer rather than an array`
- `encodePack output does not contain the vibratone:ai-coach-key value when a key is present in localStorage`

### Unit tests (`src/lib/learning/scheduling/interleave.spec.ts`)

- `mergeQueues returns only AP cards when selectedTracks is ['ap']`
- `mergeQueues with fsrs-due policy returns cards sorted ascending by dueAt`
- `mergeQueues with fsrs-due policy breaks dueAt ties by card id lexicographic order (deterministic)`
- `mergeQueues with sequential policy returns all AP cards before any Relative Pitch cards`
- `mergeQueues returns empty array when no cards are due in any selected track`
- `mergeQueues returns empty array when selectedTracks is empty`
- `mergeQueues never returns the same card id twice`
- `mergeQueues with random policy and fixed seed produces identical output on repeated calls`
- `mergeQueues with random policy produces different orderings for different seeds (seed 1 and seed 2 produce non-identical arrays for a 6-card queue)`
- `filterBySelectedTracks removes producer cards when producer is not in selectedTracks`

### Unit tests (`src/lib/learning/scheduling/practice-pack.spec.ts`)

- `savePack persists config to localStorage under DRILL_PACKS_KEY`
- `savePack stored object contains id, name, schemaVersion, configIds, selectedTracks, and createdAt`
- `loadPacks returns empty array when no packs are saved`
- `loadPacks returns all saved packs in creation order`
- `loadPacks returns empty array when DRILL_PACKS_KEY contains malformed JSON`
- `loadPacks returns empty array when stored value fails isDrillPackMetadata type guard`
- `deletePack removes the correct pack and leaves others intact`

### Unit tests (`src/lib/persistence.spec.ts`)

- `exportLocalProgress does not include vibratone:ai-coach-key value when the key is present in localStorage` (AC-17-14)

### Unit tests (`src/lib/state/coach.svelte.ts` via `coach.svelte.spec.ts`)

- `createCoachState loads savedPacks from DRILL_PACKS_KEY on init`
- `savePack persists to DRILL_PACKS_KEY and pack appears in savedPacks`
- `requestAiExplanation does not fire on state construction — only on explicit call`
- `provenance is deterministic before requestAiExplanation is called`
- `provenance reverts to deterministic when requestAiExplanation throws after a prior successful AI call`

### Unit tests (`src/routes/builder/+page.spec.ts`) — server project, node environment, no `.svelte.` infix

- `load returns {config: CustomDrillConfig} for a well-formed ?pack= query param`
- `load returns a SchemaVersionError shape for a stale schemaVersion`
- `load returns a MalformedPackError shape for corrupt base64 in ?pack=`
- `load returns {config: null, error: null} when no ?pack= param is present — no crash`
- `load does not access window or localStorage — runs cleanly in a node environment without browser globals`

### Component tests (`src/routes/coach/+page.svelte.test.ts`)

- `CoachPage renders a recommendation explanation when FSRS data is present`
- `CoachPage renders deterministic explanation text when AiCoachState.enabled is false`
- `CoachPage explanation text is visible before any drill button is activated`
- `CoachPage shows provenance badge (Deterministic or AI) on each explanation`
- `AI explanation text containing HTML markup renders as literal text content, not parsed as HTML — textContent includes angle brackets, no <b> element present` (AC-17-17 layer)
- `API key cannot be saved until the data-disclosure panel is acknowledged` (AC-17-16 layer)
- `disclosure panel body text names every sent field and every excluded field`

### Component tests (`src/lib/components/coach-card.svelte.test.ts`)

- `coach-card renders deterministic explanation as a text node when provenance is deterministic`
- `coach-card renders AI explanation as a text node when provenance is ai and explanation contains markdown tokens — querySelector("strong, em, code, h1, h2, h3") returns null` (AC-17-17)

### Component tests (`src/lib/components/share-action.svelte.test.ts`)

- `aria-live="polite" region is present in the DOM on initial render before any copy action is triggered` (AC-17-13 always-mounted)
- `aria-live region text is empty string on initial render`
- `aria-live region text is cleared after 4000 ms — uses vi.useFakeTimers() / vi.advanceTimersByTime(4001); do not convert to a real wait`

### Component tests (`src/routes/builder/+page.svelte.test.ts`)

- `DrillBuilder all form controls are reachable by Tab key alone`
- `DrillBuilder invalid configuration shows per-field inline error messages and disables Start`
- `DrillBuilder valid configuration enables the Start button`
- `DrillBuilder configuration summary is rendered before the learner presses Start`
- `DrillBuilder track selector supports all four track types (AP, relative-pitch, theory, producer)`

### Component tests (`src/routes/packs/+page.svelte.test.ts`)

- `PacksList renders a saved pack name and creation date`
- `PacksList Run button is enabled when the pack is valid`
- `PacksList empty state is shown when no packs are saved`

### Playwright tests (`e2e/coach.spec.ts`)

- `coach page shows deterministic recommendation without AI key`
- `coach page shows AI-rewritten explanation when valid key is configured`
- `coach page falls back gracefully when AI provider returns error`
- `coach page why-this-drill tooltip is keyboard accessible`
- `coach page — phone (375 px): explanation and CTA are visible without horizontal scroll`
- `coach page — tablet (768 px): recommendation card is not clipped`
- `coach page — desktop (1280 px): layout uses available width without overflow`
- `save key button is disabled until data-disclosure checkbox is checked` (AC-17-16 e2e layer)

### Playwright tests (`e2e/builder.spec.ts`)

- `keyboard-only user completes full drill build and copy-share flow`
- `share-link copy announces success via aria-live region`
- `share-link copy announces failure via aria-live region when clipboard is unavailable`
- `navigating to URL with malformed pack parameter shows recoverable error`
- `navigating to URL with outdated schemaVersion shows recoverable error`
- `start button is disabled when no tracks are selected`
- `submitting empty track selection shows accessible per-field error message`
- `builder is responsive at phone (375 px), tablet (768 px), and desktop (1280 px) widths`

### Playwright tests (`e2e/packs.spec.ts`)

- `saved pack persists and appears after page reload`
- `deleting a pack removes it from the list`
- `running a saved pack starts the interleaved session`
- `running a pack with no valid cards shows empty-state message`
- `packs list is navigable by keyboard alone`
- `running a pack whose configIds reference a deleted config shows a recoverable error state rather than crashing`
- `packs — phone (375 px): pack list items are readable without horizontal scroll`
- `packs — tablet (768 px): Run and Delete actions are both accessible`
- `packs — desktop (1280 px): pack list uses available width without overflow`

### Playwright tests (`e2e/interleaved-session.spec.ts`)

- `current track label is visible at the top of each prompt`
- `current track label is exposed to screen readers via heading or aria-label`
- `AP-only selection never shows a relative-pitch or producer prompt`
- `multi-track selection cycles through AP and theory cards`
- `session ends cleanly when due-card queue is exhausted`
- `after completing a 3-slot interleaved session, localStorage under vibratone:interleaved-sessions:v1 contains exactly 3 InterleavedSessionEvent objects`
- `interleaved session — phone (375 px): track label and prompt visible without horizontal scroll`
- `interleaved session — tablet (768 px): answer surface and track label co-exist without overlap`
- `interleaved session — desktop (1280 px): no layout overflow during active session`

## Verification

Run the standard gate commands:

```
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

Static import gate (CI-enforced, matches M13 pattern):

```
grep -E "getUserMedia|AnalyserNode|MediaStreamAudioSourceNode|AudioContext" \
  src/lib/learning/analytics/coach-ai.ts
```

Must return no matches. This is the canonical enforcement point for AC-17-15; the runtime spy test in `coach-ai.spec.ts` is belt-and-suspenders.

Manual smokes:

- Confirm `coach-ai.ts` file contains no audio API imports (grep gate above).
- Confirm deterministic recommendation is non-empty with no AI key set.
- Confirm builder Start button is disabled with no tracks selected.
- Confirm share-link `aria-live` region announces success/failure.
- Confirm saved pack survives a page reload.
- Confirm interleaved session shows current track on every prompt.
- Confirm progress export JSON does not include the AI key value when a key is present.
- Responsive smoke at phone (375 px), tablet (768 px), and desktop (1280 px) for coach, builder, packs list, and interleaved session.
- Manual Chrome and Safari smoke for the share-link copy action (Web Share API availability varies by browser).

## Non-Goals

- Do not require an AI provider for core recommendations.
- Do not send raw microphone audio to AI.
- Do not introduce a server-side AI proxy (deferred to after Milestone 20, Database Foundation).
- Do not support a user-configured localhost LLM endpoint in this milestone. The `provider` field is constrained to `'openai' | 'anthropic'`. Localhost LLM support requires a `baseUrl` field and a separate `vibratone:ai-coach-baseurl` persistence key; it is deferred until there is demonstrated user demand.
- Do not add community drill libraries.
- Do not add teacher assignments.
- Do not add a database.
- Do not add cloud sync.
- Do not render AI explanation as markdown—plain text only. The `coach-card` component renders AI output as a text node; no `{@html}`, no markdown parser, no sanitization step.

## Completion Signal

This milestone is complete when:

- A learner receives a deterministic coaching recommendation with a "why this drill" explanation from local analytics alone.
- The interleaved scheduler correctly mixes due cards from selected tracks and rejects cards from deselected tracks.
- A saved practice pack survives a page reload.
- The full builder keyboard-only flow passes the Playwright test.
- All unit tests, component tests, and Playwright specs are green.
- The AI key is confirmed absent from the progress export by the unit test (`exportLocalProgress` in `persistence.spec.ts`).
- The static import grep gate confirms `coach-ai.ts` imports no audio API.
- The disclosure gate Playwright test (AC-17-16) passes: key not written until disclosure acknowledged.
