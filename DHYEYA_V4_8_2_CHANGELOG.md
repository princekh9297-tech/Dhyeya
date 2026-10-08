# DHYEYA v4.8.2 — Ingestion Studio Visibility + HTML Upload Fix

- Adds a permanent **⚡ Ingestion Studio** button to the Admin page header.
- Adds the Ingestion Studio button directly inside the Admin Console toolbar.
- Keeps the floating launcher as a fallback, with a robust DOM-independent mount.
- Existing Question Bank upload now explicitly accepts `.html` and `.htm` in addition to TXT/JSON/CSV/PDF.
- Existing server-side HTML parser remains unchanged and is used for HTML imports.
- No question content is modified or deleted by these UI changes.
