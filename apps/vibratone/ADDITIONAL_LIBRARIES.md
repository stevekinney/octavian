# Additional Library Decisions

This file captures package-boundary decisions from the Vibratone roadmap. The goal is as many libraries as we truly need and as few as we can get away with.

The short version: Octavian should grow through explicit subpath exports for reusable music and sound primitives, while Vibratone keeps the learning product engine in the application until a second product proves the abstraction.

## Boundary Rule

**Start in Octavian when the code is a reusable music primitive:**

- Notes, pitch classes, intervals, chords, scales, keys, progressions, rhythm, tuning systems, and instrument metadata.
- Renderer-neutral music data models.
- Deterministic conversion between notes, chords, scales, progressions, sequences, MIDI messages, and frequencies.
- Small optional adapters that are imported explicitly and accept caller-owned browser objects.

**Start in Vibratone when the code is product behavior:**

- Drill schemas, prompt sequencing, answer validation flows, FSRS scheduling, learner state, mastery rules, placement tests, and analytics.
- Absolute-pitch protocols, cold tests, transfer tests, register gates, and coach recommendations.
- Teacher workflows, daily puzzles, share cards, cohort reports, and monetization surfaces.
- Renderer-specific UI decisions and exercise-specific interaction design.

**Extract a new package only when reuse is real:**

- A second product needs the code.
- The dependency weight would be wrong for Octavian.
- The package owns browser lifecycle, assets, permissions, or state in a way Octavian should not.
- The API can be described without Vibratone-specific learner concepts.

## Octavian Subpath Exports

These should be Octavian subpath exports rather than standalone packages. They keep Octavian batteries-included without forcing every user to import browser code, Web Audio code, or optional dependencies from the root entrypoint.

