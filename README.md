# DHYEYA 3.2.0

Consolidated authentication/session/profile/admin update.

- Simple public landing page with separate Student Login and Admin Login.
- Student and Admin have separate post-login interfaces.
- Role-aware server routing.
- Persistent 30-day HTTP-only session cookie with no-store auth pages.
- Student dashboard uses saved profile name and live time-based greeting.
- Battle navigation preserves the student session.
- Student profile supports DP and self-service password change.
- Admin can generate/reset student credentials, view Student ID, activity, attempts and battles, block/activate accounts, and send notifications.
- Passwords are never stored or displayed in plaintext; reset passwords are revealed once at generation/reset.
- Authenticated activity is recorded in the audit log.
- Existing PostgreSQL database is preserved; no reset is required.


## Ongoing Question Bank Management
After the first deployment, questions do not need to be added through GitHub. Sign in as Admin → Question Bank. Upload JSON or CSV, preview the detected questions, and import them directly into PostgreSQL. Existing IDs are updated; new IDs are inserted. You can optionally create/update a test and link the imported questions to it.

Templates: `data/question_import_template.json` and `data/question_import_template.csv`.
