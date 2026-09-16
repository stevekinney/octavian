# 24. Cloud Classroom, Community, and Integrations

## Outcome

A teacher can assign, track, and report on student AP progress through a cloud classroom without Vibratone becoming an account-mandatory product. A community learner can browse and share drill packs and opt into leaderboard rankings grounded in mastery, not attempt volume. Local-first AP practice continues to work identically for learners with no account.

## Product Requirements

**Must-have (blocks milestone completion):**

- Teacher and student account roles extending the auth layer from Milestone 23; class roster creation with invite-token join flow.
- Cloud assignment creation: a teacher assigns a `DrillConfig` (from Milestone 00) with a target repetition count, retention target (0–1), and due date.
- Per-student assignment completion tracking and grading: accuracy, mean response time, FSRS state at submission, and weak concept identifiers.
- Cohort dashboard: per-student pitch accuracy, mastery count, and assignment completion rate — no raw attempt history in cohort payloads.
- Moderation data model in place _before_ any public community content ships: `ContentPack` schema with `moderationStatus` and `abuseReports`.
- Opt-in community content browser and drill-pack sharing; visibility levels: `private`, `unlisted`, `public`.
- Abuse reporting UI that writes to the moderation record and transitions `moderationStatus` to `'flagged'`.
- Export API at `src/routes/api/classroom/[classId]/export/+server.ts` returning JSON or CSV of `AssignmentGrade[]`, permission-gated to the owning teacher.

**Should-have (ships if time allows; does not block milestone):**

- Opt-in leaderboard ranked by pitches-learned-at-90%-accuracy (mastery count), never by raw attempt volume or raw response speed.
- Challenge links for public content packs.
- Cohort progress report export (PDF or CSV download from the teacher dashboard).

**Could-have (explicit follow-on milestone candidate):**

- Authenticated research participation with longitudinal consent management (`ConsentRecord`); the schema is defined in this milestone but the research-enrollment UI and aggregate reporting are deferred.

**Won't-have this milestone:**

- Live LMS OAuth connections to Google Classroom or Canvas. The export-only API ships here; live connectors are a follow-on once the classroom model is stable. Routes and a stub are scaffolded but excluded from gate tests (see LMS seam below).
- Public profiles by default.
- Accounts required for core AP practice.

### LMS Integration Seam

Phase 1 (required): `GET /api/classroom/[classId]/export?format=json|csv` — teacher-authenticated, returns `AssignmentGrade[]`. No OAuth, no third-party dependency.

Phase 2 (scaffolded, feature-flagged, NOT gate-required): routes at `src/routes/api/integrations/[provider]/callback/+server.ts` and `src/routes/api/integrations/[provider]/disconnect/+server.ts`, behind `VIBRATONE_LMS_ENABLED=true` in `.env`. When `VIBRATONE_LMS_STUB=true`, the callback short-circuits and returns the fixture in `src/lib/server/lms-stub.ts`. Phase 2 surfaces are excluded from the E2E gate unless `VIBRATONE_LMS_TEST_ACCOUNT` is set.

## User Experience Requirements

- Teachers can manage cloud assignments without collecting unnecessary student data; roster records store only a student alias and an invite token until the student explicitly provides more.
- Students see a data-sharing notice listing exactly what will be shared (accuracy, mean response time, FSRS state, weak concept identifiers) before joining a class and before submitting an assignment. The submission button is blocked until the notice is explicitly dismissed.
- Community surfaces are opt-in per user account and can be disabled without affecting core training. Disabling hides the community tab and returns 404 for community routes for that session; no practice progress is cleared.
- Leaderboards rank by pitches-learned-at-90%-accuracy (cold-test mastery count). A user with 1,000 low-accuracy attempts does not outrank a user with 200 high-accuracy attempts. The ranking policy version is stored per snapshot so formula changes can be audited.
- LMS and export integrations explain permissions before initiating any OAuth redirect. Success and failure states are announced via an `aria-live="polite"` region.
- A learner with no account can complete the full AP placement-to-practice flow without encountering any classroom or community UI element.

## Data and Analytics Requirements

