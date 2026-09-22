# BPSC Prelims Nexus — Production Foundation v2

This package is the deploy-together foundation for the multi-user BPSC Prelims Nexus platform.

## Included in v2

- PostgreSQL-backed student accounts
- Student ID generation (`BPN-YY-XXXXXX`)
- Login by Student ID, username or email
- Secure bcrypt password hashing
- HTTP-only JWT session cookie
- Student profile persistence
- Server-backed planner
- Server-backed test library
- Real test/question schema and test-question mapping
- Practice/Exam engine hooks
- Attempt + question-level persistence
- Revision item creation from incorrect answers
- XP, levels and streak persistence
- Performance API
- Leaderboard API
- Full admin console inside **Quick Tools**
- Admin authentication through the same secure login system
- Admin-only authorization on all management endpoints
- Student creation with generated ID/password
- Password reset with one-time credential display
- Block / activate / deactivate-ready account states
- User search and monitoring
- Attempt monitoring
- Planner activity monitoring
- Audit log
- Test creation
- Bulk content import API
- No AI/API secret is exposed to the browser

## Admin setup

Set these variables before the first production start:

```text
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=use-a-long-random-password
ADMIN_NAME=BPSC Nexus Admin
ADMIN_USERNAME=admin
```

On startup, the server creates the admin if the email does not exist. If it already exists, it is promoted to `admin` and activated.

After login, open **Quick Tools → Admin Console**.

## Deploy

1. Create PostgreSQL.
2. Run `schema.sql` against the database.
3. Set `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`.
4. Set the four `ADMIN_*` variables.
5. Build command: `npm install`
6. Start command: `npm start`
7. Deploy the entire folder as one Node web service.

## Real question bank migration

The UI is ready for the real data, but the current conversation did not contain the user's full question-bank/test files. Therefore no question text has been invented or silently replaced.

The Admin Console has a bulk import endpoint:

```json
{
  "tests": [
    {
      "slug": "kgs-2024-test-01",
      "title": "KGS Test 01",
      "institution": "KGS",
      "category": "BPSC",
      "year": 2024,
      "sequence_no": 1,
      "duration_seconds": 7200,
      "published": true
    }
  ],
  "questions": [
    {
      "id": "q-001",
      "subject": "History",
      "topic": "Modern India",
      "question_en": "...",
      "question_hi": "...",
      "options": ["...","...","...","..."],
      "answer": 0,
      "explanation_en": "...",
      "explanation_hi": "..."
    }
  ],
  "testQuestions": [
    {"test_id": "TEST_UUID", "question_id": "q-001", "sort_order": 1}
  ]
}
```

For the user's actual BPSC test/PYQ archives, the next step is to feed the original files into this import format. The platform does not alter question wording.

## Important production note

Admin access is server-authorized. Hiding the Admin Console in the browser is only a UX layer; every `/api/admin/*` endpoint independently requires an authenticated `admin` role.

For a public launch, use HTTPS, a strong random `JWT_SECRET`, a strong admin password, database backups, and rate limiting/WAF at the hosting layer.


## Persistent student progress (V3)
All important student state is server-backed in PostgreSQL. Login sessions persist for 30 days, and a student can return days later, log in with the same Student ID/password, and recover their account data: profile, planner tasks, completed attempts, question-level attempts, revision bank, XP/levels, streak data, badges and leaderboard state. In-progress quizzes are also autosaved to `quiz_sessions` roughly every 8 seconds and on page exit, so an unfinished test can be resumed after closing the browser or returning later. `localStorage` is retained only as a UI/cache fallback and is not the source of truth for account progress.

Run the updated `schema.sql` on the production database before deploying V3.
