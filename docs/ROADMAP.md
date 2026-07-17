# Roadmap: items that need a backend

Two hardening/engagement items cannot be completed client-side and are
deliberately deferred rather than half-done:

## Server-side score authority

Leaderboard scores are computed in the browser. Firestore rules now validate
shape and bounds (`firestore.rules`) and the volume term is capped
(`MAX_SCORED_CHARS` in `lib/score.ts`), which bounds — but cannot eliminate —
forged scores. The complete fix is a Cloud Function that recomputes the score
from the submitted groups/timings on write and rejects mismatches. The session
payload already contains everything needed; no client changes are required
beyond deleting the client-side leaderboard write.

## Push practice reminders

The streak card covers in-app urgency, but true "your streak ends in 3 hours"
notifications require Web Push (a push service + subscription storage), which
needs server infrastructure. The service worker is already in place
(`public/sw.js`); adding `pushManager` subscription handling and an FCM topic
per user is the missing half.

## Firestore configuration notes

- Deploy rules after every change: `npm run deploy:firestore`.
- The weekly leaderboard tab queries `collectionGroup('leaderboard')` filtered
  by `date`; if the console reports a missing index, enable collection-group
  scope for the `date` field (single-field index settings) or create the
  suggested index from the error link. The UI degrades gracefully until then.
