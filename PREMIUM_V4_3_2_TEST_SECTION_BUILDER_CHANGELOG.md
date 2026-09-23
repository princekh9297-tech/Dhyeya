# DHYEYA V4.3.2 — Test Section Builder

- Added **Create Test Section** to the Admin Control Center.
- Uses the existing protected `POST /api/admin/tests` API; no new database table is required.
- Admin can create an empty section/test with name, exam/institution, series/category, year, duration, access type, and publish state.
- Automatically generates a unique URL-safe slug.
- New sections are immediately available to the Test Series library when published.
- Designed to be populated later through the PDF importer or Question Bank.
- No question content, answer keys, Hindi text, or existing tests were modified.
