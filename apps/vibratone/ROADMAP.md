# Vibratone Feature Roadmap

This roadmap reflects the product strategy after reviewing the first pass critically. The original plan was too broad: it described a complete ear-training suite, but it did not define why Vibratone should win in a mature market or what success means. The revised plan makes one sharp bet first, then expands from there.

## Strategy

**Vibratone's wedge is a rigorous, honest, research-grounded adult absolute-pitch program.** Most ear-training products either avoid absolute pitch or market it loosely. Vibratone should do the opposite: implement the strongest published adult absolute-pitch training protocol we can responsibly adapt, measure outcomes transparently, and avoid promising that every adult will acquire near-native perfect pitch.

That gives the product a clear reason to exist before it competes with broad suites such as ToneGym, EarMaster, TonedEar, Perfect Ear, Sonofield, and Functional Ear Trainer.

The expansion still matters, but it should be sequenced as parallel tracks:

- **Absolute Pitch:** Pitch-class memory, timed naming, chroma transfer, register naming, and efficacy measurement.
- **Relative Pitch:** Intervals, scale degrees, chords, singing, and functional listening.
- **Theory:** Notes, keys, scales, chords, Roman numerals, notation, and instrument surfaces.
- **Production:** Sound-design and audio-engineering listening drills powered by Web Audio.

The initial roadmap should prove the wedge and build enough platform to support the other tracks without turning the product into a checklist of incumbent features.

This document separates the execution plan from the product inventory. The ordered roadmap says what to build first. The inventory captures everything the product might reasonably become so useful ideas are not lost before prioritization.

**Mobile posture:** Vibratone should work well on phones through the responsive web application. This roadmap should not include native iOS, native Android, or watch applications. Phone-intended features still belong here when they make sense as web experiences: quick practice, daily puzzles, share cards, pocket mode, microphone singing, home-screen install, and offline practice if the web platform can support it cleanly.

## What Success Means

**Product success:** A new learner understands the promise, takes a placement test, starts a serious absolute-pitch program, and knows exactly what progress is being measured.

**Learning success:** The product can show a cold-test curve over time: pitch-class accuracy, semitone error size, response time, timbre transfer, register accuracy, and retention without warm-up references.

**Business success:** The product converts from a free, credible AP assessment and daily puzzle into paid guided training, analytics, custom schedules, teacher assignments, or specialist tracks. If the app stays a portfolio or teaching artifact instead, the paid work can be deferred, but the roadmap should not pretend that "ship every exercise" is a business strategy.

**Not success:** Matching the incumbent exercise catalog. Intervals, chords, scales, progressions, rhythm, dictation, and sight-reading are already available elsewhere. Vibratone wins only if it is more trustworthy, measurable, adaptable, accessible, and locally useful.

## Why Someone Leaves Free Alternatives

TonedEar already offers free web drills for perfect pitch, intervals, chords, scales, progressions, scale degrees, intervals in context, and melodic dictation. Functional Ear Trainer and Sonofield already own much of the contextual scale-degree narrative. EarMaster and ToneGym already offer broad paid suites with deep catalogs, progress tracking, microphone input, and classroom features.

Vibratone's reason to switch must be:

- A research-derived AP progression instead of generic note guessing.
- Local-first FSRS scheduling for every trainable atom.
- Cold tests that separate true retention from warmed-up performance.
- Explicit suppression of relative-pitch shortcuts in AP mode.
- Honest expectation setting, including an auditory-working-memory placement signal.
- Sampled multi-timbre training and transfer tests.
- A fully keyboard- and screen-reader-usable audio-first interface.
- A shareable proof loop: daily puzzles and progress cards before the database line, then opt-in aggregate outcome curves after server persistence is introduced.

## Current Product Surface

**Available today:**

- Single-note pitch-class identification.
- Chromatic mode or selectable major keys: C, G, D, A, E, B, F, B-flat, E-flat, A-flat, and D-flat.
- Eligible note toggles, key-matching behavior, tonic marking, and enharmonic labels.
- Octave range selection from C2 through C6.
- Piano keyboard answer surface.
- Play and replay actions.
- Session score, all-time score, streak, best streak, and reset actions.
- Local persistence for settings and all-time score.
- Web Audio synthesis through a lazily created shared `AudioContext`.
- Hidden `sine`, `warm`, and `piano` timbres in the synth layer, though the interface currently hard-codes `sine`.
- Pure, tested helpers for music theory, round selection, scoring, persistence, and audio envelope parameters.

**Important current constraints:**

- The learner answers pitch class only; octave is displayed after reveal but is not trained.
- There are no levels, placement tests, adaptive schedules, or spaced review.
- Scoring is aggregate only; there is no per-card, per-note, per-octave, per-timbre, or confusion analytics.
- The current state model is a single practice loop, not a general drill engine.
- Timed scheduling, chord playback, drones, sample loading, microphone input, MIDI input, notation rendering, and instrument-specific answer surfaces do not exist yet.

## Research Guardrails

The core AP track should adapt the Wong, Cheung, Ngan, and Wong 2025 protocol rather than loosely borrowing its vocabulary.

Relevant constraints from the study:

- Online adult-musician AP training ran for up to eight weeks.
- Participants averaged 21.4 training hours and 15,327 training trials.
- Training used 800 ms piano tones across three octaves.
- The program had 288 levels, 24 levels per added pitch.
- Training started from F, then added adjacent pitches on alternating sides.
- Out-of-bound tones were included early to reduce simple high-versus-low strategies.
- Response windows tightened over time.
- Some levels removed feedback.
- Shepard-tone disruption was used before no-feedback levels after sample listening.
- Final completion required repeated final-level mastery, including a delayed one-take pass after at least 12 hours without training.
- Pre/post tests used trained and untrained timbres, randomized octave spacing, no feedback, and time limits to suppress relative-pitch strategies.
- Results were promising but not universal: participants averaged 7.08 pitches named at 90%+ accuracy, and two participants reached all 12.

