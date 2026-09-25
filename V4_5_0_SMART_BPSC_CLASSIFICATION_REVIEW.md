# DHYEYA V4.5.0 — Smart BPSC Classification Review

- Replaced silent BPSC auto-import classification with Preview → Review → Import.
- Added Gemini-assisted BPSC classification in 50-question batches.
- Classification uses full question + options with explicit definitions for all 8 BPSC subjects.
- Returns confidence and a short classification reason.
- Low-confidence questions are not approved by default.
- Admin can approve/reject visible questions, approve high-confidence questions, filter by subject/review status, and manually change any subject.
- Only approved questions are imported.
- Hindi pre-translation runs only after classification approval/import, avoiding translation of rejected questions.
- BPSC imports are blocked server-side unless every imported question has one of the eight approved subjects.
- Existing non-BPSC Question Bank imports retain their previous workflow.
- Existing English/Hindi/Bilingual quiz display remains unchanged.