- Classroom records distinguish teacher-owned assignment data from learner-owned progress: `AssignmentGrade` fields visible to the teacher contain accuracy, mean response time, FSRS state at submission, and weak concept identifiers; per-attempt breakdowns, raw card state (`stability`, `difficulty`, `reps`), and attempt timestamps are learner-only.
- Roster and cohort report payloads follow least-data principles: student email, full name, and per-attempt breakdown are never included. Cohort API responses contain only alias, aggregate accuracy, drill completion count, and last-active date.
- Community content tracks ownership, visibility, version, `moderationStatus`, and `abuseReports[]`. A pack cannot be set to `visibility: 'public'` while `moderationStatus` is `'pending'` or `'flagged'`.
- Leaderboard payloads expose no `attempts`, `events`, `responseTimes`, or per-attempt note identifiers. Each `LeaderboardEntry` contains only: display alias, `pitchClassesAt90` count, weekly streak days, and rank.
- `ConsentRecord` schema is defined in this milestone. `withdrawnAt: number | null` — a non-null value stops new data collection for that study and blocks new research-event writes; prior records are preserved.
- Cohort reports and assignment exports display a data-minimization notice before download.

## Accessibility Requirements

- Roster and cohort tables: `<table>` with `<caption>`, `<th scope="col">` on all column headers, and `<th scope="row">` on row headers. No div-grid substitutes.
- Cohort report charts: every chart has a sibling `<table class="sr-only">` with identical data; the chart itself is `aria-hidden="true"`.
- Invite-code modal and data-sharing notice use `<dialog>` with `autofocus` on the first interactive element; Escape closes them; focus returns to the trigger button.
- Data-sharing notice uses `role="alertdialog"` with `aria-describedby` pointing to the sharing-summary paragraph.
- Leaderboard uses `<ol>` so screen readers announce ordinal position.
- Community opt-in toggle uses `<input type="checkbox">` with an associated `<label>`, not a custom div toggle.
- LMS connect permission screen announces connection success and failure via `aria-live="polite"`.
- Leaderboard and community content browser pages produce zero WCAG 2.1 AA violations when scanned with axe-core via Playwright.
- Responsive layout:

| Viewport    | Roster                | Cohort Report            | Assignment Create      |
| ----------- | --------------------- | ------------------------ | ---------------------- |
| ≥ 1024 px   | Full `<table>`        | Chart + accessible table | Inline modal           |
| 640–1023 px | Scrollable `<table>`  | Chart + accessible table | Slide-over             |
| < 640 px    | Card list per student | Summary stat row only    | Full-screen slide-over |

## Module and Architecture Targets

### Route group

All teacher, student, community, and research routes live under `src/routes/(authed)/`. The group guard at `src/routes/(authed)/+layout.server.ts` enforces authentication for the entire group and redirects unauthenticated visitors to `/login?returnTo=<encoded-path>`. It returns `{ user }` to all child layouts. Community routes add a second guard at `src/routes/(authed)/community/+layout.server.ts` that reads `locals.user.communityOptIn`; if false, it throws `error(404)` so community routes do not exist for opted-out users.

Accountless AP/RP/theory training routes remain in their existing route group and must not import anything from `(authed)/`.

### Route files

```
src/routes/(authed)/
  +layout.server.ts             — auth guard; returns { user }
  +layout.svelte                — authenticated shell (nav, role indicator)
  teacher/
    +page.server.ts             — load: list classes for locals.user
    +page.svelte                — teacher dashboard (class list)
    [classId]/
      +page.server.ts           — load: Classroom, Roster[], CloudAssignment[]
      +page.svelte              — class detail view
      assignments/
        new/
          +page.server.ts       — actions: ?/createAssignment
          +page.svelte          — assignment creation form
        [assignmentId]/
          +page.server.ts       — load: CloudAssignment, AssignmentGrade[]; actions: ?/gradeSubmission
          +page.svelte          — per-assignment grade view
      reports/
        +page.server.ts         — load: CohortReport
        +page.svelte            — cohort dashboard; accessible table twin required
  student/
    +page.server.ts             — load: enrolled classes, pending assignments
    +page.svelte                — student home
    join/
      +page.svelte              — invite-code entry; data-sharing notice (role='alertdialog')
    assignments/
      +page.server.ts           — load: CloudAssignment[] for this student
      +page.svelte              — student assignment list
      [assignmentId]/
        +page.server.ts         — load: CloudAssignment; actions: ?/submitAssignment
        +page.svelte            — assignment completion surface
  community/
    +layout.server.ts           — checks communityOptIn; error(404) if false
    +page.server.ts             — load: CommunityPack[] (cursor-based, limit 50), userOptIn: boolean
    +page.svelte                — pack browser; opt-in toggle
    leaderboard/
      +page.server.ts           — load: LeaderboardEntry[] (no raw attempt history)
      +page.svelte              — leaderboard surface (accessible <ol>)
    packs/[packId]/
      +page.server.ts           — load: CommunityPack; actions: ?/reportAbuse
      +page.svelte              — pack detail and play entry
  research/
    +page.server.ts             — load: studies; actions: ?/grantConsent, ?/withdrawConsent
    +page.svelte                — research participation manager

src/routes/api/
  classroom/
    +server.ts                  — POST: create class
    [classId]/
      +server.ts                — GET: class detail; PATCH: archive
      roster/+server.ts         — GET: roster; POST: add member; DELETE: remove member
      assignments/+server.ts    — GET: list; POST: create
      [assignmentId]/
        grade/+server.ts        — POST: submit grade (student); GET: grades (teacher)
      reports/+server.ts        — GET: cohort report
      export/+server.ts         — GET: CSV or JSON export (Phase 1 LMS seam)
  community/
    packs/+server.ts            — GET: public list (paginated, cursor-based); POST: create
    packs/[packId]/+server.ts   — GET, PATCH, DELETE
    packs/[packId]/report/+server.ts — POST: abuse report
  integrations/[provider]/
    callback/+server.ts         — GET: OAuth callback (Phase 2, VIBRATONE_LMS_ENABLED=true only)
    disconnect/+server.ts       — POST: revoke stored token (Phase 2)
  invites/[token]/+server.ts    — GET: validate token; POST: accept invite
  research/[studyId]/
    consent/+server.ts          — POST: grant consent; DELETE: withdraw
    submit/+server.ts           — POST: anonymized data payload
```

