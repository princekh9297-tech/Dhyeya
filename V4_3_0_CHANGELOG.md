# DHYEYA V4.3.0 — Automatic BPSC PYQ Subject Classification

## What changed
- BPSC PYQ Archive imports now automatically classify every imported question into exactly 8 subjects:
  1. General Science
  2. Bihar Special
  3. Modern Indian History
  4. Ancient Indian History
  5. Medieval Indian History
  6. Indian Polity
  7. Geography
  8. Indian Economy
- Classification is performed server-side during PostgreSQL import, including chunked imports of 10,000+ questions.
- Existing explicit canonical subject values are preserved; generic labels such as History, Science, Polity, Geography and Economy are used as hints and the question text is classified.
- Question text, Hindi text, topic/subtopic, source and import metadata are scored using deterministic subject rules.
- BPSC PYQ imports never receive `Uncategorized`; a deterministic fallback assigns General Science when no classifier signal is found.
- Auto-classified questions receive metadata marking classifier name/version.
- Import response now reports the number classified and per-subject counts for verification.
- Existing non-BPSC imports are unchanged.
- BPSC archive UI continues to show live PostgreSQL counts and subject-filtered question sets.

## Important
This is a deterministic classifier, not an LLM. It is designed for fast bulk classification without requiring an AI API call for every question. Ambiguous questions may still require later manual review.
