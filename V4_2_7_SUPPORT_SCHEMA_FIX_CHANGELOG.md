# DHYEYA V4.2.7 — Support Schema Compatibility Fix

- Fixed Render startup failure caused by an incompatible `support_messages.ticket_id` schema expectation.
- Reused the existing DHYEYA `support_threads` + `support_messages(thread_id, sender_id, ...)` model used by earlier builds.
- Removed the incompatible `support_tickets` schema from startup SQL.
- Support student/admin messaging and analytics now work against the legacy-compatible schema without dropping or resetting existing data.
- Fixed One-tap Revision Practice to call the server endpoint with POST as required.
- No question-bank content or existing tests are modified.