### Server utilities (`src/lib/server/`)

```
auth-helpers.ts               — requireUser(event), requireRole(event, role)
classroom-repository.ts       — all Classroom/Roster/CloudAssignment/AssignmentGrade DB calls
community-repository.ts       — all CommunityPack/ModerationRecord/AbuseReport DB calls
research-repository.ts        — ConsentRecord DB calls; anonymized submission write
lms-stub.ts                   — fixture data returned when VIBRATONE_LMS_STUB=true
invites.ts                    — generateInviteToken(classId): string; validateInviteToken(token): { classId, expiresAt } | null
```

`auth-helpers.ts` contract:

```ts
export function requireUser(event: RequestEvent): NonNullable<App.Locals['user']>;
export function requireRole(
	event: RequestEvent,
	role: 'teacher' | 'student'
): NonNullable<App.Locals['user']>;
```

Every form action and API route calls `requireUser`/`requireRole` directly — it cannot rely on the layout guard alone.

### Learning engine additions (`src/lib/learning/`)

```
protocols/classroom.ts         — classifyAssignmentGrade(), mergeCloudFsrsState()
analytics/cohort.ts            — buildCohortReport(), confusionMatrixPerRoster()
drills/community.ts            — CommunityDrillPack schema; validatePackSchema()
scheduling/assignment-queue.ts — queueCloudAssignment(); mergeLocalAndCloudFsrs()
```

### Components (`src/lib/components/`)

Following the existing `kebab-case.svelte` + `kebab-case.svelte.test.ts` convention:

```
classroom/
  class-roster-table.svelte          — <table> with caption, scope attrs; card layout < 640px
  class-roster-table.svelte.test.ts
  assignment-card.svelte             — due date, status, actions
  assignment-card.svelte.test.ts
  cohort-progress-chart.svelte       — chart (onMount only) + sr-only data table twin
  cohort-progress-chart.svelte.test.ts
  assignment-create-form.svelte      — form action; slide-over on mobile
  assignment-create-form.svelte.test.ts
  data-sharing-notice.svelte         — role='alertdialog'; lists shared fields explicitly
  data-sharing-notice.svelte.test.ts
  invite-join-form.svelte            — token entry + accept action
  invite-join-form.svelte.test.ts
community/
  community-pack-card.svelte         — pack summary; moderation-status badge
  community-pack-card.svelte.test.ts
  leaderboard-table.svelte           — <ol>-based; no raw attempt history exposed
  leaderboard-table.svelte.test.ts
  pack-abuse-report-form.svelte      — accessible error states
  pack-abuse-report-form.svelte.test.ts
research/
  research-consent-panel.svelte      — consent version display; grant/withdraw actions
  research-consent-panel.svelte.test.ts
```

### Types (`src/lib/types/`)

