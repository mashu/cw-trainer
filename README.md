## CW Trainer

[![Tests](https://github.com/mashu/cw-trainer/actions/workflows/test.yml/badge.svg)](https://github.com/mashu/cw-trainer/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/mashu/cw-trainer/branch/main/graph/badge.svg)](https://codecov.io/gh/mashu/cw-trainer)
[![Deploy to GitHub Pages](https://github.com/mashu/cw-trainer/actions/workflows/gh-pages.yml/badge.svg)](https://github.com/mashu/cw-trainer/actions/workflows/gh-pages.yml)
[![Site](https://img.shields.io/website?url=https%3A%2F%2Fmashu.github.io%2Fcw-trainer%2F)](https://mashu.github.io/cw-trainer/)

Train Morse code with the Koch method, track accuracy over time, and review per‑character stats - all in your browser.

### Modernization in Progress

The project is undergoing a full refactor to a modular Next.js 16 architecture with strict TypeScript, layered services, and repository-driven data access.

### ICR Data Flow (work in progress)

- **Formatting:** Raw VAD trials are normalised via `src/lib/utils/icrSessionFormatter.ts` into an `IcrSessionResult` snapshot (reaction times, per-letter aggregates, settings).
- **Persistence:** `IcrSessionService` (local storage-backed for now) reads/writes up to the latest 1,000 summaries.
- **State:** `createIcrSessionsSlice` + `useIcrSessions` exposes the summaries through the global Zustand store so feature components stay dumb.
- **Analytics:** `useIcrAnalytics` derives global metrics (average reaction/accuracy, best & needs-work letters) from the shared store and feeds the stats dashboard.
- **UI:** `ICRTrainer` persists each completed run through the store action, and `ICRStats` surfaces the analytics. `GroupTrainingStats` displays group training statistics separately.

### Static Hosting Notes

This project ships as a fully static export (no server-side rendering or API routes) so it can be hosted on GitHub Pages:

- Use `npm run build && next export` to generate the static bundle under `out/` before publishing to Pages.
- Only client-side features are supported. Anything under `src/app/api` is intentionally omitted to keep the deployment static-friendly.
- All data (settings, sessions, ICR summaries) persists in the browser via local storage; there is no backend sync in the Pages deployment.
- For local testing, run `npm run dev`. Before pushing to Pages, `npm run lint` and `npm test` help catch regressions.


