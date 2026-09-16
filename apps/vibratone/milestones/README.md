# Vibratone Milestones

These milestones translate `ROADMAP.md` into ordered, independently shippable work packages. Each file is intended to be self-contained enough for an implementer to pick up without reading the full roadmap first.

This set is the result of a four-lens review (product, frontend architecture, testing, Svelte/SvelteKit) gated against a "color-by-numbers / shovel-ready" bar. The original 18 milestones were split into **25** so that each file is a single coherent slice of buildable work. See [REVIEW-SUMMARY.md](./REVIEW-SUMMARY.md) for what changed, why, the dependency graph, the external-dependency register, and the issues filed against repositories we own.

## Order

### Foundation (engine + audio + feasibility)

- [00. Drill Schema, Attempt-Event Log, and Note-Trainer Conversion](./00-drill-schema-and-note-trainer-conversion.md)
- [01. Lookahead Audio Scheduler](./01-lookahead-audio-scheduler.md)
- [02. Sample-Loading Capability](./02-sample-loading-capability.md)
- [03. Microphone Pitch-Detection Spike](./03-microphone-pitch-detection-spike.md)

### Absolute Pitch track (the wedge)

- [04. AP Trainer MVP](./04-ap-trainer-mvp.md)
- [05. Local FSRS and AP Analytics](./05-local-fsrs-and-ap-analytics.md)
- [06. Research-Derived AP Level Progression](./06-research-derived-ap-level-progression.md)
- [07. Timbre Transfer and Register Training](./07-timbre-transfer-and-register-training.md)
- [08. AP Singing and Pitch Production](./08-ap-singing-and-pitch-production.md)
- [09. Public AP Beta and Proof Loop](./09-public-ap-beta-and-proof-loop.md)
- [10. Answer Surfaces, MIDI, and Accessibility](./10-answer-surfaces-midi-and-accessibility.md)

### Relative Pitch track (parallel, not a step after AP)

- [11. Relative Pitch and Singer Track](./11-relative-pitch-and-singer-track.md)
- [12. Intervals and Chords](./12-intervals-and-chords.md)

### Theory track

- [13. Theory Explorers and Drill Builder](./13-theory-explorers-and-drill-builder.md)
- [14. Staff Notation Exercises](./14-staff-notation-exercises.md)

### Production track

- [15. Producer Track](./15-producer-track.md)
- [16. Step Sequencer and Progression Lab](./16-step-sequencer-and-progression-lab.md)

### Cross-track integration and platform

- [17. AI Coach and Custom Practice](./17-ai-coach-and-custom-practice.md)
- [18. Accountless Teacher and Assignment Exports](./18-accountless-teacher-and-assignment-exports.md)
- [19. Unified Today Surface and Launch Docs](./19-unified-today-surface-and-launch-docs.md)

### Database line (no DB before here)

- [20. Database Foundation](./20-database-foundation.md)
- [21. Anonymous Aggregate Efficacy and Global Puzzles](./21-anonymous-aggregate-efficacy-and-global-puzzles.md)

### Auth line (no auth before here)

- [22. Auth Foundation](./22-auth-foundation.md)
- [23. Cloud Sync, Paid Entitlements, and User Accounts](./23-cloud-sync-paid-entitlements-and-user-accounts.md)
- [24. Cloud Classroom, Community, and Integrations](./24-cloud-classroom-community-and-integrations.md)

## Dependency Graph

Each milestone depends only on strictly-earlier milestones (the graph is acyclic and forward-pointing). Tracks run in parallel: nothing in the Relative Pitch, Theory, or Production tracks is a prerequisite for Absolute Pitch.

```
00 ─┬─ 01 ─┬─ 02 ─ 04 ─ 05 ─ 06 ─ 07 ─┬─ 08 (← also 03)
    │      │                          └─ 09 ─ 10 ─┬─ 11 (← also 03)
    └─ 03 ─┘                                       ├─ 12 (← also 03)
                                                   ├─ 13 ─ 14
                                                   └─ 15
01 ─ 16 (← also 13)
13,11,15 ─ 17 ─ 18 ─ 19 (← also 15,16,11)
19 ─ 20 ─ 21          (database line: 20 introduces the DB; 21 may use it)
21 ─ 22 ─ 23 ─ 24      (auth line: 22 introduces auth; 23,24 depend on accounts)
```

## Global Product Principles

**Primary wedge:** Vibratone is a rigorous, honest, research-grounded adult absolute-pitch program. Broad ear training, theory, production, and classroom tools expand from that wedge.

**Track model:** Absolute Pitch, Relative Pitch, Theory, and Production are parallel tracks. Do not force every learner through one linear ladder.

**Responsive web:** Every milestone must work on desktop, tablet, and phone through the web application. Native iOS, native Android, and watch applications are out of scope.

**Accessibility:** Core flows must be usable with keyboard and screen reader. Ear training is audio-first; visual surfaces are enhancements, not requirements.

**Local-first:** Learner progress, drill history, and exports should work without an account unless a milestone explicitly introduces an opt-in external workflow.

**Database line:** Milestones 00 through 19 must not require a database. Milestone 20 introduces the database boundary. Milestone 21 may use the database without requiring auth.

**Auth line:** Milestones 00 through 21 must not require auth. Milestone 22 introduces auth. Milestones 23 and later may depend on accounts.

**Honest claims:** Do not promise that every adult can acquire near-native perfect pitch. Cite claims, show variance, and separate strict cold-test performance from warmed-up practice performance.

## Global Quality Gates

Run these unless a milestone explicitly narrows the gate:

- `bun run check`
- `bun run lint`
- `bun run test:unit -- --run`
- `bun run test:e2e`

Add targeted tests for each new domain behavior. Use Playwright smoke coverage for core responsive flows at phone, tablet, and desktop widths.
