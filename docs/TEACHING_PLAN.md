# Structured Teaching Plan

CW Trainer already trains with the Koch method, but the level ladder alone gives
no sense of *syllabus*: what am I working toward, what counts as "done", and how
do I know I can actually copy code? The teaching plan answers those three
questions with **stages**, **goals**, and **copy tests**.

## Concepts

### Stages

The character sequence (LCWO order by default, custom sequences supported) is
chunked into stages of 5 Koch levels. Each stage lists the characters it
introduces and has an explicit exit level. Stages are defined in
`src/lib/curriculum/teachingPlan.ts` (`buildTeachingPlan`).

### Goals

A stage is complete when all of its goals are achieved
(`src/lib/curriculum/progress.ts`, `evaluateTeachingPlan`):

| Goal | Requirement |
|---|---|
| Reach level | Train at (or above) the stage's exit level |
| Quality sessions | 2 sessions at ≥90% accuracy at/above the exit level |
| Copy test | One session of 100+ characters at ≥90% accuracy at/above the exit level |

Progress is evaluated from **saved session history** — your regular training
sessions *are* the tests. There is no separate exam mode to schedule: a long,
accurate session at the right level automatically counts as a passed copy test.
Sessions at higher levels retroactively complete lower stages; the plan
recognises demonstrated skill and never demands re-grinding earlier material.

Only group-mode sessions with a recorded Koch level count (echo, chase, ICR and
digits-only sessions train different skills and are excluded).

### Copy tests

The copy test is the digital analogue of the classic "solid copy" exam:
sustained accurate reception, not a lucky short run. 100 characters at ≥90%
demands roughly 4–5 minutes of continuous copying, which is where real
reading-by-rhythm skill shows.

### Speed certificates

Certificates form a **matrix of (stage × speed)** with the historic FCC exam
speeds — **5, 13 and 20 WPM** (Novice / General / Amateur Extra). The historic
tests presumed the complete alphabet, so the final row (full character set) is
the true equivalent; it also unlocks trophy-case achievements
(`solid-copy-5wpm` / `-13wpm` / `-20wpm`). Earlier rows give learners a
certificate target at every stage of the ladder.

A cell is earned by a **single session** — one sustained run, like the real
exam, never an accumulation across sessions:

- 100+ characters copied **correctly** from groups that were actually *played*
  at or above the certificate speed,
- ≥90% accuracy among those at-speed characters,
- in a session at or above the stage's exit level.

Because speed settings can be ranges, each group records the speed it was
actually played at (`groupTimings[].charWpm`) — with variable speed, only the
groups that met the certificate speed count toward the run. Legacy sessions
without per-group speeds fall back to the session-level snapshot (the range
minimum, conservative); history with no speed data never earns certificates —
the plan does not guess.

The panel shows best-attempt progress per cell (e.g. `87/100`), and the
results screen calls out near-misses ("13 short — one more run?") so a failed
attempt turns into the next session's goal.

## UI

`TeachingPlanPanel` (mounted on the group-training home screen) shows:

- overall plan progress (stages completed, progress bar),
- the active stage with its goal checklist and best copy-test accuracy,
- the certificate row with earned/unearned state.

## Future extensions

- **Dedicated exam mode**: a locked-settings session (fixed length, no retries,
  prescribed speed) started from the panel, marked `isTest` in the session
  record. The evaluation logic in `progress.ts` already works on plain
  sessions, so an exam mode only needs to *create* qualifying sessions.
- **Per-stage speed targets**: raise effective WPM requirements per stage
  (e.g. 20/5 Farnsworth early, 20/13 later) now that speed is recorded.
- **Certificate share cards**: generate a shareable badge image when a
  certificate is earned.
- **Plan-aware suggestions**: when a goal is nearly met ("one more 90%
  session"), surface it on the home screen as the day's objective.
