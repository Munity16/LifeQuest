# LifeQuest project instructions

## Product boundary

- Build only the focused LifeQuest product MVP described in the repository README and implementation tracker.
- Protect the golden path: goal onboarding -> campaign -> quest -> proof -> verification -> progression.
- Keep the application as one Next.js App Router project deployable to Vercel.
- Do not add social, payments, native apps, integrations, marketplaces, or other out-of-scope features.

## Architecture and security

- Use strict TypeScript and validate browser, database, and AI boundaries with Zod.
- Keep OpenAI and Supabase service-role credentials in server-only modules.
- Use Supabase RLS for user-owned records. Never disable RLS to bypass authorization.
- Run all progression awards through the idempotent database RPC; never trust XP or damage supplied by a browser.
- Keep proof files private and scoped to `{userId}/{campaignId}/{questId}/{filename}`.
- Demo fallbacks must require `DEMO_MODE_ENABLED=true` and must never be described as real AI.

## UI and accessibility

- Preserve the dark fantasy/productivity visual direction: ink, purple, indigo, and restrained gold.
- Use semantic HTML, visible focus states, accessible labels, keyboard interaction, and reduced-motion support.
- Design mobile first and keep layouts readable at 320px through desktop widths.

## Verification before handoff

Run these commands and fix introduced failures:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

- Update `IMPLEMENTATION_STATUS.md` whenever a phase materially changes.
- Never claim a route, integration, or build works unless the relevant check has been run.
- Do not commit `.env.local`, generated reports, proof images, or secrets.