```ts
// classroom.ts
export interface Classroom {
	id: string;
	teacherId: string;
	name: string;
	inviteCode: string;
	createdAt: number;
	archivedAt: number | null;
}

export interface Roster {
	classId: string;
	studentId: string;
	joinedAt: number;
	removedAt: number | null;
	dataVisibility: 'full' | 'summary' | 'none';
}

export interface CloudAssignment {
	id: string;
	classId: string;
	drillConfig: DrillConfig; // from learning/drills (Milestone 00)
	targetRepetitions: number;
	retentionTarget: number; // 0–1
	dueAt: number;
	createdAt: number;
	schemaVersion: number;
}

export interface AssignmentGrade {
	assignmentId: string;
	studentId: string;
	attempts: number;
	accuracy: number; // 0–1
	meanResponseMs: number;
	fsrsState: FSRSCardState; // from ts-fsrs (Milestone 02)
	weakConcepts: string[];
	completedAt: number; // server clock, not client payload
}

export interface CohortReport {
	classId: string;
	assignmentId: string;
	studentCount: number;
	meanAccuracy: number;
	lowestAccuracyPitchClass: string | null;
	confusionMatrix: Record<string, Record<string, number>>;
	generatedAt: number;
}

// community.ts
export type ContentVisibility = 'private' | 'unlisted' | 'public';
export type ModerationStatus = 'pending' | 'approved' | 'flagged' | 'removed';

export interface CommunityPack {
	id: string;
	authorId: string;
	title: string;
	description: string;
	visibility: ContentVisibility;
	moderationStatus: ModerationStatus;
	abuseReportCount: number;
	version: number;
	schemaVersion: number;
	createdAt: number;
	updatedAt: number;
}

export interface ModerationRecord {
	packId: string;
	moderatorId: string | null; // null = system-triggered
	action: 'flagged' | 'approved' | 'removed';
	reason: string;
	recordedAt: number;
}

export interface AbuseReport {
	packId: string;
	reporterId: string;
	reason: string;
	reportedAt: number;
}

export interface LeaderboardEntry {
	rank: number;
	displayName: string; // user-chosen alias, never real name
	pitchClassesAt90: number; // mastery count; no raw attempt history
	weeklyStreakDays: number;
}

// research.ts
export interface ConsentRecord {
	userId: string;
	studyId: string;
	consentVersion: string; // semver; major bump requires re-consent
	consentedAt: number;
	withdrawnAt: number | null;
}

export interface StudySubmission {
	studyId: string;
	userId: string; // server maps to anonymized token before storage
	payload: AnonymizedStudyPayload;
	submittedAt: number;
}
```

### Svelte 5 runes state

Per-user classroom, roster, and community data must never be held at module scope — a module-level `$state` is shared across concurrent SSR requests and would leak Teacher A's roster into Teacher B's session. The correct pattern: server `load` returns filtered data; `+page.svelte` receives it via `PageProps`; reactive UI state is wrapped in a per-render factory distributed via `createContext`.

```ts
// src/lib/state/classroom.svelte.ts
import { createContext } from 'svelte';

export type ClassroomState = ReturnType<typeof createClassroomState>;
const [getClassroomState, setClassroomState] = createContext<ClassroomState>();
export { getClassroomState, setClassroomState };

export function createClassroomState(initial: {
	roster: Roster[];
	assignments: CloudAssignment[];
	cohortReport: CohortReport | null;
}) {
	let roster = $state(initial.roster);
	let assignments = $state(initial.assignments);
	let cohortReport = $state(initial.cohortReport);
	const dueAssignments = $derived(assignments.filter((a) => a.dueAt <= Date.now()));
	return {
		get roster() {
			return roster;
		},
		get assignments() {
			return assignments;
		},
		get cohortReport() {
			return cohortReport;
		},
		get dueAssignments() {
			return dueAssignments;
		}
	};
}
```

Community state follows the same factory+context pattern in `src/lib/state/community.svelte.ts`; research consent state in `src/lib/state/research.svelte.ts`. These files are lazy-loaded by their route `+layout.svelte`; they are never imported from `src/routes/+layout.svelte` so accountless practice loops are untouched.

### `App.Locals` extension

Extends — never replaces — the `user` field introduced by Milestone 22:

```ts
// src/app.d.ts (extend existing declaration)
declare global {
	namespace App {
		interface Locals {
			user: null | {
				id: string;
				email: string;
				role: 'teacher' | 'student' | 'learner';
				communityOptIn: boolean;
				researchConsentVersion: string | null;
			};
		}
	}
}
```

### Constants

```
src/lib/constants/research-consent-versions.ts  — CURRENT_CONSENT_VERSION = '1.0.0'
```

`consentVersion` is semver. A minor version bump shows an updated notice but does not require re-consent. A major version bump invalidates existing consent; the research submit endpoint returns 403 until the user re-accepts.

### Bundle discipline

- `google-auth-library` and any LMS OAuth library: server-only import; must never appear in a `+page.svelte` or any client-importable file.
- Community pack listings: cursor-based pagination, `limit` capped at 50 server-side.
- Classroom and community runes stores are lazy-loaded by route `+layout.svelte`; never imported from `src/routes/+layout.svelte`.
- After this milestone: `bun run build` and confirm client bundle growth is under 10 kb gzipped versus the Milestone 23 baseline.

