# LifeQuest

LifeQuest turns a real-life goal into a focused role-playing campaign. A user chooses a goal, available daily time, their main obstacle, and a difficulty. GPT-5.6 creates a hero, nemesis, story, and practical questline. The user completes a quest, submits private image proof, and receives XP and enemy damage only after server-side verification.

The hackathon MVP protects one golden path:

1. Sign in or enter the explicitly enabled seeded demo.
2. Submit a real-life goal and practical constraints.
3. Generate and atomically save a campaign and quests.
4. Open the campaign dashboard and a quest.
5. Upload private screenshot or image proof.
6. Verify the proof on the server.
7. Apply XP, level, and enemy-health progression exactly once.
8. Reload and see the same saved state.

## Current feature status

Implemented and covered by automated tests:

- Email/password signup, login, logout, auth callback, protected pages, and session refresh.
- Explicitly gated seeded demo mode with cookie-backed demo progress.
- Goal onboarding with Zod validation, loading/error states, and duplicate-submit protection.
- GPT-5.6 Responses API campaign generation with Zod Structured Outputs and bounded retry.
- Atomic, idempotent campaign-and-quest persistence through a service-role-only PostgreSQL RPC.
- User-owned campaign dashboard, quest log, XP/level progress, enemy health, and completion history.
- Private proof upload with size, MIME, and file-signature checks.
- Image moderation before GPT-5.6 visual proof verification, with high-detail input and structured requirement assessments.
- Explainable accepted/rejected verdicts with a privacy-safe mode, model, latency, safety, schema, and trace receipt.
- Server-mediated OpenAI Realtime quest narration with no browser-exposed API key; the seeded demo uses clearly labelled device speech instead.
- Judge-friendly demo controls for deterministic passing/rejected samples and one-click progress reset.
- A private-image JSONL evaluation harness reporting accuracy, false accepts, false rejects, safety outcomes, and latency.
- Service-role-only, row-locking progression RPC that completes a quest and awards XP/damage once.
- Optional adaptive quest generation after progression commits; failure cannot roll back the victory.
- Responsive dark-fantasy UI, keyboard focus states, semantic structure, and reduced-motion support.
- Unit, Route Handler, database-contract, and seeded golden-path tests with mocked external boundaries.

Live Supabase and OpenAI calls have not been executed in this credential-free workspace. Run the manual checks below against your own project before describing the integrations as live-verified.

## Technology stack

- Next.js 16 App Router and React 19
- Strict TypeScript
- Tailwind CSS 4 plus product-specific CSS
- Supabase Postgres, Authentication, Row Level Security, and private Storage
- OpenAI JavaScript SDK, Responses API, GPT-5.6, image input, and Zod Structured Outputs
- Zod, React Hook Form, Vitest, and Testing Library dependencies
- Vercel deployment target

## Local setup

Prerequisites:

- Node.js 20.19 or newer
- npm
- A Supabase project for the live path
- An OpenAI API key with access to the configured model for the live path

Install dependencies:

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in the required values. Never commit `.env.local`.

Apply the Supabase migrations in order, then start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On Windows systems that block PowerShell scripts, use `npm.cmd` in place of `npm`, for example `npm.cmd run dev`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | Canonical app origin used for auth callbacks, such as `http://localhost:3000` or the Vercel production URL. |
| `NEXT_PUBLIC_SUPABASE_URL` | Live path | Supabase project URL. Safe for browser use. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Live path | Supabase anonymous key. Safe for browser use when RLS is enforced. |
| `SUPABASE_SERVICE_ROLE_KEY` | Live path | Server-only key used for controlled campaign/submission writes and service-only RPCs. Never expose it to browser code. |
| `OPENAI_API_KEY` | Live path | Server-only OpenAI key. Never expose it to browser code. |
| `OPENAI_MODEL` | Live path | Defaults to `gpt-5.6`; the alias routes to GPT-5.6 Sol. |
| `OPENAI_MODERATION_MODEL` | Live path | Defaults to `omni-moderation-latest` for proof-image safety screening. |
| `OPENAI_REALTIME_MODEL` | Live voice | Defaults to `gpt-realtime-2.1` for quest narration. |
| `DEMO_MODE_ENABLED` | Demo only | Demo is available only when the value is exactly `true`. Set `false` or omit it to disable the seeded fallback. |
| `DEMO_USER_EMAIL` | Optional | Reserved for a separately managed demo account; the seeded cookie demo does not expose or require it. |
| `DEMO_USER_PASSWORD` | Optional | Reserved server-side for a separately managed demo account; the seeded cookie demo does not expose or require it. |

