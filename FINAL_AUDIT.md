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