Vibratone should state these caveats plainly. The brand should be "serious and honest," not "guaranteed perfect pitch."

## Architecture Principles

**Build the engine before the suite.** The first foundation is not another panel; it is a schema and scheduler that every track can share.

**Everything trainable is a card.** Examples: note x octave x timbre, pitch class x timbre, interval x direction, chord quality x inversion, scale degree x key, cadence x mode, and EQ band x gain direction.

**FSRS owns review timing.** Weak-concept drills should be generated from review state, not hand-written heuristics. FSRS can run locally and tracks difficulty, stability, and retrievability.

**Audio timing starts with a lookahead clock.** Intervals, arpeggios, cadence setup, drones, progressions, rhythm, and sequencers all need scheduled audio based on `AudioContext.currentTime`, not one-off timers.

**Tracks are parallel, not linear.** Absolute-pitch learners should not be forced through harmony. Theory learners should not be forced through AP. A shared "Today" surface can recommend work across tracks, but the user's goal chooses the path.

**Accessibility is not a final audit.** Ear training is unusually well suited to blind and low-vision musicians. The interaction model should work without sight from the beginning.

**Responsive web is a platform requirement.** Every core drill, dashboard, answer surface, and share view should have desktop, tablet, and phone layouts. Mobile-specific value should come from web interactions, not from a separate native application roadmap.

**No database before local proof.** Anything that can run from local storage, URL payloads, static content, or downloadable files should ship before server persistence.

**No auth before shared identity is unavoidable.** Accounts are reserved for sync, paid entitlements, cloud classrooms, community surfaces, and authenticated research data.

## Cinder adoption follow-up

Audited 2026-09-12 against installed and latest published `@lostgradient/cinder@0.26.0`. Adopt the following APIs as stable releases become available; each row can ship independently. The linked release gate records package versions and consumer evidence. MusicNotation, Fretboard, and PianoKeyboard stay local to Vibratone: they are application-specific and should evolve without a Cinder publish/release cycle. Their upstream proposals (CIN-621, CIN-622, and CIN-623) were canceled on 2026-09-12.

