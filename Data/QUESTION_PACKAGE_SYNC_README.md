# DHYEYA Question Package Sync

Dhyeya v4.8.1 supports additive synchronization of structured JSON question packages from the Admin Question Ingestion Studio.

## Current bundled packages
- `Tarkash_Annual_PYQ_Plus_Dhyeya_Premium_v1.0.json`
- `BpscNexus_Speedy_CA_2026_SYNC.json`
- `BpscNexus_Speedy_CA_2026_SYNC_MANIFEST.json`

## Identity model
Every package question receives a stable `sync_source_key` in `questions.metadata`.
Content is also protected by a `content_hash` and normalized question-text duplicate check.

For chapter-based sources, never use `question.id` alone. Use `chapter.id::question.id` as the source identity.

## Additive behavior
The sync path never deletes existing questions and never overwrites an existing record automatically. Existing matches are skipped. Invalid records are preserved in `question_ingestion_quarantine` with their original payload and reason.

## Future workflow
1. Produce the next package using the same source identity rules.
2. Upload the JSON in Admin → Question Ingestion Studio.
3. Preview taxonomy, duplicates and quarantined records.
4. Run Sync.
5. Only genuinely new questions are inserted.

The source question text, options, answer and explanation are treated as authoritative and are not rewritten by the sync layer.
