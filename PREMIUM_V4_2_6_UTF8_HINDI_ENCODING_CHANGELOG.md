# DHYEYA V4.2.6 — Global UTF-8 / Hindi Encoding Fix

## Root-cause findings
1. The browser itself was not the primary UTF-8 failure: the static `Not Attempted / प्रयास नहीं किया` UI rendered correctly.
2. The import pipeline contained a heuristic `repairImportedUnicode()` conversion. That attempted to guess mojibake rather than preserving the authoritative source bytes/text.
3. The quiz frontend contained a second heuristic `repairMojibake()` layer. This could alter already-valid Unicode and could not reconstruct lost source characters.
4. The API previously nulled Hindi fields containing `�`, which hid the corruption instead of repairing the authoritative data.
5. Statement rendering operated on the English stem and could treat the entire inline numbered block as one statement when the source used `1. ... 2. ... 3. ...` on one paragraph.

## Changes
- PostgreSQL connection requests `client_encoding=UTF8`.
- Startup verifies the database encoding is UTF8.
- Startup verifies question text fields are TEXT/VARCHAR and options are JSONB.
- All `/api` JSON responses explicitly declare UTF-8.
- JSON, CSV and PDF import paths use UTF-8 decoding.
- Source text is normalized only with Unicode NFC; no Latin-1/ASCII conversion is performed.
- Replacement characters, NUL characters, invalid surrogate sequences and common mojibake patterns are rejected before import.
- Import validation collects all errors across the full upload.
- Existing question content is never silently rewritten by the frontend.
- Admin Question Bank has a live Unicode Diagnostic endpoint/button.
- Bilingual question/option/explanation rendering keeps English and Hindi separated when separate source fields exist.
- Inline numbered statement questions are parsed into individual statement cards plus the final instruction.

## Existing corrupted records
This build deliberately does **not** guess missing/corrupted Hindi characters in PostgreSQL. The authoritative UTF-8 JSON supplied by the admin must be re-imported so the existing question IDs are upserted with the original source strings. The importer preserves the flat-array JSON structure and answer keys; when the same IDs and source order are supplied, the existing test mapping can be updated without changing question content.

## Verification performed
- `server.js` syntax check: PASS
- `nexus-foundation.js` syntax check: PASS
- `nexus-v2.js` syntax check: PASS
- All inline scripts in `public/index.html`: PASS
- No `latin1`, Windows-1252, ASCII decoding, or `TextDecoder('latin1')` patterns found
- No bundled `data/` directory present
- Statement parser test with inline `1. / 2. / 3.` format: PASS
- Replacement-character suppression test: PASS
