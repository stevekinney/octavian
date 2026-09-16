# Milestone Review Summary

A four-lens review of the Vibratone milestones — **product-manager**, **frontend-architect**, **testing-expert**, and **svelte-expert** — gated against a "color-by-numbers / shovel-ready" bar by a **junior-engineer** reviewer. The goal was to confirm the architecture is called out, product requirements and acceptance criteria are fully fleshed out, every milestone has a comprehensive test plan, the work fits the larger roadmap story, and the milestones are sequenced in the right order — splitting and reordering where needed.

## Headline outcome

- **18 → 25 milestones.** The originals bundled multiple risk areas per file; they were split so each milestone is a single coherent, independently shippable slice of buildable work.
- **Renumbered sequentially (00–24)** with all cross-references and the README index rewritten.
- **Every milestone enriched** with concrete module/file targets, resolved (non-conditional) requirements, testable acceptance criteria, named test lists, and an external-dependency register.
- **Structural invariants verified programmatically:** the dependency graph is acyclic and forward-pointing; the database line (no DB before milestone 20) and auth line (no auth before milestone 22) both hold.
- **5 new issues filed** against `@lostgradient/cinder` for components we expect to own but had not yet ticketed.

## What changed structurally

### Splits

| Original                                    | Split into                                                                                                                                         | Why                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `00 Engine and Feasibility Spike`           | `00 Drill Schema + Note-Trainer Conversion`, `01 Lookahead Audio Scheduler`, `02 Sample-Loading Capability`, `03 Microphone Pitch-Detection Spike` | The original bundled five distinct risk areas (schema, scheduler, samples, microphone, notation decision) with different skills, risk profiles, and downstream consumers. No single junior could pick it up as one ticket. The notation **decision** stays in `00`; the notation **renderer + exercises** move to `14`. |
| `04 Transfer, Register, and Singing`        | `07 Timbre Transfer and Register Training`, `08 AP Singing and Pitch Production`                                                                   | Timbre/register transfer testing and microphone-based singing are separate risk surfaces. Singing depends on the microphone spike (`03`) as well as transfer (`07`).                                                                                                                                                    |
| `07 Functional and Singer Tracks`           | `11 Relative Pitch and Singer Track`                                                                                                               | Renamed/renumbered; the relative-pitch track is a parallel path, not a step after AP.                                                                                                                                                                                                                                   |
| `08 Intervals and Chords`                   | `12 Intervals and Chords`                                                                                                                          | Renumbered.                                                                                                                                                                                                                                                                                                             |
| `09 Theory and Notation Track`              | `13 Theory Explorers and Drill Builder`, `14 Staff Notation Exercises`                                                                             | Staff notation is gated behind its own renderer and is isolated so the rest of the theory track ships without it.                                                                                                                                                                                                       |
| `12 Production Track and Suite Integration` | `15 Producer Track`, `16 Step Sequencer and Progression Lab`, `19 Unified Today Surface and Launch Docs`                                           | A new track (Producer), creative playback tools, cross-track integration (Today), and launch documentation are four different kinds of work.                                                                                                                                                                            |

### Reorders / renumbers

The Absolute Pitch wedge now occupies a contiguous `04–10` block. Relative Pitch (`11–12`), Theory (`13–14`), and Production (`15–16`) follow as parallel tracks that depend on the answer-surface and accessibility work (`10`) and the microphone spike (`03`) but never on each other. Cross-track integration and platform work (`17–19`) precede the database line (`20–21`) and auth line (`22–24`).

## Dependency graph

```
00 ─┬─ 01 ─┬─ 02 ─ 04 ─ 05 ─ 06 ─ 07 ─┬─ 08 (← also 03)
    │      │                          └─ 09 ─ 10 ─┬─ 11 (← also 03)
    └─ 03 ─┘                                       ├─ 12 (← also 03)
                                                   ├─ 13 ─ 14
                                                   └─ 15
01 ─ 16 (← also 13)
13,11,15 ─ 17 ─ 18 ─ 19 (← also 15,16,11)
19 ─ 20 ─ 21          (database line)
21 ─ 22 ─ 23 ─ 24      (auth line)
```

Verified acyclic and forward-pointing: every `dependsOn` points to a strictly-earlier milestone, and no milestone references a number that does not exist.

## Invariants (verified)

- **Database line:** milestones `00–19` are `requiresDatabase: false`; `20 Database Foundation` introduces the boundary; `21` may use the DB without auth. ✔
- **Auth line:** milestones `00–21` are `requiresAuth: false`; `22 Auth Foundation` introduces auth; `23–24` may depend on accounts. ✔
- **Parallel tracks:** no Relative-Pitch, Theory, or Production milestone is a prerequisite for any Absolute-Pitch milestone. ✔
- **AP wedge first / honest claims:** preserved across all enriched docs. ✔
- **Cross-references:** the renumbering introduced a handful of stale milestone references in prose (e.g. "no database until milestone 13", a notation deferral pointing at the old number). These were found by a cross-reference sweep and corrected. ✔

## Gate status — read this honestly

The per-milestone junior-engineer gate was deliberately adversarial and default-reject ("approve only if a junior could start Monday with zero open questions"). Against that bar:

