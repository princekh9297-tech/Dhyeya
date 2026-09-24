
## V4.4.1 Translation Update
- Default model: `gemini-3.5-flash-lite`
- Default translation batch: 50 questions
- Persistent Hindi translation cache + resumable imports
- Automatic transient-error retries
- Quiz language switch: English / हिन्दी / Bilingual

# DHYEYA V4.0 — Premium Test Engine

See `PREMIUM_V4_CHANGELOG.md` for the consolidated upgrade list.

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

No bundled question bank is required. Production questions are stored in PostgreSQL and are added/updated through the Admin Question Bank importer. PDF, JSON and CSV files are processed in memory during import and are not required by the student application after import.

## V3.9 — Large BPSC PYQ Archive

- Question imports support up to 50,000 questions per file.
- The browser automatically uploads imports in 1,000-question batches, so 25,000+ question banks do not need to be sent as one giant API request.
- If a test title is supplied, all batches map into the same test with continuous ordering.
- Existing question IDs are updated; new IDs are inserted.
- Admin Question Bank management is paginated at 100 questions per page, avoiding loading thousands of rows into the browser.
- Student BPSC PYQ Archive remains database-driven and groups questions by subject inside each published BPSC PYQ Archive test.
- Future question additions do not require GitHub or Render changes.

## Answer handling
The Question Bank importer accepts A-E, zero-based numeric option indexes, `*`, null, and empty answers. `*`, null, and empty answers are stored as SQL NULL. Five-option questions are supported. Questions with NULL answers remain attemptable but are excluded from correct/incorrect scoring; Practice Mode labels them “No valid answer.”


## V4.2.5 — Database-Only Question Source

- Removed the legacy startup bootstrap that loaded the Tarkash question JSON from the repository.
- Removed the bundled `data/` question-bank files from the deployment package.
- PostgreSQL is now the sole production source of question/test content.
- Admin PDF/JSON/CSV imports continue to write directly to PostgreSQL.
- Existing database content is not deleted, reset, or migrated by this cleanup.
- A fresh deployment starts with the database schema/admin setup; questions are added through Admin → Question Bank.

## V4.2.6 — Global UTF-8 / Hindi Encoding Fix
- PostgreSQL is required to report `UTF8`; connection startup requests `client_encoding=UTF8`.
- Question text columns are verified as TEXT/VARCHAR and `options` as JSONB.
- JSON/CSV/PDF imports are decoded as UTF-8 and normalized to NFC without guessing/re-writing Hindi.
- Replacement characters (`�`), NULs, unpaired surrogates and common mojibake patterns are rejected before import.
- Import validation reports all row errors together instead of stopping at the first row.
- API JSON responses explicitly use `application/json; charset=utf-8`.
- Admin Question Bank includes a Unicode Diagnostic action.
- The quiz no longer performs mojibake "repair" or silently deletes Hindi fields; authoritative source re-import is used to restore corrupted stored content.
- Inline statement questions are separated into stem, numbered statement cards, and instruction; bilingual statement text is paired when supplied separately.
- Options render English and Devanagari on separate lines when a bilingual option is supplied.

## V4.4.0 Hindi Pre-Translation

Set these Render environment variables before enabling the importer checkbox:

- `GEMINI_API_KEY` — Gemini API key
- `GEMINI_MODEL` — translation model name supported by your Gemini API account (default: `gemini-2.5-flash`)
- `TRANSLATION_BATCH_SIZE` — questions per translation request (default: `20`, max `50`)

The Admin → Question Bank importer now has **Pre-translate missing Hindi** enabled by default. Hindi is generated during import and stored in PostgreSQL. Student quiz sessions do not call the translation API.

The quiz header has a language button cycling through **English → हिन्दी → Bilingual**. The selected mode is saved locally on the student's device.
