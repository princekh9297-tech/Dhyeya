# DHYEYA V4.3.3 — Stability / Admin / Live Test Library Fix

## Critical fixes
- Replaced the broken standalone `/admin` modal-based experience with a dedicated admin control center.
- Admin login now lands on a clearly differentiated Admin Control Center.
- Admin Control Center includes Students, Tests & Sections, Question Bank, PDF Import, Support Inbox, Attempts, Planner and Audit.
- Added Open Student Platform for admins via `/student?admin_view=1`.
- Admin student-platform view no longer redirects back to `/admin`.
- Added admin test publish/unpublish endpoint.
- Test library API now calculates live question counts from `test_questions` instead of trusting stale `tests.question_count`.
- Student Test Series now loads published tests dynamically from PostgreSQL and groups them by actual institution/library.
- Removed dependency on hardcoded institution placeholders for live test availability.
- Existing-institution test picker falls back to the complete published test library when needed.
- Test page also renders correctly when loaded directly with `#tests`.
- Admin PDF importer can now select an existing test/section and attach imported questions to it, or create a new test automatically.

## Preserved
- Existing PostgreSQL question data.
- Existing PDF import parser and Hindi/Unicode validation.
- Student support messaging APIs.
- Bulk deletion / whole-section deletion APIs.
- Quiz engine and question rendering.
- No question content was rewritten or translated.