The packaging strategy is tracked in [Octavian #34](https://github.com/stevekinney/octavian/issues/34).

| Export               | Tracking Issue                                           | Belongs in Octavian                                                                                                       | Does Not Own                                                                                                                   |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `octavian/sequences` | [#30](https://github.com/stevekinney/octavian/issues/30) | Timed music events, sequence normalization, loop/bar helpers, and conversion between musical time and schedulable events. | AudioContext lifecycle, playback transport state, sample caches.                                                               |
| `octavian/midi`      | [#31](https://github.com/stevekinney/octavian/issues/31) | MIDI message parsing, note-on/note-off state, velocity normalization, and conversion to Octavian notes/chords/sequences.  | Browser permission prompts, device selection UI, persistent device preferences.                                                |
| `octavian/web-midi`  | [#31](https://github.com/stevekinney/octavian/issues/31) | A thin optional Web MIDI adapter that accepts caller-managed permission and device choices.                               | Browser support messaging, Safari/iOS fallbacks, product-specific capability gates.                                            |
| `octavian/web-audio` | [#32](https://github.com/stevekinney/octavian/issues/32) | A thin optional renderer from Octavian notes, chords, and sequences to scheduled Web Audio operations.                    | A full audio engine, owned AudioContext lifecycle, microphone streams, sampled-instrument asset management, or exercise state. |
| `octavian/pitch`     | [#33](https://github.com/stevekinney/octavian/issues/33) | Frequency-to-note scoring, cents deviation, octave/register evaluation, and pitch-estimate grading.                       | `getUserMedia`, pitch-detection algorithms, analyser setup, latency calibration, or voice-specific heuristics.                 |
| `octavian/notation`  | [#27](https://github.com/stevekinney/octavian/issues/27) | Renderer-neutral notation events and serialization-friendly data.                                                         | VexFlow, abcjs, OpenSheetMusicDisplay, MusicXML rendering, or heavy renderer dependencies.                                     |

The existing theory issues also belong in Octavian: note naming [#18](https://github.com/stevekinney/octavian/issues/18), fretboard helpers [#19](https://github.com/stevekinney/octavian/issues/19), instrument metadata [#20](https://github.com/stevekinney/octavian/issues/20), chromatic harmony [#21](https://github.com/stevekinney/octavian/issues/21), progressions [#22](https://github.com/stevekinney/octavian/issues/22), voice leading [#23](https://github.com/stevekinney/octavian/issues/23), melodic analysis [#24](https://github.com/stevekinney/octavian/issues/24), rhythm [#25](https://github.com/stevekinney/octavian/issues/25), temperament [#26](https://github.com/stevekinney/octavian/issues/26), deterministic drill generation [#28](https://github.com/stevekinney/octavian/issues/28), and symbol parsing [#29](https://github.com/stevekinney/octavian/issues/29).

Second-pass Octavian issues from the roadmap audit: answer comparison [#35](https://github.com/stevekinney/octavian/issues/35), piano keyboard layout [#36](https://github.com/stevekinney/octavian/issues/36), performance timing and quantization [#37](https://github.com/stevekinney/octavian/issues/37), and Standard MIDI File serialization [#38](https://github.com/stevekinney/octavian/issues/38).

## Keep the Engine in Vibratone

Do not create `@lostgradient/music-learning-engine` now.

The trainer engine is valuable, but it is also where the product opinion lives. FSRS cards, AP mastery gates, cold-start retention checks, coach recommendations, weak-concept drills, teacher assignments, and progress export are all tightly coupled to Vibratone's learning model. Pulling that into a package before a second product needs it would force the app to pay an abstraction tax without a clear reuse dividend.

Keep the engine physically modular inside Vibratone:

- `learning/drills` for prompt, answer, and scoring contracts.
- `learning/scheduling` for FSRS and interleaving.
- `learning/analytics` for attempt events, mastery summaries, and progress curves.
- `learning/protocols` for absolute-pitch, relative-pitch, singer, theory, and producer-track rules.

That structure makes later extraction possible without pretending the API is already stable.

## Combined Extraction Watchlist

These are not immediate packages. They are the few candidates worth revisiting when there is clear reuse outside Vibratone.

**`@lostgradient/browser-audio`:**

This would combine the previous `@lostgradient/web-audio-engine` and `@lostgradient/pitch-input` ideas. They belong together because they both own browser audio lifecycle: `AudioContext` creation and teardown, lookahead transport, sample decoding, microphone stream cleanup, pitch-detection wrappers, latency calibration, device errors, and optional AudioWorklet support.

Do not put this in Octavian. Octavian can expose `octavian/web-audio` and `octavian/pitch` as thin adapters, but a stateful browser runtime is a different kind of package.

Extract this only when another project needs the same playback-and-input runtime.

**`@lostgradient/music-assets`:**

This would hold sampled piano, guitar, bass, percussion, timbre labels, velocity layers, pitch ranges, license manifests, and loading manifests.

Keep assets outside Octavian. Audio files change package size, licensing, caching, and deployment expectations. Extract this only when Vibratone has real licensed assets that should be shared by another project.

**`@lostgradient/music-learning-engine`:**

This remains a later option, not a current plan. It becomes real only if another learning product needs the same drill schema, FSRS card model, assessment protocol scaffolding, and progress import/export format.

Until then, keep it as Vibratone-internal modules.

**`@lostgradient/producer-listening-engine`:**

Keep producer-track generation inside Vibratone while the track is still being validated. If it proves useful in another product, extract the exercise generators and answer validators into their own package and let it depend on `@lostgradient/browser-audio` if that package exists.

## Deferred Ideas

**Renderer adapters:** Keep VexFlow, abcjs, OpenSheetMusicDisplay, MusicXML, and MIDI-file export adapters inside Vibratone until more than one app needs the same renderer bridge. Octavian should own the renderer-neutral notation model, not the renderer dependencies.

**Daily puzzle and sharing primitives:** Keep these in Vibratone. The accountless sharing model is a product loop, not a music library.

**AI coach prompts and natural-language drill builder:** Keep these in Vibratone. Octavian can parse and validate the resulting music objects, but the prompt strategy, safety rails, and coaching language are product-specific.

## Practical Decision

The roadmap should assume:

- New reusable music primitives become Octavian issues.
- Browser-runtime and asset-heavy surfaces start in Vibratone.
- The learning engine stays in Vibratone until there is a second consumer.
- The only near-term standalone package candidate is `@lostgradient/browser-audio`, and even that waits for real reuse pressure.
