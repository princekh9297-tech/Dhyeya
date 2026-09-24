# DHYEYA V4.4.1 — Translation Reliability & Language Switch

- Translation batch size defaults to 50 questions (maximum 50).
- Default Gemini model changed to `gemini-3.5-flash-lite`, a current GA Flash-Lite model optimized for high-volume translation/simple data processing.
- Added persistent translation cache in PostgreSQL so completed 50-question translation batches survive failures and can be resumed on the next import attempt.
- Added retry with exponential backoff for transient Gemini failures (408/409/425/429/5xx).
- Added configurable retry controls: `TRANSLATION_MAX_RETRIES`, `TRANSLATION_RETRY_BASE_MS`, `TRANSLATION_RETRY_MAX_MS`.
- Removed deprecated sampling temperature from Gemini request configuration.
- Added a dedicated quiz language switch button with explicit English / हिन्दी / Bilingual choices.
- Language choice remains stored in localStorage and applies immediately without a translation API call during the quiz.
- Existing PostgreSQL bilingual fields and pre-translation flow remain compatible.
