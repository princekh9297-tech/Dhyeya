# DHYEYA V4.5.1 — Smart Classification + Question Quality Review

- Added two-stage BPSC review pipeline: Gemini classification plus deterministic quality checks.
- Classification preview now includes confidence, rationale, answer consistency check, duplicate flags, detected exam/year metadata.
- Added server-side duplicate protection for BPSC uploads (within-upload and identical existing English text).
- Added `/api/admin/questions/quality-preview` for duplicate, metadata and quality diagnostics.
- Added `/api/admin/questions/translate-preview` for Hindi preview before import; preview is not persisted.
- Admin classification table now exposes Answer Check, Exam/Year and Quality columns.
- Added Quality Check and Hindi Preview controls.
- Hindi pre-translation remains post-approval and persisted in PostgreSQL.
- Existing bilingual language switch and 50-question translation batches retained.
- Server syntax and frontend syntax verified with Node --check.