| Request                                                                                                                                              | Replace or simplify after release                                                                                                         | Preserve during adoption                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [CIN-619](https://linear.app/lost-gradient/issue/CIN-619/add-a-compact-size-to-choicegrid-for-answer-and-multi-select-controls): compact ChoiceGrid  | Button grids in `src/lib/components/note-scope.svelte`, `src/routes/fretboard/+page.svelte`, and `src/routes/key-signatures/+page.svelte` | Empty/nonadjacent selections, answer scoring, disabled states, responsive touch targets. |
| [CIN-620](https://linear.app/lost-gradient/issue/CIN-620/support-compact-slider-labels-and-formatted-values-through-the-public): Slider presentation | Private Slider/FormField CSS overrides in `src/lib/components/setup-card.svelte` and `src/routes/fretboard/+page.svelte`                  | Compact labels, formatted summaries, range clamping, distinct accessible thumb names.    |

Publication evidence is tracked in [CIN-624](https://linear.app/lost-gradient/issue/CIN-624/verify-published-cinder-instrument-and-compact-control-apis-for), natively blocked by the two generic-control feature tickets and [CIN-625](https://linear.app/lost-gradient/issue/CIN-625), which fixes Slider thumbs protruding beyond the control bounds. Verify endpoint alignment in both directions after that release. A merged feature is not a published API. Adopt each independently when its stable package artifact is verified; the aggregate gate stays open until every row has evidence.

- [ ] Record the exact released version and exported API for each adopted row. Inspect `npm view @lostgradient/cinder@<version> version dist.integrity gitHead --json` and the artifact from `npm pack @lostgradient/cinder@<version> --json`, substituting the numeric version. Cinder's source consumer validator alone does not prove registry contents.
- [ ] Upgrade with `bun add --exact @lostgradient/cinder@<version>`, update direct call sites, and remove replaced control CSS after parity checks pass. Keep the local instrument components, notation types, and direct `vexflow` dependency.
- [ ] Keep exercise generation, key/note/string/octave/fret scoping, scoring, audio, and saved-tuning storage in Vibratone. Reuse public Cinder primitives inside those compositions.
- [ ] Run `bun run check`, `bun run lint`, `bun run test:unit -- --run`, `bun run test:e2e:production`, and `bun run test:e2e:development`. Verify 320/768/1280-pixel layouts in both themes, keyboard interaction, hydration, and the row-specific behavior above.
- [ ] Mark adopted rows with the installed version and verification evidence; leave unshipped rows unchecked.

Already available in 0.26.0: NavigationBar's responsive menu, Card footers, FormField, CheckboxGroup, ChoiceGrid multiple selection, and SegmentedControl multiple/detached/small controls. Prefer those APIs today. The ChoiceGrid request adds compact presentation to its existing selection and grading behavior; it does not introduce another toggle-group component.

## Engine and Feasibility Spike

This is a prerequisite before broad feature work. It prevents later roadmap work from accumulating schema and timing debt.

**Ship scope:**

- Define the shared drill schema: prompt, stimulus, answer surface, validation, scoring event, analytics dimensions, FSRS card identity, and shareable configuration.
- Build the lookahead audio scheduler using `AudioContext.currentTime` plus a bounded JavaScript timer lookahead.
- Convert the existing note trainer into the first consumer of the drill engine.
- Prototype sample loading with real piano and guitar tones using `decodeAudioData` and `AudioBufferSourceNode`.
- Prototype microphone pitch detection using `getUserMedia`, `AnalyserNode`, and `pitchy`.
- Measure pitch-detection failure modes: octave errors on higher voices, clarity thresholds, noisy rooms, latency, and device variance.
- Decide whether notation is in this roadmap. If yes, select VexFlow, abcjs, or OpenSheetMusicDisplay and scope it explicitly. If no, cut sight-reading and staff dictation from this roadmap.

**Acceptance criteria:**

- The current note drill runs through the new drill engine without losing existing behavior.
- Seeded prompts produce reproducible sessions.
- Audio sequences can schedule at least 16 future notes without audible drift in a local browser smoke test.
- The pitch detector reports note, cents offset, and clarity from microphone input, and logs octave-error cases for manual review.
- Notation is either accepted as a first-class work stream with a renderer decision or explicitly deferred.

**Quality gate:**

- `bun run check`
- `bun run lint`
- `bun run test:unit -- --run`
- `bun run test:e2e`
- Responsive Playwright smoke at phone, tablet, and desktop widths for the current note drill.
- Manual Chrome and Safari audio smoke.
- Manual microphone allow, deny, and cleanup smoke.

## AP Trainer MVP

**User outcome:** A learner can start a serious AP training session that is visibly different from generic note guessing.

**Ship scope:**

- Add a first-run goal choice: Absolute Pitch, Relative Pitch, Theory, or Explore. Default to Absolute Pitch.
- Add an absolute-pitch placement test: cold, timed, no feedback, no reference pitch, randomized octave spacing.
- Add research-aligned AP training mode: 800 ms prompts, timed answers, optional feedback levels, and pitch-class focus.
- Add real sampled piano and guitar prompt banks.
- Add answer-training mode for early levels: listen to candidate pitch classes before committing.
- Add wrong-answer replay: original prompt, correct answer, and nearest-confusion explanation.
- Add a claims page explaining what AP is, what the product trains, and what it does not promise.

**Acceptance criteria:**

- A first-time learner can complete placement and start a recommended AP level in one flow.
- Placement results do not warm up the learner with answer feedback.
- The app records pitch-class accuracy, semitone error, response time, octave, timbre, and whether feedback was available.
- The AP mode can run without an intentional reference pitch.

## Local FSRS and AP Analytics

**User outcome:** Practice stops being random and starts being scheduled around memory.

**Ship scope:**

- Add `ts-fsrs` or an equivalent local FSRS implementation.
- Model AP cards at minimum as pitch class x timbre, with octave and register attempts stored as dimensions.
- Add review states: new, learning, review, and relearning.
- Add the first weak-card queue generated by FSRS due state and confusion data.
- Add confusion matrix: target pitch class versus guessed pitch class.
- Add "cold open" daily test before any warm-up practice.
- Add auditory-working-memory mini-assessment for expectation setting, not gatekeeping.

**Acceptance criteria:**

- Every AP answer updates an FSRS card and an immutable local review log.
- The Today surface can show due AP cards and a cold check separately.
- A user can export and import local progress without an account.
- The dashboard can answer which pitch classes are weak, what they are confused with, and whether the weakness is timbre- or octave-dependent.

## Research-Derived AP Level Progression

**User outcome:** The AP path has a credible curriculum instead of a pile of settings.

**Ship scope:**

- Implement a research-derived level ladder with pitch introduction order, mastery thresholds, timed response windows, feedback and no-feedback levels, and delayed final-level checks.
- Add out-of-bound tones to early levels to reduce high-versus-low shortcuts.
- Add Shepard-tone disruption before no-feedback levels that follow sample listening.
- Add level-jumping when performance clearly exceeds the current level.
- Add stuck-state recovery: after repeated misses, suggest a lower level or targeted contrast drill.
- Add generalized confusion-pair micro-drills.

**Acceptance criteria:**

- Level advancement depends on measurable accuracy and response-time criteria, not total attempts alone.
- The product can explain why the next pitch was introduced.
- Final mastery requires repeated performance, including a delayed cold pass.
- Learners can see progress as pitches learned at 90%+ accuracy and current response-time window.

## Transfer, Register, and Singing

**User outcome:** The AP program starts testing whether the learner knows pitch class across timbre and register, and microphone singing moves from speculative to useful.

**Ship scope:**

- Add transfer tests across sampled piano, guitar, sine, warm synth, and piano-like synth.
- Add register training as an advanced AP branch: name note plus octave.
- Add AP production prompts: hear "A", then sing or hum it; the app scores nearest note, cents error, and octave.
- Add pitch-matching and scale-degree singing with microphone input if the engine spike feasibility checks pass.
- Add octave-error handling: flag likely second-harmonic dominance rather than scoring it as a normal pitch-class miss.
- Keep rhythm microphone work out of scope until latency and onset timing have been measured on real devices.

**Acceptance criteria:**

- The learner can distinguish pitch-class score from note-plus-register score.
- The app reports transfer separately from trained-timbre performance.
- Microphone streams stop when the learner leaves the drill.
- Pitch detection confidence uses clarity thresholds and records uncertain attempts separately from wrong attempts.

## Public AP Beta and Proof Loop

**User outcome:** Vibratone has a public-facing wedge, not just a private practice tool.

**Ship scope:**

- Launch the AP beta as the main product experience.
- Add an opt-in eight-week AP program with expected time commitment and honest caveats.
- Add progress cards the learner can share without leaking detailed data.
- Add a daily AP puzzle with Wordle-style result sharing.
- Add individual progress report generation from local data.
- Add a visible "research mode" toggle that uses stricter protocol settings.

**Acceptance criteria:**

- A visitor can understand the AP promise and caveat in under one minute.
- A learner can share a daily result without creating an account.
- The product can produce an individual eight-week progress report from local data.
- No account or database is required for the beta, daily puzzle, share cards, or individual report.

## Answer Surfaces, MIDI, and Accessibility

**User outcome:** Learners can answer on the instrument surface they actually use, and blind or low-vision musicians are not an afterthought.

**Ship scope:**

- Add configurable answer surfaces: piano, guitar fretboard, bass fretboard, letter buttons, solfege, scale-degree numbers, and keyboard shortcuts.
- Add Web MIDI input as a desktop progressive enhancement for note, interval, chord, and scale construction answers.
- Add explicit MIDI compatibility messaging: supported browsers get setup; unsupported Safari and iOS users get a clear fallback.
- Add screen-reader-first AP flow: prompt, answer, feedback, score, and navigation all usable without visual piano keys.
- Add "explain my settings" copy for beginners.

**Acceptance criteria:**

- A guitar learner can answer AP drills on a configurable fretboard.
- MIDI input can answer a single-note prompt on supported browsers.
- Unsupported MIDI environments fail gracefully with no broken controls.
- Keyboard-only and screen-reader smoke checks pass for the core AP flow.

## Functional and Singer Tracks

**User outcome:** Relative-pitch expansion begins where the market is strongest: tonal context and singing, not isolated interval trivia.

**Ship scope:**

- Add the Relative Pitch track as a separate path, not a level after AP.
- Add tonic drone and cadence setup.
- Add scale-degree identification in major and natural minor.
- Add scale-degree singing: "establish key, then sing degree."
- Add movable-do, fixed-do, letter-name, and scale-degree answer modes.
- Add pocket mode: hands-free prompts with spoken answers after a delay.

**Acceptance criteria:**

- Relative Pitch users can start without taking an AP placement test.
- Drone, cadence setup, both, or neither are configurable.
- Singing feedback reports note, cents, clarity, and whether the scale degree was correct.
- Pocket mode runs without requiring visual interaction after start.

## Intervals and Chords as Supporting Skills

**User outcome:** Intervals and chords arrive as useful supporting tools with strong feedback, not as commodity checkboxes.

**Ship scope:**

- Add interval identification: ascending, descending, harmonic, and in-key context.
- Add interval singing and interval construction.
- Add chord identification for triads and seventh chords.
- Add blocked and arpeggiated chord playback.
- Add chord-tone recognition: root, third, fifth, seventh, and bass.
- Add explain-my-mistake feedback: semitone distance, scale context, chord role, and optional reference-song mnemonic.

**Acceptance criteria:**

- Interval prompts use Octavian interval data.
- Chord prompts use Octavian chord data, inversions, and voicings.
- Confusion-pair drills work for intervals and chords, not just notes.
- Analytics track interval direction, chord quality, inversion, voicing, and playback style.

## Theory and Notation Track

**User outcome:** Theory becomes a sound-connected reference and practice surface.

**Ship scope:**

- Add theory explorers for notes, enharmonics, keys, scales, chords, Roman numerals, harmonic function, and cadences.
- Add natural-language drill builder v1: convert a constrained prompt into a valid drill configuration.
- If notation was accepted in the engine spike, add the selected renderer and implement note, interval, scale, and chord construction on staff.
- If notation was deferred, explicitly exclude sight-reading and staff dictation from this roadmap and focus on keyboard/fretboard/theory surfaces.
- Add key signature and scale construction drills.

**Acceptance criteria:**

- Every theory explorer uses Octavian as the source of truth.
- Natural-language drill output is validated against the drill schema before it can run.
- Any staff-based exercise has renderer tests and browser screenshots.
- No roadmap item depends on notation unless the renderer has shipped.

## AI Coach and Custom Practice

**User outcome:** The product can explain what to practice next in human terms.

**Ship scope:**

- Add AI coach over local analytics: weak concepts, confusion pairs, retention state, and suggested sessions.
- Add "why this drill" explanations generated from deterministic data first, then optionally rewritten by AI.
- Add custom drill builder across AP, scale-degree, interval, chord, and theory tracks.
- Add interleaved practice scheduler that mixes due cards across selected tracks.
- Add saved practice packs and share links.

**Acceptance criteria:**

- The AI coach never sees raw microphone audio.
- A deterministic recommendation exists even when AI is unavailable.
- A custom drill share link reconstructs the same configuration.
- Interleaving respects due FSRS cards and user-selected tracks.

## Accountless Teacher and Assignment Exports

**User outcome:** Teachers can try the product in real settings before Vibratone has accounts, cloud sync, billing, or a database.

**Ship scope:**

- Add assignment packs with target repetitions, retention targets, and due dates.
- Add local classroom mode: roster aliases, one-device practice, and CSV export.
- Add teacher share links for placement tests, AP programs, and custom drills.
- Add printable practice plans and local progress summaries.
- Add claims and evidence page with citations and caveats.

**Acceptance criteria:**

- A teacher can send a link, receive exported results, and avoid collecting unnecessary personal data.
- CSV export includes learner alias, drill identifier, attempts, accuracy, response time, FSRS state, and weak concepts.
- A learner can complete an assignment without creating an account.
- No feature in this milestone requires auth, cloud storage, a database, billing, or server-side roster state.

## Production Track and Suite Integration

**User outcome:** Vibratone becomes a credible platform while preserving the AP wedge.

**Ship scope:**

- Add a Producer track prototype: EQ-band identification, filter sweeps, compression detection, reverb amount, delay time, stereo width, and distortion.
- Add a small step sequencer and chord progression lab as creative tools, built on the scheduler from the engine spike.
- Add a unified Today surface across all tracks.
- Add launch documentation: AP program, relative-pitch track, teacher workflow, privacy, accessibility, responsive web behavior, microphone, MIDI, and browser support.

**Acceptance criteria:**

- The AP track remains the primary landing-page story.
- The Producer track uses Web Audio nodes already present in the audio engine.
- The step sequencer proves scheduled playback without becoming a DAW.
- The Today surface can recommend one AP item, one optional supporting item, and one free-play item without forcing a single ladder.
- All core roadmap flows pass responsive smoke checks at phone, tablet, and desktop widths.
- The suite prototype still runs without auth, a database, billing, or cloud sync.

## Database Foundation

**User outcome:** The product can safely accept opt-in aggregate data without turning local-first practice into an account system.

**Ship scope:**

- Choose and wire the database layer behind a narrow server boundary.
- Add schemas for anonymous aggregate AP outcomes, daily puzzle aggregate results, public report snapshots, and operational audit events.
- Add privacy review gates before any local data leaves the browser.
- Add data retention, deletion, and export procedures for anonymous submissions.
- Add local/offline fallback behavior when the database is unavailable.

**Acceptance criteria:**

- Existing local-first flows continue to work when the database is disabled or unreachable.
- Anonymous submissions never include raw microphone audio, direct personal identifiers, or full local history.
- Database writes are opt-in, schema-versioned, and testable.
- The app can display a clear privacy boundary before the first submission.

## Anonymous Aggregate Efficacy and Global Puzzles

**User outcome:** Vibratone can publish proof loops and global puzzle results without requiring accounts.

**Ship scope:**

- Add opt-in anonymous aggregate efficacy submission: retention curve, cold-test accuracy, response-time change, pitch count learned, transfer gap, and protocol settings.
- Add public aggregate outcome report generated from database snapshots.
- Add global daily puzzle stats and share counters.
- Add research-mode export for anonymized study datasets.
- Add abuse-resistant rate limits that do not require login.

**Acceptance criteria:**

- A learner can use the product fully without submitting aggregate data.
- Aggregate reports show sample size and protocol caveats.
- Daily puzzle global stats work without user accounts.
- Dataset export strips direct identifiers and excludes raw audio.

## Auth Foundation

**User outcome:** Vibratone gains identity only after local-first value and database boundaries are proven.

**Ship scope:**

- Add auth provider integration, session handling, sign-in, sign-out, and account deletion.
- Add route guards and permission checks for account-only surfaces.
- Add local-to-account migration for progress, saved packs, and assignment history.
- Add account profile, privacy settings, data export, and data deletion.
- Add test fixtures for authenticated, anonymous, and signed-out states.

**Acceptance criteria:**

- Anonymous/local use remains available after auth ships.
- A learner can create an account and import existing local progress explicitly.
- Sign-out does not delete local data unless the user chooses to.
- Authenticated routes reject unauthorized access in tests.

## Cloud Sync, Paid Entitlements, and User Accounts

**User outcome:** Learners who want continuity across devices or paid guided training can opt into accounts without weakening the free local-first experience.

**Ship scope:**

- Add cloud sync for progress, FSRS state, saved practice packs, custom drills, and preferences.
- Add conflict resolution between local and cloud progress.
- Add paid entitlement checks for Consumer Pro, specialist packs, and one-time AP program unlocks.
- Add billing integration, subscription state, receipts, and cancellation handling.
- Add account-level data export and deletion.

**Acceptance criteria:**

- Free local AP training still works without an account.
- Cloud sync is opt-in and recoverable after conflicts.
- Paid entitlements unlock product value without claiming guaranteed AP outcomes.
- Account deletion removes cloud data and documents what remains in local browser storage.

## Cloud Classroom, Community, and Integrations

**User outcome:** Authenticated teachers, cohorts, and community surfaces can build on the proven local product instead of forcing accounts on early learners.

**Ship scope:**

- Add teacher and student accounts, class rosters, cloud assignments, assignment grading, cohort dashboards, and progress reports.
- Add LMS integration candidates: Google Classroom, Canvas, and export APIs.
- Add community drill libraries, public content packs, challenge links, and opt-in leaderboards.
- Add moderation, privacy controls, and abuse reporting for public surfaces.
- Add research participation management for authenticated studies where identity or longitudinal consent is required.

**Acceptance criteria:**

- Teachers can manage cloud assignments without collecting unnecessary student data.
- Students can join by invite and understand what data is shared with the teacher.
- Community surfaces are opt-in and can be disabled without affecting core training.
- LMS and export APIs are behind explicit permission checks.

## Product Metrics

**Activation:**

- Placement completion rate.
- First training session started within 30 seconds of placement result.
- First cold test completed without a reference pitch.

**Learning:**

- Cold pitch-class accuracy.
- Mean semitone error.
- Response time on correct answers.
- Number of pitch classes held at 90%+ under strict test settings.
- Trained-timbre versus transfer-timbre gap.
- Register accuracy for learners who enter the register branch.
- FSRS retention forecast versus observed recall.

**Habit:**

- AP program week-two retention.
- Due-card completion rate.
- Practice days per week.
- Recovery after missed days.

**Business before auth/database:**

- Free placement to AP program start.
- Teacher share-link creation.
- Assignment export count.
- Daily puzzle shares.

**Business after database/auth:**

- Aggregate report submission rate.
- Account creation after AP beta use.
- AP program start to Pro conversion.
- Paid entitlement activation.
- Cloud sync adoption.
- Authenticated classroom creation.

**Trust:**

- Percentage of claims backed by citations.
- Percentage of aggregate reports generated from opt-in data.
- Accessibility task completion without sight.

## Revenue Hypotheses

**Free before auth/database:** Placement test, current note trainer, daily AP puzzle, limited AP levels, basic theory explorer, local export, accountless assignment completion, and share links.

**Consumer Pro after auth:** Full AP program, FSRS scheduler, detailed analytics, sampled instruments, transfer tests, register branch, custom drills, AI coach, cross-device sync, and shareable progress reports.

**Teacher before auth/database:** Assignment packs, local classroom mode, CSV exports, teacher share links, progress summaries, and printable practice plans.

**Teacher Pro after auth:** Teacher accounts, student accounts, cloud rosters, cloud assignments, grading, cohort dashboards, LMS integrations, and paid seats.

**Specialist Packs:** Singer track, guitarist track, producer track, and theory track. These should be optional expansions, not prerequisites for AP learners.

Pricing should be validated after the public AP beta has real usage and efficacy data. The roadmap should not assume a subscription can survive against cheaper or free incumbents without proof of differentiated outcomes.

## Opportunity Backlog

**High leverage:**

- FSRS card model for every trainable atom.
- Guitar and bass fretboard answer surfaces.
- Web MIDI input as a progressive enhancement.
- Real sampled piano and guitar prompt banks.
- Explain-my-mistake layer across AP, intervals, chords, and scale degrees.
- AI coach over local analytics.
- Daily global puzzle and accountless sharing.
- Accessibility-first interaction model.
- Claims page before the database line; aggregate public efficacy after the database line.
- Producer/audio-engineering track.
- Accountless teacher assignments and CSV export.

**Later or conditional:**

- Full rhythm dictation, only after input-latency feasibility is measured.
- Staff sight-reading and staff dictation, only after notation renderer adoption.
- Database-backed aggregate reports, only after local-first proof loops work.
- Auth, cloud accounts, paid entitlements, and sync, only after local-first flows and database boundaries prove value.
- Leaderboards, only if they do not distort learning incentives.
- Microtonal and non-Western scale systems, only after the AP and relative-pitch core is stable.

## Complete Product Inventory

This inventory is deliberately broader than the execution roadmap. It is not a priority order. A feature should move from this catalog into the roadmap only after it has a clear learner outcome, card model, scoring model, acceptance criteria, and verification gate.

**Core learning engine:**

- Universal attempt event model.
- Universal scoring model.
- Universal feedback model.
- Universal recommendation engine.
- Universal analytics dimensions.
- Skill graph and prerequisite graph.
- Mastery, confidence, retention, and skill-decay models.
- Spaced repetition scheduler.
- Difficulty calibration.
- Placement testing.
- Adaptive lesson generation.
- Adaptive review generation.
- Session planning engine.
- Daily workout generator.
- Weakness clustering.
- Concept dependency tracking.
- Learning-path generation.
- Session fatigue detection.
- Progress forecasting.
- Goal-based recommendations.

**Assessment system:**

- Absolute-pitch assessment.
- Relative-pitch assessment.
- Functional-hearing assessment.
- Interval assessment.
- Chord assessment.
- Harmony assessment.
- Rhythm assessment.
- Singing assessment.
- Musicianship assessment.
- Placement exams.
- Certification paths.
- Progress checkpoints.
- Skill badges.
- Mastery reports.
- Historical comparisons.
- Before-and-after assessments.
- Retention assessments.
- Research-grade AP testing protocol.

**Ear-training expansion:**

- Octave identification.
- Register identification.
- Pitch contour recognition.
- Tonal-center identification.
- Key-change detection.
- Modulation detection.
- Chord-progression continuation.
- Bass-line transcription.
- Inner-voice identification.
- Voice-leading recognition.
- Phrase-ending recognition.
- Harmonic-rhythm recognition.
- Tension-resolution recognition.
- Non-diatonic chord recognition.
- Borrowed-chord recognition.
- Secondary-dominant recognition.
- Tritone-substitution recognition.
- Modal-interchange recognition.
- Jazz-turnaround recognition.
- Common-cadence recognition.
- Counterpoint listening.
- Polyphonic listening.

**Rhythm expansion:**

- Beat finding.
- Meter identification.
- Conducting patterns.
- Polyrhythm recognition.
- Polyrhythm performance.
- Tuplet recognition.
- Tuplet performance.
- Swing recognition.
- Groove comparison.
- Humanized-timing analysis.
- Syncopation drills.
- Subdivision drills.
- Tempo memory.
- Tempo estimation.
- Tempo reproduction.
- Groove transcription.
- Drum-pattern dictation.
- Rhythmic-phrase memory.
- Metric-modulation exercises.

**Singing curriculum:**

- Pitch matching.
- Sustain control.
- Vibrato control.
- Intonation tracking.
- Interval singing.
- Chord-tone singing.
- Arpeggio singing.
- Scale singing.
- Solfege singing.
- Melody singing.
- Sight-singing.
- Call and response.
- Tonal-memory singing.
- Singing warmups.
- Vocal-range tracking.
- Vocal-development analytics.
- Pitch-drift detection.
- Breath-control exercises.
- Ear-to-voice transfer exercises.

**Instrument-specific tracks:**

- Guitar ear training.
- Piano ear training.
- Bass ear training.
- Voice ear training.
- Strings ear training.
- Wind ear training.
- Brass ear training.
- Producer ear training.
- Fretboard hearing.
- Keyboard hearing.
- Chord-voicing recognition.
- Instrument-range awareness.
- Instrument-transposition awareness.
- Timbre-specific identification.

**Producer track:**

- EQ-frequency training.
- Compression recognition.
- Reverb recognition.
- Delay recognition.
- Saturation recognition.
- Distortion recognition.
- Stereo-width recognition.
- Phase recognition.
- Frequency-masking recognition.
- Dynamics recognition.
- Loudness comparison.
- Mixing-problem identification.
- Ear-fatigue detection.
- Mastering-comparison exercises.

**Composition track:**

- Motif development.
- Melody writing.
- Bass-line creation.
- Countermelody creation.
- Chord-progression creation.
- Reharmonization.
- Voice leading.
- Arrangement exercises.
- Orchestration exercises.
- Cadence writing.
- Song-form exercises.
- Harmonic analysis.
- Harmonic-variation exercises.

**Theory track:**

- Interactive lessons.
- Guided theory paths.
- Exercises tied to lessons.
- Flashcards.
- Circle-of-fifths explorer.
- Chord-relationship explorer.
- Functional-harmony explorer.
- Voice-leading explorer.
- Modal-interchange explorer.
- Jazz-harmony explorer.
- Counterpoint explorer.
- Composition explorer.
- Interactive keyboard.
- Interactive fretboard.
- Interactive staff.

**Content system:**

- Lesson engine.
- Course engine.
- Module engine.
- Unit engine.
- Exercise playlists.
- Drill playlists.
- Practice plans.
- Daily plans.
- Weekly plans.
- Learning tracks.
- Learning paths.
- Content versioning.
- Curriculum versioning.
- Localization.
- Community content packs.

**Community features:**

- Public profiles.
- Progress sharing.
- Challenge links.
- Leaderboards.
- Friend challenges.
- Teacher groups.
- Practice groups.
- Community drills.
- Public drill library.
- Public content packs.
- Community-created lessons.
- Community-created exercises.

**Classroom features:**

- Teacher accounts.
- Student accounts.
- Class rosters.
- Assignment management.
- Assignment grading.
- Skill dashboards.
- Curriculum planning.
- Progress reports.
- Class comparisons.
- Intervention recommendations.
- LMS integration.
- Google Classroom integration.
- Canvas integration.
- Export APIs.

**Platform features:**

- Event-sourced analytics.
- Offline-first architecture.
- Sync engine.
- Conflict resolution.
- Version migrations.
- Audit logs.
- Diagnostic bundle.
- Feature flags.
- Experiment framework.
- A/B testing.
- Telemetry.
- Privacy controls.
- Data export.
- Data deletion.
- Backup and restore.

**Accessibility features:**

- Full keyboard support.
- Screen-reader support.
- High-contrast themes.
- Reduced motion.
- Large touch targets.
- Caption support.
- Alternative visualizations.
- One-handed mode.
- Left-handed mode.
- Dyslexia-friendly typography.
- Color-blind-safe modes.
- Hearing-impaired theory mode.

**Audio engine expansion:**

- Sample library.
- Instrument packs.
- Drum kits.
- Audio effects rack.
- Audio graph visualizer.
- Oscilloscope.
- Spectrum analyzer.
- Spectrogram.
- Stereo visualization.
- Frequency analyzer.
- Audio recorder.
- Prompt rendering engine.
- Audio export.
- MIDI export.
- MusicXML export.

**MIDI features:**

- MIDI keyboard input.
- MIDI controller support.
- MIDI output.
- MIDI learn.
- Velocity-sensitive exercises.
- Aftertouch support.
- Sustain-pedal support.
- Chord capture.
- Melody capture.
- MIDI playback.
- MIDI practice mode.

**AI features:**

- AI-generated practice plans.
- AI-generated drills.
- AI-generated lessons.
- AI-generated explanations.
- AI-generated feedback.
- AI-generated analysis.
- AI-generated composition prompts.
- AI-generated singing feedback.
- AI-generated progress summaries.
- AI tutor mode.

**Research features:**

- Anonymous study participation.
- Experimental protocols.
- A/B curriculum testing.
- Retention studies.
- Skill-acquisition studies.
- Dataset export.
- Research dashboards.
- Learning-science experiments.

**Mobile web features:**

- Responsive layouts for every core drill, dashboard, answer surface, and share view.
- Touch-first answer surfaces.
- Phone-friendly quick practice mode.
- Daily puzzle and share cards.
- Pocket mode for hands-free listening.
- Microphone singing drills on supported mobile browsers.
- Offline practice packs through PWA storage if feasibility checks pass.
- Web Push reminders where browser support and permission prompts are acceptable.
- Home-screen install support.
- Explicitly out of scope for this roadmap: native iOS, native Android, and watch applications.

**Commercial features:**

- Free tier.
- Pro tier.
- Classroom tier.
- Lifetime license.
- Content marketplace.
- Premium content packs.
- School licensing.
- Team licensing.
- Enterprise licensing.
- Affiliate program.

**Potential product lines:**

- Vibratone Absolute Pitch.
- Vibratone Ear Training.
- Vibratone Relative Pitch.
- Vibratone Singing.
- Vibratone Theory.
- Vibratone Harmony.
- Vibratone Rhythm.
- Vibratone Producer.
- Vibratone Classroom.
- Vibratone Research.

These product lines should share the same theory engine, audio engine, exercise engine, analytics engine, curriculum engine, and content engine. That platform view matters because the exercise catalog is effectively unbounded; the durable work is generating, delivering, scoring, adapting, and explaining musical learning experiences.

## Octavian Product Map

- **Notes, MIDI, frequency, enharmonics, tuning:** AP prompts, note explorer, register training, alternate tuning, and transposition.
- **Intervals and consonance helpers:** Interval drills, mistake explanations, singing prompts, and dissonance lessons.
- **Chords, inversions, voicings, figured bass:** Chord identification, chord construction, chord-tone drills, and voicing labs.
- **Scales and modes:** Scale-degree training, scale construction, mode explorer, and melodic prompt generation.
- **Keys, key signatures, and circle of fifths:** Functional context, key explorer, key-signature drills, and transposition.
- **Roman numerals, harmonic function, and cadences:** Progression drills, harmonic analysis, and cadence identification.
- **Random note and interval helpers:** Seeded sessions, reproducible assignments, and daily puzzles.
- **Answer comparison helpers:** Mistake explanations, confusion-pair drills, and answer equivalence across surfaces.
- **Keyboard layout helpers:** Piano answer surfaces, keyboard hearing, and note/chord/scale highlighting.
- **Performance timing and export helpers:** Rhythm scoring, MIDI capture, step-sequencer interchange, and Standard MIDI File export.

## Web Audio Product Map

- **`AudioContext`, `OscillatorNode`, `GainNode`, `AudioParam`:** Current synth, envelopes, timed prompts, and feedback.
- **`AudioBuffer`, `AudioBufferSourceNode`, `decodeAudioData`:** Sampled piano, guitar, percussion, and transfer tests.
- **`BiquadFilterNode`, `IIRFilterNode`, `ConvolverNode`, `DelayNode`, `WaveShaperNode`, `DynamicsCompressorNode`:** Producer track, sound-design lab, and richer timbres.
- **`AnalyserNode`:** Pitch detection, waveform display, spectrum display, and singing feedback.
- **`MediaStreamAudioSourceNode` and `getUserMedia`:** Microphone pitch matching and singing drills.
- **`OfflineAudioContext`:** Deterministic prompt rendering and future downloadable examples.
- **`StereoPannerNode`, `PannerNode`, channel splitters, and channel mergers:** Stereo-width drills, bass isolation aids, and production exercises.
- **`AudioWorklet`:** Future low-latency pitch and rhythm analysis if main-thread analyser work is insufficient.

## Risks and Mitigations

- **Overclaiming AP:** Make claims narrow, cited, and measured. Report group averages and individual variance.
- **AP does not serve every learner:** Keep Relative Pitch, Theory, and Production as separate tracks.
- **Schema debt:** The engine spike freezes the drill event model before broad feature work.
- **Timing debt:** Lookahead scheduling ships before intervals, arpeggios, drones, rhythm, or sequencers.
- **SRS complexity:** Start with default FSRS parameters and local logs before optimizing per learner.
- **Microphone false confidence:** Gate on clarity, track uncertain attempts, detect octave-error patterns, and defer rhythm until latency is measured.
- **Notation scope creep:** Staff exercises require an explicit renderer decision and verification plan.
- **MIDI browser gaps:** Treat Web MIDI as progressive enhancement, with explicit Safari and iOS fallback paths.
- **Competitive drift:** Sonofield is already strong on drone-based contextual training; AP honesty and measured outcomes remain the clearer wedge.
- **Privacy:** Keep local-first by default. Opt in before aggregate reporting, AI analysis, cloud sync, or teacher exports.

## Source Notes

- [Wong, Cheung, Ngan, and Wong, "Learning fast and accurate absolute pitch judgment in adulthood," Psychonomic Bulletin & Review, 2025](https://link.springer.com/article/10.3758/s13423-024-02620-2).
- [Octavian GitHub repository](https://github.com/stevekinney/octavian) and installed `octavian@3.0.0` public type exports.
- [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API), [advanced sequencing tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques), [visualizations guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API), and [getUserMedia documentation](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
- [Free Spaced Repetition Scheduler](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler) and [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs).
- [pitchy pitch-detection library](https://www.skypack.dev/view/pitchy).
- [MDN Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) and [WEBMIDI.js browser support notes](https://webmidijs.org/docs/getting-started/).
- [VexFlow](https://www.vexflow.com/).
- [musictheory.net exercises](https://www.musictheory.net/exercises), [EarMaster](https://www.earmaster.com/products/ear-training-sight-singing/earmaster-cloud-edition.html?d3FIG=VvpMv03U&id=16), [ToneGym](https://www.tonegym.co/dashboard/gym?in=zxp4q5qmhm9&lg=en), [TonedEar](https://tonedear.com/), [Perfect Ear](https://perfectear.app/), [Tone](https://apps.apple.com/us/app/tone-learn-perfect-pitch/id1139019670), and [Sonofield](https://sonofield.com/apps/ear-trainer).

## Octavian 3.2 integration

Reviewed the published 3.2.0 API against 3.1.0. Five functions were added:

- `identifyChords`: recognizes unordered notes, ranks alternative names, and reports exact versus practical matches.
- `identifyGuitarChords`: recognizes absolute fret positions with custom tuning; `0` means open and `null` means muted.
- `identifyPianoChords`: recognizes pressed piano keys with the same alternative-name and omission metadata.
- `guitarFingeringsFor`: lazily enumerates playable shapes, finger assignments, and barres with tuning, fret range, span, finger count, and omission constraints. Slash chords constrain the bass.
- `pianoVoicingsFor`: lazily enumerates keyboard voicings with keyboard range, hand allocation, note count, hand span, and omission constraints. Its hand allocations are not individual finger numbers.

The chord workspace uses guitar recognition and fingering generation directly. Searches run in a cancellable background worker and load successive batches without imposing a total result cap. Results follow Octavian's enumeration order, not a difficulty ranking. Practical omissions are opt-in and remain visible beside each match or shape.

Chord training derives varieties from Octavian's catalog and diatonic triads or sevenths from its scale API. Shared note scoping supports all seven diatonic modes. Music notation, chord charts, fretboards, and piano keyboards remain local application components.
