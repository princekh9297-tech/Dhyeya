# V4.3.0 — Fast PDF Import + Hindi Integrity Gate

- Reworked Admin Question Bank import around a direct PDF-first workflow.
- Added automatic processing on PDF selection.
- Added ready/review/Hindi integrity counters.
- Added first-question structured preview with English + Hindi + options.
- Added Review Queue for parser and validation failures.
- Added deterministic PDF question IDs for repeatable re-imports.
- Added Hindi integrity metadata: OK / missing / broken.
- Parser now returns valid questions even when some blocks require review; one bad block no longer blocks the whole import.
- Preserved UTF-8/NFC validation and PostgreSQL Unicode safeguards.
- Added optional automatic Test creation/linking from the same import.
- Added cache-busting version 4.3.0 for the admin foundation script.
- No existing questions are deleted or rewritten by this release.
