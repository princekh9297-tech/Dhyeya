# DHYEYA v4.8.0 — Premium Question Ingestion Studio

## Purpose
Adds a dedicated HTML Question Ingestion Studio to Dhyeya v4.7 without changing the student UI, quiz engine, authentication, motion system, or existing question content.

## New Admin workflow
- Admin-only **HTML Ingestion Studio**.
- Drag/drop or file-select `.html` / `.htm`.
- Server-side content extraction; source-page UI/CSS/JavaScript/navigation is ignored.
- Extracts only question, options, correct answer, explanation, and useful source taxonomy metadata.
- Preserves existing source categories when present.
- Automatically maps recognized categories into Dhyeya subject taxonomy.
- Automatic content-based subject classification when a source category is absent.
- Confidence score and parser/classifier provenance are stored in question metadata.
- Low-confidence or malformed blocks are quarantined instead of silently imported.
- Extraction preview with subject distribution and sample questions.
- Automatic exact-duplicate protection for HTML ingestion against the existing question bank.
- Batch import in chunks of 1,000 questions to avoid oversized requests.
- Import summary reports new, updated, duplicate-skipped and quarantined counts.

## Supported automatic subjects
- General Science
- Bihar Special
- Modern Indian History
- Ancient Indian History
- Medieval Indian History
- Indian Polity
- Geography
- Indian Economy
- Current Affairs (when explicitly detected)

## Safety rules
- Existing questions are not deleted.
- Existing UI/interface is untouched.
- Source question/answer/explanation text is not rewritten by the extractor.
- Invalid Unicode and malformed question records continue to be blocked by the existing v4.7 validation layer.
- Exact duplicate questions from an HTML import are skipped rather than inserted again.

## Files
- `server.js` — HTML extraction, automatic taxonomy detection, validation and duplicate-aware import path.
- `public/dhyeya-ingestion-v480.js` — premium Admin Ingestion Studio UI.
- `public/admin.html` — loads the v4.8 ingestion module.
- `package.json` — version 4.8.0.
