# DHYEYA V4.2.8 — Question Bank Import UI

Only the Admin → Question Bank → Import Questions interface/workflow was changed.

## Added
- Four-step visual import flow: Upload → Configure → Validate → Import.
- Drag/drop file area plus file metadata.
- Clear Question Bank only vs Question Bank + Create Test destination choice.
- Test configuration shown only when Create Test is selected.
- Import metadata controls: subject, source, language, difficulty.
- Question type remains automatic.
- Validation summary cards for valid, errors, Unicode, and review blocks.
- Bilingual question preview with first five questions and options.
- Explicit import confirmation and dynamic progress.
- Recent import history sourced from existing audit logs.
- Detailed validation errors shown when the parser rejects a file.
- Existing import batching and UTF-8 validation preserved.

## Deliberately untouched
- Student dashboard, quiz engine, tests, profile, support, analytics, authentication, and other admin screens.
- Existing PostgreSQL question/test data.

## V4.2.9 — BPSC PYQ Subject Categorisation
- Replaced dynamic/Uncategorized subject output in the BPSC PYQ Archive with eight fixed BPSC subject categories.
- Category counts are calculated from PostgreSQL question-to-paper mappings, not hard-coded.
- Zero-count categories remain visible for consistent navigation.
- Selecting a category continues into Practice/Exam mode with that subject filter applied.
- No categorisation changes were made to non-BPSC content.
