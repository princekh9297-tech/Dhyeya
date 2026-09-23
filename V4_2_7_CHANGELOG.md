# DHYEYA V4.2.7 — Student Intelligence + Admin Operations

Built strictly on the V4.2.6 baseline.

## Student
- Student → Admin Support messaging with persistent tickets and replies.
- Dynamic dashboard metrics from PostgreSQL: attempts, average score, questions attempted, streak, best score, accuracy and revision count.
- Per-test progress from real submitted attempts.
- One-tap Revision Practice from the dashboard and Revision Vault.
- Incorrect submitted questions continue to feed the server-side Revision Bank automatically.
- Performance remains database-backed rather than placeholder/local-only statistics.
- Contact Admin added to Quick Tools.

## Admin
- Admin analytics: students, published tests, questions, attempts, average score and open support tickets.
- Most-attempted test analysis.
- Question difficulty/quality signals using observed attempt accuracy, attempt count and average time.
- Student support inbox with replies and close/reopen status.
- Whole-test/section deletion.
- Bulk question deletion limit raised from 1,000 to 50,000.
- Whole-test deletion can optionally remove questions that are used only by that test; shared questions are preserved.

## Database
- Added idempotent support_tickets and support_messages tables.
- Existing question/test/attempt data is not reset or replaced.
- Existing UTF-8/Hindi safeguards from V4.2.6 are preserved.
