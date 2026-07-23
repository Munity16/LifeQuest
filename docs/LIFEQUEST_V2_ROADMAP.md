# LifeQuest V2 roadmap

Work proceeds in release order. A later release does not begin while an earlier one has critical correctness failures.

| Release | Scope | Current state |
| --- | --- | --- |
| 1 — Trust and correctness | Verification/generation idempotency, exact seven quests, aggregates, Node 22, proof sanitization/privacy, AI limits, live readiness | Implemented locally; final live verification requires staging credentials |
| 2 — Daily usability | Today dashboard, multiple completion methods, lifecycle controls, improved onboarding, three acts, scheduling | Not started |
| 3 — Retention | Daily Training, streaks, Chronicle, reflections, weekly recaps | Not started |
| 4 — Progression | Skill domains, domain XP, coins, personal rewards, energy adaptation, enemies, achievements | Not started |
| 5 — Design | Storybook Fantasy token system, screen refinement, artwork plan, motion, mobile polish | Existing UI retained; formal V2 redesign not started |
| 6 — AI personalization | Grounded campaign companion and trigger-based adaptive quests | Not started |

## Release 1 exit condition

Local lint, strict type checking, unit/API/security tests, production build, and deterministic Playwright paths must pass. Live completion additionally requires:

- an isolated staging deployment;
- two confirmed test users;
- applied migrations;
- private Storage and RLS checks;
- accepted, rejected, unsafe, duplicate, deletion, and retention proof checks;
- OpenAI and Supabase credentials.

## Highest-value next release

After live Release 1 sign-off, begin Release 2 with the `/today` information architecture and the completion-method data model. Do not add presentation-only screens before the underlying lifecycle and authorization model is agreed.
