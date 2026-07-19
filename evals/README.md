# Private proof verification evals

The JSONL template defines balanced accepted and rejected cases without including real proof images. Put sanitized JPG, PNG, or WebP files in `evals/proofs/`; that directory is ignored by Git and must remain private.

Validate the case manifest and list missing images without calling OpenAI:

```bash
npm run eval:proof:validate
```

Run the live model and safety-gate evaluation after setting `OPENAI_API_KEY`:

```bash
npm run eval:proof -- --output evals/reports/proof-verification.json
```

The report contains case IDs, expected/predicted verdicts, confidence, safety status, requirements counts, latency, aggregate accuracy, false accepts, and false rejects. It never contains image bytes, data URLs, or model explanations derived from proof contents. Reports and private images are ignored by Git. Review false accepts first because they can incorrectly award progression.
