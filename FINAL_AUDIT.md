# DHYEYA V3.1 Final Audit

## Corrected issues found during static audit
1. Existing `question_attempts` tables could lack `question_id`, causing Render startup failure.
2. Student notification UI was only a placeholder (`No new notifications`) despite working APIs.
3. Battle Arena had backend APIs but the user-facing navigation/lobby could be absent or unreliable.
4. Battle timer was displayed as a static number and the backend trusted client `time_ms`.
5. A battle could stall indefinitely when one player did not answer.
6. Student profile had no profile-picture picker/upload flow; avatars were initials only.
7. Profile-page logout was a non-functional placeholder.
8. Admin student listing could include admin accounts; admin status/password operations are now restricted to student targets.
9. Legacy `test_questions` compatibility now includes a unique pair index for the server's upsert path.
10. Self-registration UI is hidden because production student accounts are admin-created.

## Verification
- Node syntax checks passed for `server.js`, `nexus-foundation.js`, `nexus-v2.js`, and `dhyeeya-v3.js`.
- No PostgreSQL database reset is performed by the package.


## V3.4 compatibility/fix pass
- Added startup migrations for legacy `notifications` columns (`type`, `link`, `created_by`, `created_at`).
- Added startup reconciliation for legacy Battle Arena tables/columns and safe TEXT normalization for empty legacy question-id columns.
- Battle lobby now renders each API panel independently instead of failing the entire lobby when one endpoint is unavailable.
- Planner uses local calendar dates instead of UTC dates, fixing the one-day shift visible in India.
- Leaderboard podium is populated from real server leaderboard data instead of static Student placeholders.
- Existing database is preserved; no reset/drop is performed.

## Tarkash Annual PYQ Plus import pass — 2026-09-22
- Central question-bank source: `data/tarkash_annual_pyq_plus_2026_validated.json`
- High-confidence records staged for automatic PostgreSQL import: 541
- Records with unresolved PDF glyph/encoding issues quarantined: 84
- Additional answer blocks that could not be structurally recovered were not guessed or fabricated.
- The source PDF itself is not required at runtime; the database receives structured question records.
- Import is idempotent by test slug.
