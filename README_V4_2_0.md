# DHYEYA V4.2.0

## Admin PDF Import

Admin → Question Bank → Import Questions → choose a PDF.

The server extracts text, detects question blocks/options, creates structured JSON in memory, and returns a preview before anything is written to PostgreSQL.

The admin can then click **Import to Question Bank** and optionally create/update a Test at the same time.

### Important

Text-based PDFs are supported by the built-in parser. Image-only/scanned PDFs are not OCR'd by this build; those blocks are placed in the review queue rather than being guessed.

JSON and CSV imports remain supported.
