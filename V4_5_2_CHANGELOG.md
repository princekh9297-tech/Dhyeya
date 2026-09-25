# DHYEYA V4.5.2 — Robust Gemini Structured Translation

## Fix for Hindi translation invalid JSON
- Replaced prompt-only JSON enforcement with Gemini Structured Outputs using an explicit JSON Schema.
- Uses the current Generate Content `responseFormat.text.mimeType=application/json` + schema structure.
- Uses the `x-goog-api-key` request header rather than placing the API key in the URL.
- Detects empty/truncated model output and retries automatically.
- If a 50-question translation batch is too large or the model output is malformed/truncated, automatically splits the batch into smaller batches and continues.
- Keeps the configured `TRANSLATION_BATCH_SIZE=50`; splitting is automatic only when necessary.
- Classification now also uses Structured Outputs and the same robust retry behavior.
- More useful model-output failure diagnostics.

## Existing features retained
- BPSC Smart Classification Review.
- Admin subject preview/approval before import.
- Answer/quality checks and duplicate detection.
- Hindi pre-translation after approval.
- English / Hindi / Bilingual quiz switch.
- PostgreSQL translation cache and resumable translation.
