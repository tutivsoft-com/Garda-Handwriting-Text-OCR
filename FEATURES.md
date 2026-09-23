# Garda Handwriting Text OCR Features

Garda turns a user-selected handwritten image or PDF into searchable Markdown in Obsidian.

## Current features

- Transcribe JPG/JPEG, PNG, GIF, BMP, TIFF/TIF, HEIC, WEBP, and PDF files up to 20 MB.
- Choose an output action: copy text to clipboard, append to the current note, replace the selected embed, or create a transcription note.
- Run OCR from supported file and editor menus or from the command palette.
- Process a folder sequentially with visible progress, cancellation, and per-file error handling.
- Process multipage PDFs page by page and show a quality label and manual-review marker for each result.
- Reuse cached results for unchanged files.
- Configure the Garda backend URL and API key, test the connection, and manage Constance account credits from settings.
- Keep source attachments unchanged by default; replacing an embed is an explicit user choice and is blocked for pages marked for review.

## How OCR works

The plugin sends the selected file to the configured Garda backend. The backend preprocesses each page and forwards it to its configured remote OCR provider. The current source uses OpenRouter Chat Completions. A backend and internet connection are required; Garda is not offline OCR.

## Review and limitations

Quality flags are simple output heuristics, not calibrated confidence scores. Recognition depends on the handwriting, page quality, layout, and model output. Review transcriptions before relying on them. Active job data is held in backend memory until retention cleanup, and a backend restart can interrupt an active job.

See README.md and docs/USER_GUIDE.md for setup and usage, REQUIREMENTS.md for current limits, architecture.md for data flow, and MARKETING.md for accurate product copy.
