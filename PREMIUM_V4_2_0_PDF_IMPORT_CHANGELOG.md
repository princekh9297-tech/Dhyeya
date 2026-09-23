# DHYEYA V4.2.0 — Admin PDF Question Import

- Admin Question Bank now accepts PDF, JSON and CSV uploads.
- PDF uploads are parsed server-side into structured question JSON before import.
- PDF parser detects MCQ, statement, assertion-reason, match and sequence/chronology patterns where the source text makes them identifiable.
- Parser returns a review queue for blocks that cannot be confidently parsed instead of silently guessing.
- Admin sees page count, detected question count and held-for-review count before importing.
- Existing JSON/CSV import workflow is preserved.
- Imports continue to use the existing PostgreSQL question bank and optional test mapping.
- Generated IDs for rows without IDs now use a deterministic question fingerprint to reduce duplicate imports.
- Added multer and pdf-parse dependencies.
- No student-facing quiz flow or existing question data is reset.