### Form actions

| Action                   | Route                                                          | `fail()` cases                                    |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------- |
| `?/createAssignment`     | `teacher/[classId]/assignments/new/+page.server.ts`            | `400` title/config missing; `403` not class owner |
| `?/gradeSubmission`      | `teacher/[classId]/assignments/[assignmentId]/+page.server.ts` | `400` invalid value; `403` not class owner        |
| `?/submitAssignment`     | `student/assignments/[assignmentId]/+page.server.ts`           | `400` answer missing; `409` already submitted     |
| `?/acceptInvite`         | `api/invites/[token]/+server.ts`                               | `400` token invalid; `410` token expired          |
| `?/reportAbuse`          | `community/packs/[packId]/+page.server.ts`                     | `400` reason missing; `429` rate limit            |
| `?/toggleCommunityOptIn` | `community/+page.server.ts`                                    | —                                                 |
| `?/grantConsent`         | `research/+page.server.ts`                                     | `400` consent version mismatch                    |
| `?/withdrawConsent`      | `research/+page.server.ts`                                     | `404` no active consent                           |

All forms use `use:enhance`. Validation errors set `aria-invalid` and `aria-describedby` on affected inputs.

## Dependencies

- **Milestone 23** (Cloud Sync, Paid Entitlements, and User Accounts) — direct prerequisite. Provides: authenticated account infrastructure, session handling, `locals.user`, cloud data boundary, entitlement gates, and sync patterns. Transitively provides Milestone 22 (Auth Foundation: route guards, session fixtures) and Milestone 20 (Database Foundation: schema versioning, server boundary, repository layer).
- `DrillConfig` / `DrillSchema` types from Milestone 00 (shared drill schema) — community packs reuse these; no new types needed.
- `FSRSCardState` from `ts-fsrs` (installed in Milestone 02) — used in `AssignmentGrade.fsrsState`.
- `learning/scheduling` FSRS primitives from Milestone 02 — used in `mergeCloudFsrsState()`.
- Accountless export schema from Milestone 11 — the Phase 1 export CSV shape matches it for tool compatibility.

## External Dependency Contracts

| Capability                   | Owner                                                                    | Contract                                                                                                                                                                                                                                                    | Stub/mock plan                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| LMS OAuth — Google Classroom | Vibratone (file issue: "Google Classroom OAuth integration spec")        | `connectGoogleClassroom(code: string): Promise<LMSConnection>` in `src/routes/api/integrations/google-classroom/callback/+server.ts`; scopes `classroom.rosters.readonly`, `classroom.coursework.students`; token stored server-side, never in client state | `VIBRATONE_LMS_STUB=true` returns fixture from `src/lib/server/lms-stub.ts`; Phase 2 only; not a gate requirement |
| LMS OAuth — Canvas LTI 1.3   | Vibratone (file issue: "Canvas LTI 1.3 integration spec")                | `connectCanvas(launchParams: LTILaunchParams): Promise<LMSConnection>`                                                                                                                                                                                      | Same stub flag; Phase 2 only                                                                                      |
| Cinder `DataTable` component | `@lostgradient/cinder` issue #323                                        | `<DataTable rows={Row[]} columns={Column[]} caption="string" />` with keyboard navigation                                                                                                                                                                   | Render a plain `<table>` with identical props contract until #323 ships                                           |
| Cinder `Modal`/`Dialog`      | `@lostgradient/cinder` issue #318                                        | `open: boolean; onclose: () => void`                                                                                                                                                                                                                        | Native `<dialog>` is the non-stub path and is always acceptable; Cinder wraps it when #318 ships                  |
| Cinder `StatusDot`           | `@lostgradient/cinder` (existing, no `variant` prop per codebase memory) | Used for moderation-status badge in `community-pack-card.svelte`                                                                                                                                                                                            | Use a plain `<span>` with a CSS class until confirmed safe                                                        |
| Invite token generation      | Vibratone (`src/lib/server/invites.ts` — implement in this milestone)    | `generateInviteToken(classId: string): string`; `validateInviteToken(token: string): { classId: string; expiresAt: number } \| null`                                                                                                                        | No external dep; implement directly with `crypto.randomUUID()` and a signed expiry                                |
| Database driver              | Already introduced in Milestone 20                                       | Narrow repository interfaces; no raw SQL in route files; test doubles in `src/lib/server/__mocks__/` via Vitest mock                                                                                                                                        | —                                                                                                                 |
| `ts-fsrs`                    | Already installed (Milestone 02)                                         | `FSRSCardState` type; `mergeCloudFsrsState()` in `assignment-queue.ts`                                                                                                                                                                                      | —                                                                                                                 |