- All 25 milestones were enriched through **two full review rounds** (a small number of late milestones reached only round 1 before the run was stopped).
- The gate issued **zero formal `approved: true` verdicts** across ~30 verdicts. Its remaining-gap lists were consistently small (2–9 items) and **substantive and specific** — undefined types referenced by tests, a `Plan` union that needed splitting per specialist pack, a named test file missing its source module, an `axe-core` dependency not yet listed. These are real shovel-readiness nits, not hand-waving.
- **Hand-verification of two milestones** (`00` and `23`) confirmed the round-2 docs are genuinely shovel-ready: `00` defines the full `AttemptEvent`/`DrillPrompt` schema with a file-by-file Module-and-Architecture table grounded in the real `src/lib` code; `23` resolved its round-1 blockers (it now defines `EntitlementSet` in `src/lib/server/entitlements.ts` with a concrete `resolveEntitlements()` contract).

**Conclusion:** the docs are strong and ready to build from. The "0 approvals" reflects a gate calibrated to "perfect / no possible question" rather than "shovel-ready" — an asymptotic bar a planning doc can never fully satisfy, because a junior can always ask one more question. **Treat each milestone's `## Acceptance Criteria` and `## Test Plan` as the build contract; treat any remaining gate nit as a 10-minute clarification, not a blocker.**

> [!NOTE] Process note
> The review ran as a multi-agent workflow. It hit a monthly spend limit mid-run (round 2) and, on a later resume, the background process died after a long idle gap. Because each agent's output is journaled, the final enriched docs were salvaged from the run journal at zero additional agent cost rather than re-run. No milestone content was lost; the structure decision, all 25 enriched docs, and the dependency register all come from completed agent results.

## External dependency register

Per the standing rule that **anything we expect from a repository we own must have a tracking issue**, every external capability the milestones depend on was catalogued (125 unique capabilities) and classified by owner.

### Octavian (we own — all referenced capabilities already ticketed)

Referenced issues, all present on `stevekinney/octavian`: **#17, #18, #19, #20, #21, #22, #26, #27, #28, #29, #30, #31, #32, #33, #34, #35, #36, #37, #38**. Some are already closed (#17 chromatic-index factory, #26 temperament, #29 symbol parsers, #36 keyboard layout); the rest are open and tracked. **No new Octavian issue was required** — every music-primitive dependency surfaced by the review maps to an existing ticket. The boundary decisions in `ADDITIONAL_LIBRARIES.md` (subpath exports `octavian/sequences`, `octavian/web-audio`, `octavian/pitch`, `octavian/midi`, `octavian/notation`) all hold.

### Cinder (we own — 5 new issues filed)

Referenced existing issues, all present on `stevekinney/cinder`: **#318 ChoiceGrid, #319 Matrix/Heatmap, #320 media controls, #321 CapabilityGate, #322 ShareCard, #323 shortcut help, #324 signal viz**. The review surfaced component needs with **no existing issue**, now filed:

| New issue                                                      | Component                                                          | Surfaced by           |
| -------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------- |
| [cinder#334](https://github.com/stevekinney/cinder/issues/334) | Accessible **DataTable** (rosters, cohort/assignment views)        | milestones 18, 21, 24 |
| [cinder#335](https://github.com/stevekinney/cinder/issues/335) | **PricingCard** (plan/entitlement tiles, no AP-guarantee language) | milestone 23          |
| [cinder#336](https://github.com/stevekinney/cinder/issues/336) | **SubscriptionBadge** (subscription-state badge)                   | milestone 23          |
| [cinder#337](https://github.com/stevekinney/cinder/issues/337) | **Account settings + destructive-confirmation** patterns           | milestone 22          |
| [cinder#338](https://github.com/stevekinney/cinder/issues/338) | Keyboard-navigable **docs/sidebar Nav**                            | milestone 19          |

Each filed issue includes the prop/behavior contract and the local stub plan the milestone uses until the upstream component ships, so no milestone is blocked waiting on Cinder.

### Third-party (not ours — explicit decisions still required)

These are genuine third-party dependencies, not repos we own. They need a **decision**, not a ticket on our side:

- **`ts-fsrs`** (FSRS-5 scheduler) — milestone 05. Open-source npm; install when 05 starts.
- **`pitchy`** (McLeod pitch detection) — milestones 03, 08. npm.
- **`VexFlow`** (staff notation renderer) — milestone 14, behind the notation gate.
- **Postgres driver** (e.g. `@neondatabase/serverless`) — milestone 20. Provider decision recorded in `docs/decisions/database.md` before the sprint.
- **Auth provider** (e.g. `better-auth`) — milestone 22. Provider decision required.
- **Billing provider** (e.g. Stripe) — milestone 23. **This is a real product decision, not a buildable dependency** — the gate correctly flagged that the webhook shape, signature scheme, and subscription-state enum are unknown until a provider is chosen. Pick one before 23.
- **Licensed audio samples** (piano, guitar) — milestone 02. Candidate future package `@lostgradient/music-assets`; sourcing/licensing is its own task.
- **`@axe-core/playwright`** — accessibility scanning in the test plans. npm dev dependency.

## Files in this review

- `00-` … `24-*.md` — the 25 enriched, renumbered milestone files.
- `README.md` — reordered index, dependency graph, global principles, and quality gates.
- `REVIEW-SUMMARY.md` — this document.