The app intentionally builds without live credentials so Vercel can compile before environment setup. A live endpoint returns a clear configuration error if its required server-side credential is missing.

## Supabase setup

The migrations are in `supabase/migrations`:

1. `202607170001_initial_schema.sql`
   - Creates `profiles`, `campaigns`, `quests`, `quest_submissions`, and `progress_events`.
   - Enables RLS and grants authenticated users read access only to their own records.
   - Adds the profile-creation trigger.
   - Creates the private `quest-proofs` bucket with a 5 MB limit and JPG/PNG/WebP allowlist.
   - Restricts proof-object access to the first path segment matching the authenticated user ID.
2. `202607170002_secure_server_mutations.sql`
   - Adds campaign generation idempotency.
   - Creates an atomic campaign-and-quest RPC callable only by `service_role`.
   - Replaces the progression RPC with a service-role-only, row-locking implementation.
   - Clamps enemy health, calculates level in PostgreSQL, and records progress events.

Apply migrations with the Supabase CLI if your project is linked:

```bash
supabase db push
```

Alternatively, run each migration in order in the Supabase SQL Editor. Do not skip the second migration: it removes the browser-callable progression permission present in the initial scaffold.

Manual Supabase checks:

- Confirm RLS is enabled on all five public tables.
- Confirm authenticated users have no direct insert/update permission for campaigns, quests, submissions, XP, health, or completion state.
- Confirm only `service_role` can execute `create_campaign_with_quests` and `complete_quest`.
- Confirm `quest-proofs` is private and has the expected MIME and 5 MB limits.
- Confirm proof object paths use `{userId}/{campaignId}/{questId}/{uniqueFilename}`.
- In Authentication → URL Configuration, set the Site URL and add both local and production callback URLs:
  - `http://localhost:3000/auth/callback`
  - `https://YOUR-VERCEL-DOMAIN/auth/callback`

## OpenAI integration

The live path uses the official JavaScript SDK and the Responses API:

- Campaign generation: text input → Zod-validated campaign and quest structure.
- Proof verification: proof-image moderation, then task requirements plus a private image data URL → Zod-validated verdict and per-requirement assessment.
- Adaptive quest: non-critical follow-up generation after progression commits.
- Quest narration: browser WebRTC offer → server-authorized Realtime session; no microphone or browser API key is required.

Each proof result includes a non-sensitive receipt with the application trace ID, live/demo mode, model, end-to-end latency, safety outcome, and schema-validation state. Proof bytes, data URLs, and model explanations are not written to telemetry.

The configured default is `gpt-5.6`. Current official guidance confirms the `gpt-5.6` alias routes to GPT-5.6 Sol, the Responses API supports text and image input, and JavaScript Structured Outputs support `responses.parse` with `zodTextFormat`.

Automated tests mock the SDK and never spend API credits. Before a live demo, test one representative campaign and one clear and one rejected proof image against the exact production model and account limits.

## Running checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

`npm run test` covers:

- Campaign, onboarding, and proof-verification schemas
- Level, XP progress, enemy health, and campaign progress calculations
- Duplicate reward protection
- Image signature validation
- Valid and malformed mocked OpenAI responses
- Campaign generation authorization and persistence failures
- Accepted, rejected, low-confidence, unauthorized, duplicate, and progression-failure verification paths
- Moderation-gate, demo rejected-sample, demo-reset, and Realtime session boundaries
- Service-role-only SQL mutation contracts
- Seeded goal → campaign → quest → proof → verification → refresh progression flow

