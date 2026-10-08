# DHYEYA v4.8.3 — Visible Tests + Fast Premium Sync

- Fixed premium package sync so imported questions are automatically linked to a published student-visible test.
- Fixed the case where questions existed in PostgreSQL but were invisible because they were not mapped to `test_questions`.
- Tarkash sync creates/uses `Tarkash Annual PYQ — Premium Vault` under BCW / BPSC PYQ Archive.
- Speedy CA sync creates/uses `Speedy Current Affairs 2026 — Premium Vault` under BCW / Current Affairs.
- Re-running an already completed package sync now repairs missing test mappings without duplicating questions.
- Replaced the per-question premium import loop with a set-based PostgreSQL JSONB insert, substantially reducing sync time.
- HTML Ingestion Studio now lets Admin choose `Import + publish as a test` or `Question Bank only`; test mode is selected by default.
- HTML test imports carry the selected title, institution, category and year and link chunks to the same test.
- Existing source question content remains unchanged; package sync remains additive and duplicate-safe.
