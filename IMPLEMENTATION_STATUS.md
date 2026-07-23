# LifeQuest implementation status

Last updated: 2026-07-23

## Current repository state

- Branch: `codex/lifequest-v2`
- Base integration: latest `origin/main` at `1b4cfcc`, merged before pull-request handoff
- Runtime contract: Node 22 in `package.json`, `.nvmrc`, `.node-version`, CI, live-readiness CI, and README
- Application: Next.js 16.2.11 App Router, React 19, strict TypeScript
- Release focus: V2 Release 1 — Trust and correctness
- Demo: deterministic and available only when `DEMO_MODE_ENABLED=true`
- Live integrations: not verified; this workspace has no target Supabase/OpenAI/Vercel credentials

## Release 1 implementation

| Feature | Status | Evidence |
| --- | --- | --- |
| Verification idempotency | `IMPLEMENTED` | Postgres processing lease, terminal receipts, immutable accepted/rejected states, resumable saved assessment, atomic progression RPC |
| Exactly seven core quests | `IMPLEMENTED` | Zod, prompt/service, and V2 database mutation checks; Day 7 boss; legacy data retained under contract version 1 |
| Correct aggregates/pagination | `IMPLEMENTED` | RLS-aware aggregate RPC plus independent six-item campaign pages |
| Node and CI alignment | `IMPLEMENTED` | Node 22 contract and both workflows updated |
| Proof sanitization | `IMPLEMENTED` | Sharp decode/orient/resize/metadata-free JPEG/output cap before private storage |
| Privacy disclosure | `IMPLEMENTED` | Proof UI notice, deletion controls, `/privacy`, and proof-flow documentation |
| Generation idempotency | `IMPLEMENTED` | Generation request claimed before OpenAI with succeeded/processing/failed retry states |
| AI usage controls | `IMPLEMENTED` | Private usage ledger, monthly aggregate RPC, configurable per-operation limits |
| Live-readiness preparation | `IMPLEMENTED` | Manual staging checklist and credential-gated campaign/preference/two-user Playwright checks |

## Database changes

Migration `202607230005_v2_trust_correctness.sql` adds:

- verification state, processing lease, trace, safety/schema state, failure code, and reusable receipt fields;
- `claim_quest_verification`, `save_quest_verification_assessment`, and `finalize_quest_verification`;
- replacement service-only `complete_quest` accepting a processing token and public result;
- `is_boss_quest` and `generation_contract_version` on quests;
- V2-only unique core-day/core-title indexes and shape constraints;
- `campaign_generation_requests` with server-only claim/failure functions;
- exact-seven validation in `create_campaign_with_quests`;
- expanded campaign lifecycle status constraint;
- `get_my_profile_aggregates`;
- private `ai_usage_events` plus a service-only monthly total function.

The migration retains legacy terminal decisions by creating bounded legacy receipts. Existing quests remain contract version 1; only new V2 campaigns are subject to the stronger indexes, avoiding a destructive rewrite.

## Verification results

Executed on the local Windows host (Node 24.13.0; the supported/CI runtime is Node 22):

- `npm.cmd ci`: passed; 476 packages installed; 0 vulnerabilities; expected engine warning because the host is Node 24
- `npm.cmd audit --audit-level=moderate`: passed; 0 vulnerabilities
- `npm.cmd run lint`: passed
- `npm.cmd run typecheck`: passed
- `npm.cmd run test -- --reporter=dot`: passed, 17 files / 90 tests
- `npm.cmd run build`: passed on Next.js 16.2.11; all expected routes including `/privacy` generated
- `npm.cmd run test:e2e`: passed, 2 deterministic Chromium tests; 3 staging-only tests correctly skipped

The default E2E script owns an isolated `localhost:3100` Next.js process and terminates that exact process tree, avoiding reuse of an unrelated localhost server.

## Baseline findings repaired

- Proof retries previously called moderation/verification again and direct updates could race terminal state.
- Campaign generation claimed idempotency only after a paid AI call.
- Generated schema and demo data did not enforce one core quest for each day 1–7.
- Profile lifetime campaign stats were derived from `.limit(6)`.
- Uploaded proof bytes were signature-checked but never decoded, normalized, or stripped of metadata.
- Node requirements differed between package metadata, CI, and documentation.
- Initial audit reported three dependency vulnerabilities; the locked tree now reports zero.

## Blocked live validation

The following cannot be claimed without an isolated staging project and credentials:

- applying and executing migration 005 against real existing data;
- two-user Postgres RLS and private Storage isolation;
- live OpenAI generation, moderation, accepted/rejected proof, retry cost, and usage counters;
- proof retention cron behavior;
- Vercel Node 22 deployment and production callback configuration.

Use `docs/LIVE_READINESS_CHECKLIST.md`; do not run the credential-gated suite against production.

## Known risks

- SQL behavior is covered by security-contract tests but the new migration has not been executed against a real Postgres/Supabase instance in this workspace.
- The supported runtime is Node 22, while local verification used Node 24 because that is the installed host runtime; CI supplies the authoritative Node 22 check.
- Live model quality and moderation outcomes remain unmeasured without the private proof-evaluation set.
- Later V2 releases are deliberately not started. Today, completion methods, lifecycle controls, Daily Training, Chronicle, domains, coins, and the grounded companion remain roadmap work.

## Next action

Apply migrations to an isolated staging Supabase project, deploy the branch on Node 22, and complete the two-user live-readiness checklist before starting Release 2.
