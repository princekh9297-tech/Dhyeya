# DHYEYA V4.2.5 — Database-Only Question Source

- Removed legacy `bootstrapTarkashContent()` startup import.
- Removed bundled question-bank data files from the deployment package.
- PostgreSQL is the only production source of question/test content.
- Admin PDF/JSON/CSV import remains memory-based and writes to PostgreSQL.
- Existing PostgreSQL rows are not deleted, reset, or rewritten by this cleanup.
- Updated package version to 4.2.5.
