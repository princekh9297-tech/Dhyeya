# DHYEYA V4.2.3 — Quiz Quality Fix

- Fixed bilingual rendering path: Unicode NFC normalization and common mojibake repair for imported text.
- Split combined English/Hindi question and explanation content when safe.
- Avoided using corrupted question_hi/explanation_hi when clean bilingual source text is available.
- Fixed statement parser boundary so “Which of the statements given above…” remains the question instruction, not Statement 2.
- iPad/mobile portrait controls now use a two-row responsive action layout so all controls remain reachable.
- Preserved Question Navigator drawer, six-theme cycle/persistence, structured question rendering, scoring, and database behavior.
- Question typography unchanged.
