# DHYEYA v4.8.1 — Safe Question Package Sync

## Added
- Additive JSON package sync for structured question banks.
- Supports flat premium packages such as Tarkash Annual PYQ Plus.
- Supports chapter-based Speedy Current Affairs 2026 packages with composite source keys.
- Stable `sync_source_key` + `content_hash` duplicate protection.
- Existing questions are never overwritten or deleted by package sync.
- Structurally invalid records are quarantined with their original payload and reason.
- Added `options_hi` storage so bilingual option text is preserved without changing the existing English option array.
- Added Current Affairs to the approved Dhyeya taxonomy for package sync/classification.
- Admin Ingestion Studio now accepts HTML and JSON packages and includes bundled Tarkash and Speedy CA packages.

## Sync policy
- Default mode is **additive**.
- Same source key, same content hash, same question ID, or same normalized question text is treated as an existing record.
- No automatic deletion.
- No automatic replacement of an existing question.
- Future corrections can be handled as an explicit update workflow rather than silently changing the bank.
