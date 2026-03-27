# Feature Development Guide

This guide helps contributors add functionality without breaking architecture boundaries.

## 1) Define the change

- What user behavior changes?
- What state is new or modified?
- Is this UI-only, domain logic, persistence, or all three?

## 2) Place code in the right layer

- UI rendering -> `src/components/*`
- Interaction orchestration -> `src/hooks/*`
- Shared app state/actions -> `src/store/slices/*`
- Business rules + validation -> `src/lib/services/*`, `src/lib/validators/*`
- I/O/persistence -> `src/lib/db/repositories/*`
- Pure computation -> `src/lib/*`

## 3) Build incrementally

1. Implement pure domain function (if needed).
2. Integrate in service/slice/hook.
3. Add or update UI component.
4. Add tests closest to the changed behavior.

## 4) Verify locally

```bash
npm run lint
npm run typecheck
npm test -- --watch=false
```

## 5) Document the feature

- Update `docs/` pages if architecture/flow changed.
- Add migration notes if settings or data shape changed.
