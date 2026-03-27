# Project Structure

## Top-level

- `app/` - Next.js app entry (`page.tsx`, `layout.tsx`, providers).
- `src/components/` - UI and feature components.
- `src/hooks/` - orchestration hooks.
- `src/store/` - Zustand store and slices.
- `src/lib/` - pure logic, services, repositories, validators.
- `src/__tests__/` - tests mirroring source structure.
- `scripts/` - build/release utility scripts.
- `.github/workflows/` - CI and deployment workflows.

## Component Organization

- `src/components/features/` - domain features (`training`, `icr`, `stats`, `sidebar`).
- `src/components/ui/` - reusable presentational pieces (`forms`, `charts`, `layouts`, `navigation`).

## Domain Organization (`src/lib`)

- `audio/` style concerns via files like `morseAudio`, constants, signals.
- `training/` concerns via group generation and playback utilities.
- `scoring/` concerns via score/stat computation helpers.
- `db/repositories/` for persistence adapters.
- `services/` for validated business operations.
- `validators/` for Zod schemas.

## Typical Change Paths

- UI-only tweak: `components/*` (+ test).
- New behavior in existing flow: `hooks/*` + `store/slices/*` (+ tests).
- New domain rule: `lib/*` pure function + service call site (+ unit tests).
- New persisted setting: validator + service + repository + slice + form control.
