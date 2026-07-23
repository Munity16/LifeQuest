# Live readiness checklist

Run only against an isolated staging project. Never point credential-gated tests at production.

## Prerequisites

- [ ] All five migrations applied in order
- [ ] Node 22 selected in CI and hosting
- [ ] Two confirmed staging users with no production data
- [ ] Private `quest-proofs` bucket and RLS policies enabled
- [ ] OpenAI and Supabase server secrets configured only on the server
- [ ] Auth callback and staging origin allowlisted
- [ ] `DEMO_MODE_ENABLED=false`
- [ ] `RATE_LIMIT_SALT` and `CRON_SECRET` are long random values

## Automated staging checks

Set the GitHub `staging` environment variable `LIVE_E2E_BASE_URL` and secrets:

- `LIVE_E2E_USER_EMAIL`
- `LIVE_E2E_USER_PASSWORD`
- `LIVE_E2E_OTHER_USER_EMAIL`
- `LIVE_E2E_OTHER_USER_PASSWORD`

Trigger the `Live readiness` workflow manually. It checks authentication, real campaign generation, refresh persistence, preference persistence, and cross-user campaign denial.

## Manual proof matrix

- [ ] Valid supported image is normalized to JPEG and stored on the expected private path
- [ ] User B cannot list/download User A proof or read its submission
- [ ] Accepted proof awards exactly one XP/damage event
- [ ] Immediate and concurrent duplicate verification do not call the model or award again
- [ ] Rejected proof stores a reusable terminal receipt and awards nothing
- [ ] Unsafe proof stops after moderation and awards nothing
- [ ] Network/AI timeout leaves a safe retry path
- [ ] Database failure after AI acceptance retries from the saved assessment
- [ ] Deleted proof returns 410 for a nonterminal submission
- [ ] Deleting a terminal proof preserves receipt and progression
- [ ] Retention job removes only expired objects and records deletion time

## Sign-off evidence

Record the staging commit, migration versions, workflow URL, model names, test-user IDs (not emails), timestamps, and pass/fail notes. Do not save proof images or secrets in Git.
