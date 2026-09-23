# DHYEYA V4.3.1 — Fast PDF Question Import

## Goal
Add questions from a question-paper PDF directly into DHYEYA without manually converting PDF → CSV → JSON.

## Admin workflow
1. Admin Console → Question Bank → Import Questions
2. Upload PDF
3. Enter optional test details
4. Server extracts and structures questions
5. Preview shows English, Hindi, options and detected question type
6. Unicode/Hindi integrity is checked
7. Questions with parser/Unicode problems are placed in Review Queue
8. Click **Import Ready Questions**
9. Optional Test Details automatically create/update the test and map imported questions

## Hindi / Unicode policy
- Source bytes are read as UTF-8 for JSON/CSV.
- PostgreSQL client encoding remains UTF-8.
- Text is normalized only with Unicode NFC.
- Replacement character U+FFFD, invalid surrogates, NUL, and common mojibake patterns are rejected by the normalizer.
- PDF items with suspicious Hindi are flagged for review rather than silently rewritten.
- No automatic Hindi translation or guessed character replacement is performed.

## Repeatability
PDF question IDs are deterministic for a given source PDF and question block. Re-uploading the same PDF therefore updates existing rows instead of creating a second copy.

## Important limitation
Text extraction cannot reconstruct Hindi that is already destroyed inside a PDF's embedded font encoding. Such content is deliberately sent to Review instead of being guessed. Scanned/image-only PDFs still require an OCR pipeline before their text can be imported reliably.
