# Garda Handwriting Text OCR — user guide

## What Garda does

Garda sends a user-selected handwritten image or PDF page to the configured Garda OCR backend and returns searchable Markdown text inside Obsidian.

## First setup

1. Install and enable **Garda Handwriting Text OCR**.
2. Deploy or obtain access to the Garda backend.
3. In **Settings → Community plugins → Garda Handwriting Text OCR**, enter the backend URL and Garda API key.
4. Use **Test connection** before processing a real file.
5. Start with one clear image and review the transcription.

## Process an image or PDF

Right-click a supported file in the file explorer or use the command palette. Choose one of these destinations:

- **Copy transcription** — place the text on the clipboard.
- **Append transcription** — add the text to the current note.
- **Replace embed** — replace the selected image/PDF embed after review.
- **Create transcription note** — create a new Markdown note beside the source.

Supported formats include JPG/JPEG, PNG, GIF, BMP, TIFF/TIF, HEIC, WEBP, and PDF. Inputs are limited to 20 MB. PDFs are processed page by page.

### Example

A handwritten image containing:

```text
Call Maya Friday 4pm
Send revised proposal
```

can become:

```markdown
## Transcription

- Call Maya Friday 4pm
- Send revised proposal
```

Review uncertain pages and dates before treating the text as authoritative.

## Folder batches

Right-click a folder and choose the batch extraction action. Garda shows progress, keeps the original files, caches unchanged content, and reports pages that need manual review. Use the visible cancel control when you need to stop a long batch.

## Credits and privacy

Each successfully processed page consumes one OCR credit. The selected file is uploaded to the configured backend, which forwards it to its configured OCR model. Do not upload confidential handwriting unless that remote-processing flow is acceptable to you.

## Troubleshooting

If **Test connection** fails, verify the backend URL, HTTPS certificate, API key, and network access. If a PDF page is marked low quality, inspect the original image and correct the resulting Markdown manually. A backend restart can interrupt in-progress jobs, so retry only after checking whether a transcription note was created.
