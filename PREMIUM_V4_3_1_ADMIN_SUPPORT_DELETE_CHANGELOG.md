# DHYEYA V4.3.1 — Admin Flexibility + Student Support

## 1. Whole-section deletion
- Removed the old 100-question UI limitation for bulk deletion; server bulk-delete accepts up to 50,000 IDs in one operation.
- Added **Delete a Whole Test / Section** in Admin → Content.
- Admin can choose to delete the test/section while keeping questions, or delete the test and also remove its questions when they are not mapped to another test.
- All destructive operations are transactional and audited.

## 2. Student → Admin messaging
- Added **Message Admin** to Quick Tools.
- Students can create a support subject and send messages directly to the admin.
- Admin has a Support Inbox with unread counts, thread status, conversation history and direct replies.
- Threads can be closed/reopened.
- Messages are stored in PostgreSQL.

## 3. Admin full-platform access
- Admin login now opens the normal DHYEYA platform rather than trapping the admin on the separate admin-only page.
- Admin can use Dashboard, Tests, PYQ, Revision, Performance, Planner, Leaderboard, Profile and Quiz areas after login.
- Admin Console remains available from the platform for management operations.

## 4. Database
- Added `support_threads` and `support_messages`.
- Existing questions, tests and student data are preserved.
