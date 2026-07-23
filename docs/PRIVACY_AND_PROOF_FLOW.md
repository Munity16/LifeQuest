# Privacy and proof flow

This document describes application behavior, not a legal guarantee.

## What happens to an image

1. The route authorizes the user and quest.
2. It accepts JPG, PNG, or WebP files up to 5 MB.
3. It checks the declared MIME type and actual byte signature.
4. Sharp decodes a single frame, applies orientation, limits dimensions, and re-encodes a metadata-free JPEG.
5. Only the normalized output is stored in the private `quest-proofs` bucket.
6. The sanitized image is sent to the configured OpenAI provider for image safety screening.
7. If safe, the same sanitized image is evaluated only against the server-supplied quest requirements.
8. A bounded public receipt is stored; private model reasoning is neither requested nor persisted.

## Storage and access

Objects are scoped to `{userId}/{campaignId}/{questId}/{filename}`. Storage remains private. RLS protects user-owned database records, and server routes re-check user ownership.

## Deletion and retention

Users can delete their proof object from the quest screen. The submission row records deletion time and clears the path. The verdict, requirements assessment, trace/model/safety receipt, and earned progression remain to prevent duplicate rewards and preserve history.

The deployment configures `PROOF_RETENTION_DAYS` (default 30) and protects the scheduled cleanup route with `CRON_SECRET`. A live operator must verify the cron schedule and deletion behavior.

## Data intentionally excluded from telemetry

Proof bytes, image URLs, data URLs, raw IPs, emails, goals, prompts, and private reasoning are excluded. Operational records contain allowlisted status/latency/error fields; AI usage records contain operation/model/available unit counts/latency/success/trace ID.

## User guidance

Do not upload identity documents, credentials, precise locations, medical information, faces, third-party confidential content, or any image you lack permission to use.
