# DHYEYA V4.4.0 — Bilingual Pre-Translation

- Added server-side Hindi pre-translation during Question Bank import using configurable Gemini REST API.
- Translation runs only when `pretranslate_hindi` is enabled; admin UI enables it by default.
- Translation is batched and stored in PostgreSQL; quiz sessions make no translation API calls.
- Added BPSC competitive-exam Hindi terminology glossary.
- Options can be stored as `{en, hi}` pairs while remaining backward-compatible with existing string options.
- Added quiz language button: English / हिन्दी / Bilingual.
- Language choice is persisted locally and applies instantly without reloading the question bank.
- Import status reports translated question count and translation batch count.
- Environment variables: `GEMINI_API_KEY`, `GEMINI_MODEL`, `TRANSLATION_BATCH_SIZE`.
