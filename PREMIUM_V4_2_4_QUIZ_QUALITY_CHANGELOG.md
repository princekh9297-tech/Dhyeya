# DHYEYA V4.2.4 — Quiz Content + Landscape Navigator Fix

- Inline numbered statement detection for PDF-style `1. ... 2. ... 3. ...` questions.
- Structured statement renderer now parses the clean English segment instead of duplicating a combined bilingual paragraph.
- Replacement-character Hindi (`�`) is never rendered as valid Hindi; corrupted optional Hindi explanation/question fields are suppressed.
- API question delivery suppresses known corrupted Hindi fields.
- Navigator now toggles open/closed from the trigger, closes on question selection, overlay click, close button, Escape, orientation change, and desktop resize.
- No changes to question content, scoring, test mapping, or database schema.