No new Octavian subpath exports are required by this milestone. Community drill packs reuse `DrillConfig` and `DrillSchema` from Milestone 00.

## Acceptance Criteria

1. A teacher with a valid session can create a class, generate an invite token, and retrieve the class roster. A teacher with a different account cannot read that roster. _Pass: unit test in `classroom-repository.spec.ts` asserts 403 on cross-teacher roster read._

2. A student who joins via invite token can see their assigned drill packs and cannot see another student's assignment results. _Pass: unit test asserts the student's assignment list contains only their own records._

3. After a student completes an assignment, the teacher's cohort dashboard displays that student's accuracy, mean response time, FSRS state, and weak concept flags — and no raw attempt history. _Pass: Playwright test asserts these fields are visible in the teacher view; a unit test asserts raw attempt log is not included in the cohort payload._

4. A `CommunityPack` record cannot be set to `visibility: 'public'` while `moderationStatus` is `'pending'` or `'flagged'`. _Pass: unit test asserts the visibility update throws a validation error in those states._

5. An abuse report submitted against a public `CommunityPack` sets `moderationStatus` to `'flagged'` and the pack is no longer returned in the public content listing. _Pass: unit test asserts the state transition; integration test asserts the pack is absent from the public listing after the report._

6. A leaderboard ranking is determined by `pitchClassesAt90` (mastery count), not raw attempt volume. A user with 1,000 low-accuracy attempts does not outrank a user with 200 high-accuracy attempts. _Pass: unit test with seeded data asserts correct ranking order._

7. The export API at `src/routes/api/classroom/[classId]/export/+server.ts` returns HTTP 401 for unauthenticated requests, HTTP 403 when the requesting account is not the teacher who owns the class, and HTTP 200 with well-formed JSON or CSV for authorized requests. _Pass: integration tests assert all three responses._

8. A learner with no account can complete the full AP placement-to-practice flow (placement test, level selection, drill session, FSRS update) without encountering any classroom or community UI element. _Pass: Playwright test in anonymous/signed-out state asserts the AP flow renders and completes without redirects to auth or classroom routes._

9. The leaderboard and community content browser pages produce zero WCAG 2.1 AA violations when scanned with axe-core via Playwright. _Pass: automated accessibility tests assert zero violations._

10. An invite token that has been consumed or expired is rejected: consumed tokens return 403; expired tokens return 410. _Pass: unit tests in `invites.spec.ts` assert both responses._

11. Disabling community opt-in hides the community tab and returns 404 for community API routes for that session; no practice progress is cleared. _Pass: Playwright test asserts the AP practice flow completes correctly with community opt-in disabled._

12. The cohort report API payload contains no `email`, `fullName`, `stability`, `difficulty`, `reps`, or `attemptTimestamp` keys. _Pass: unit test constructs a mock roster with full user records, projects through the cohort report serializer, and asserts the absence of all forbidden fields._

## Test Plan

### Unit tests (vitest)

**`src/lib/server/classroom-repository.spec.ts`**

- `teacher can read their own class roster and assignment results`
- `cross-tenant isolation: teacher-B token rejected when loading teacher-A class (returns 403)`
- `student token rejected when requesting cohort summary (returns 403)`
- `unauthenticated request to classroom API returns 401`
- `class roster is only accessible to the owning teacher, not to enrolled students`
- `removing a student from roster does not delete their learner-owned progress`

**`src/lib/server/assignment-grading.spec.ts`**

- `grading emits AssignmentGrade with all required fields populated`
- `grading rejects negative attempt counts`
- `completedAt is set from server clock, not client payload`
- `schemaVersion mismatch on CloudAssignment throws validation error`
- `AssignmentGrade is only readable by the owning teacher and the submitting student`
- `teacher view of completed assignment contains accuracy, meanResponseMs, fsrsState, and weakConcepts — not per-attempt timestamps`

**`src/lib/server/cohort-report.spec.ts`**

- `cohort report payload excludes student email, full name, and raw FSRS card state (stability, difficulty, reps)`
- `cohort report payload contains only alias, aggregate accuracy, drill completion count, and last-active date`
- `buildCohortReport aggregates grades into confusionMatrix correctly`
- `lowestAccuracyPitchClass is null when no grades exist`
- `meanAccuracy is 0 when all grades have accuracy 0`

**`src/lib/server/community-repository.spec.ts`**

