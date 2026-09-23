# DHYEYA V4.1.0 — Structured Question Presentation

## Requested changes
- Match-the-Following questions are detected automatically and presented as two visual columns: **List 1** and **List 2**, regardless of where the lists occur in the stored question text.
- Supports common list formats including letter/number and number/Roman-numeral matching formats.
- Statement-based questions are detected automatically and their individual statements are presented in bordered statement boxes when source markers are recoverable.
- Statement variants such as numbered statements, `(N)/(O)`, `Statement I/II`, and Roman-numeral forms are supported.
- If a statement-based source has unusable/OCR-corrupted statement markers, the source text is preserved inside a single statement box instead of being discarded or rewritten.
- Assertion–Reason questions are detected automatically and rendered as separate **Assertion (A)** and **Reason (R)** panels.
- Explanation feedback in Practice Mode has been redesigned as a stronger premium explanation panel with a labeled header, clearer hierarchy, subtle border/shadow, and theme-aware styling.
- Server-loaded questions now retain `metadata`, `question_type`, `year`, `topic`, `source`, and `source_exam` so the presentation engine can identify structured question types.

## Preservation
- Question wording, options, answers, explanations, database schema, test logic, navigation, six-theme cycle, and existing platform functionality were not intentionally changed.
- The structured rendering is a presentation layer only; stored question content is not rewritten.
- Theme 4 remains the default and the six-theme cycle remains unchanged.

## Validation
- Inline JavaScript syntax checked with Node.js.
- External `nexus-v2.js`, `nexus-foundation.js`, and `dhyeeya-v3.js` syntax checked.
- Tarkash bank was used to test structured-question detection and parsing.
