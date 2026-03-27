# Contributing Guide

## Prerequisites

- Node.js 20+
- npm

## Local Setup

```bash
npm install
npm run dev
```

Open the local URL from the dev server output.

## Quality Gates

Run before opening a PR:

```bash
npm run lint
npm run typecheck
npm test -- --watch=false
npm audit --omit=dev
```

## Contribution Rules

- Keep architecture direction: `Components -> Hooks -> Store -> Services -> Repositories -> lib`.
- Add/adjust tests with behavior changes.
- Keep hooks and components focused and reasonably small.
- Prefer pure functions in `lib/` for non-UI logic.
- Handle optional Firebase (offline mode must still work).

## Pull Request Checklist

- Clear problem statement and solution rationale.
- Linked issue (if available).
- Screenshots/GIF for UI changes.
- Updated docs for any new behavior, setting, or architecture impact.