- `ContentPack cannot be set public while moderationStatus is pending`
- `ContentPack cannot be set public while moderationStatus is flagged`
- `abuse report transitions moderationStatus from approved to flagged`
- `flagged pack is excluded from public content listing`
- `removed pack is excluded from all non-owner listings`
- `pack with abuseReportCount >= 5 transitions to moderationStatus pending`
- `author can delete own pack regardless of moderation status`
- `non-author cannot delete pack`
- `visibility change to unlisted is allowed from any moderation status`

**`src/lib/server/leaderboard.spec.ts`**

- `leaderboard ranks by pitchClassesAt90, not raw attempt volume`
- `a user with 1000 low-accuracy attempts does not outrank a user with 200 high-accuracy attempts`
- `leaderboard ranking policy version is recorded on each snapshot`
- `leaderboard payload has no attempts, events, responseTimes, or per-attempt fields`
- `student who opts out does not appear in leaderboard response`

**`src/lib/server/research-repository.spec.ts`**

- `withdrawn consent blocks new data collection`
- `withdrawal sets withdrawnAt without deleting prior records`
- `active consent allows event writes`
- `consent version mismatch blocks study participation`
- `minor version bump does not require re-consent`
- `major version bump invalidates existing consent; submit endpoint returns 403 until re-consent`

**`src/lib/server/invites.spec.ts`**

- `generateInviteToken returns a non-empty string`
- `validateInviteToken returns classId and expiresAt for a valid token`
- `validateInviteToken returns null for an invalid token`
- `validateInviteToken returns null for an expired token`
- `consumed invite token is rejected (returns 403)`
- `expired invite token returns 410`

**`src/lib/server/auth-helpers.spec.ts`**

- `requireUser throws 401 when locals.user is null`
- `requireRole throws 403 when user.role is 'student' and role is 'teacher'`
- `requireRole returns user when role matches`

**`src/lib/learning/protocols/classroom.spec.ts`**

- `classifyAssignmentGrade returns correct accuracy from attempt events`
- `mergeCloudFsrsState resolves conflicts in favor of higher-stability state`

**`src/lib/learning/analytics/cohort.spec.ts`**

- `buildCohortReport aggregates grades into confusionMatrix correctly`
- `confusionMatrixPerRoster returns empty matrix when roster is empty`

**`src/lib/learning/drills/community.spec.ts`**

- `validatePackSchema returns true for a valid CommunityDrillPack`
- `validatePackSchema returns false for a pack missing required fields`

**Component tests (`*.svelte.test.ts` via vitest-browser-svelte)**

**`src/lib/components/classroom/class-roster-table.svelte.test.ts`**

- `renders a caption with the class name`
- `all column headers have scope="col"`
- `row headers have scope="row"`
- `fires onRemoveStudent callback when remove button is activated`

**`src/lib/components/classroom/assignment-card.svelte.test.ts`**

- `displays due date in readable format`
- `shows overdue label when due date is past`

**`src/lib/components/classroom/data-sharing-notice.svelte.test.ts`**

- `renders with role="alertdialog"`
- `lists accuracy, meanResponseMs, fsrsState, and weakConcepts explicitly`
- `submit button is disabled until notice is dismissed`

**`src/lib/components/classroom/invite-join-form.svelte.test.ts`**

- `submits token value in form data`
- `shows aria-invalid on token input when form has an error`

**`src/lib/components/community/leaderboard-table.svelte.test.ts`**

- `renders as an ol element`
- `does not render any attempt history column`
- `each row is keyboard-focusable`

**`src/lib/components/research/research-consent-panel.svelte.test.ts`**

- `displays consent version string`
- `withdraw button is disabled when no active consent`

### Integration tests (vitest)

**`src/lib/server/export-api.integration.spec.ts`**

- `unauthenticated request to export endpoint returns 401`
- `authenticated request from non-owner teacher returns 403`
- `authorized request returns well-formed JSON with AssignmentGrade[]`
- `authorized request with ?format=csv returns valid CSV matching accountless-export schema from Milestone 11`

**`src/lib/server/invite-join.integration.spec.ts`**

- `invitation link encodes classId and one-time token`
- `joining via invite enrolls the student and marks token as consumed`
- `expired invitation token returns 410`
- `reusing a consumed invitation token returns 403`

**`src/lib/server/assignment-completion.integration.spec.ts`**

- `student completing a cloud assignment persists AssignmentGrade to DB`
- `AssignmentGrade is readable by the owning teacher and the submitting student`
- `AssignmentGrade is not readable by a different teacher or a different student`

**`src/lib/server/lms-stub.integration.spec.ts`**