## Demo mode

Set this only in an environment where the labelled fallback should be available:

```env
DEMO_MODE_ENABLED=true
```

The seeded demo:

- Uses a pre-generated “Kingdom of Python” campaign.
- Uses a guarded demo verification result so a presentation does not depend on external services.
- Stores demo progress in an HTTP-only cookie for eight hours.
- Labels the campaign and verification response as demo behavior.
- Can load deterministic passing and rejected proof images generated only in the browser for judge demonstrations.
- Offers a one-click reset that clears only the HTTP-only demo progress cookie.
- Labels browser speech as a device-voice demo instead of presenting it as OpenAI Realtime.
- Does not call OpenAI or claim the fallback is real AI.

For a live AI demo, configure Supabase and OpenAI, sign in with a real test account, and disable demo mode.

See `DEMO_SCRIPT.md` for the sub-three-minute presentation flow.

## Proof verification evals

The repository includes an eight-case JSONL manifest covering clear acceptance, cropped output, unrelated evidence, unreadable evidence, partial requirements, and fabricated-looking evidence. It intentionally includes no proof files.

Validate the manifest and see which private files must be supplied:

```bash
npm run eval:proof:validate
```

After adding sanitized private images under the Git-ignored `evals/proofs/` directory and configuring `OPENAI_API_KEY`, run:

```bash
npm run eval:proof -- --output evals/reports/proof-verification.json
```

The live runner applies the same moderation, Structured Output, confidence, and all-requirements gates as the application. Generated reports and proof images are ignored by Git. No evaluation score is claimed until the private image set is supplied and the live command completes.

## Vercel deployment

1. Push the repository to your Git provider and import it into Vercel as a Next.js project.
2. Keep the default build command, `npm run build`.
3. Add all required environment variables in Vercel Project Settings. Use production values and never prefix server secrets with `NEXT_PUBLIC_`.
4. Set `NEXT_PUBLIC_APP_URL` to the final HTTPS production origin.
5. Apply both Supabase migrations before opening the live path.
6. Add the production `/auth/callback` URL to the Supabase redirect allowlist.
7. Confirm the private storage bucket and policies were created.
8. Deploy, then run the manual golden-path check below as a fresh test user.
9. Set `DEMO_MODE_ENABLED=false` for normal production operation, or keep it `true` only when the visibly labelled fallback is intentional.

## Manual live golden-path check

1. Create and confirm a test account.
2. Submit “Learn Python fundamentals in seven days.” with 30 minutes, Procrastination, and Balanced difficulty.
3. Confirm the generated campaign and at least three quests exist in Supabase and appear after refresh.
4. Open an available quest and upload a clear supported image under 5 MB.
5. Confirm the storage object is private and follows the required path.
6. Verify the proof. For accepted proof, confirm one quest completion event, one XP award, one health reduction, and the calculated level.
7. Retry the verification request and confirm XP and health do not change.
8. Refresh the campaign and confirm the saved values remain.
9. Sign in as another user and confirm the first user’s campaign, quest, submission, and proof object cannot be read.

## Known limitations

- Live OpenAI, Supabase, storage, RLS, and Vercel deployment were not exercised in this credential-free recovery workspace.
- The proof eval manifest validates locally, but its private images and live model scores are deliberately absent from the repository.
- The seeded demo persists in an HTTP-only cookie, not Supabase, and is intentionally not presented as AI verification.
- Uploaded proof files do not yet have an automated retention/cleanup job; users can delete objects allowed by the existing private storage policy.
- Adaptive quest generation is best-effort and intentionally cannot block or undo progression.
- Authentication is limited to Supabase email/password for the MVP.
- This is a hackathon MVP, not a medical, financial, legal, or safety-critical task system.

## Roadmap after the critical path is live-verified

- Add a retention policy and user-facing proof deletion flow.
- Add production telemetry for model latency, schema failures, and verification retry rate without logging proof contents or secrets.
- Evaluate the adaptive quest quality against representative goals before enabling it broadly.
- Add a browser-level live Supabase staging test once secure staging credentials are available.