- `with VIBRATONE_LMS_STUB=true, callback returns fixture LMS class list`

### Playwright specs (`e2e/`)

**`e2e/classroom-teacher.spec.ts`**

- `teacher can create a class, generate an invite code, and see an empty roster`
- `teacher can create an assignment with due date, target repetitions, and linked drill pack`
- `teacher can view cohort progress dashboard showing aggregate accuracy per student alias`
- `cohort report chart has an accessible sr-only table twin at all viewport sizes`
- `teacher dashboard is navigable by keyboard alone at 1280px`
- `teacher dashboard is usable at 768px`
- `roster table collapses to card layout at 375px`
- `teacher cannot navigate to another teacher's class URL (redirected with 403 message)`

**`e2e/student-assignment.spec.ts`**

- `student joins class by invite code after creating an account`
- `data-sharing notice lists accuracy, response time, FSRS state, and weak concepts before joining`
- `student can complete an assignment and see confirmation of what was submitted`
- `student cannot view another student's grades`
- `student sees data-sharing notice before submitting assignment`

**`e2e/community-opt-in.spec.ts`**

- `community tab is absent from navigation before opt-in`
- `enabling opt-in reveals the community tab; local AP practice state is unchanged`
- `disabling opt-in hides community tab; no practice progress is cleared`
- `with community features disabled, AP practice round completes and score persists`
- `no network request to community endpoints fires during a local-only AP practice session`

**`e2e/community-accessibility.spec.ts`**

- `leaderboard page produces zero axe-core WCAG 2.1 AA violations`
- `community content browser produces zero axe-core WCAG 2.1 AA violations`
- `leaderboard ol element announces row count; each item is keyboard-focusable`
- `abuse report button has accessible label and confirmation dialog announces result`
- `leaderboard renders as card list at 375px viewport`

**`e2e/anonymous-user.spec.ts`**

- `anonymous user can complete AP placement and start a drill session without encountering classroom or community UI`
- `anonymous user is not redirected to login during AP practice`

**`e2e/permission-denial.spec.ts`**

- `unauthenticated GET /api/classroom/[classId] returns 401`
- `student session cannot access teacher cohort dashboard endpoint (403)`
- `teacher session cannot access another teacher's roster (403)`
- `unauthenticated user visiting classroom routes is redirected to /login with returnTo preserved`

**`e2e/lms-connect.spec.ts`** (runs only when `VIBRATONE_LMS_TEST_ACCOUNT` is set)

- `permission disclosure appears before OAuth redirect`
- `OAuth state mismatch returns error page, not silent failure`
- `LMS connect dialog is readable and tappable at 375px`

## Verification

Run the full gate:

```
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

Manual smokes after gate passes:

1. Create a teacher account, create a class, generate an invite code, join as a student, complete an assignment, and export the cohort report from the teacher view — confirm all fields match the data-sharing notice.
2. Toggle community opt-in off; confirm the community tab disappears and a local AP drill session completes without error.
3. Attempt to access `/teacher/[classId]/reports` from a different teacher account; confirm 403.
4. Submit an abuse report against a public pack; confirm the pack disappears from the public listing.
5. Open the leaderboard at 375px viewport; confirm the `<ol>` card layout renders and is keyboard-navigable.
6. Run `bun run build` and confirm client bundle growth is under 10 kb gzipped versus Milestone 23 baseline.

## Non-Goals

- Accounts are not required for core AP practice; the free local AP flow is unchanged.
- Live LMS OAuth connections (Google Classroom, Canvas) are out of scope; the Phase 1 export-only API ships here.
- Public profiles by default.
- Leaderboards without learning-quality guardrails (mastery-weighted ranking is required; raw attempt volume is not a valid ranking metric).
- Research enrollment UI and aggregate reporting (the `ConsentRecord` schema is defined; the full research participation surface is a follow-on).
- Community content without a moderation data model in place.

## Completion Signal

This milestone is complete when:

1. A Playwright test can create a teacher account, create a class, invite a student (who has an account), assign a drill pack, complete the assignment as the student, and export the cohort report as the teacher — all assertions passing.
2. `bun run test:unit -- --run` passes all named tests listed in the Test Plan above.
3. A Playwright test confirms that a learner with no account can complete the full AP placement-to-practice flow without encountering classroom or community UI.
4. Zero WCAG 2.1 AA violations on the leaderboard and community content browser pages (axe-core via Playwright).
5. `bun run check` and `bun run lint` pass with no suppressed errors.
6. `bun run build` succeeds and client bundle growth is under 10 kb gzipped versus Milestone 23.
