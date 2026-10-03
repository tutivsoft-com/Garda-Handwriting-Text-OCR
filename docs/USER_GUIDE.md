# Garda Handwriting Text OCR — user guide

## What Garda does

Garda extracts handwriting from a selected image or PDF attachment and lets you copy or place the transcription in your vault. OCR runs on pages prepared locally; the page images are sent directly to OpenRouter. Constance manages Garda accounts, current offers, checkout and OCR credits.

## First setup

1. Install and enable **Garda Handwriting Text OCR**.
2. In **Settings → Community plugins → Garda Handwriting Text OCR**, connect your billing account. No endpoint or API-key field is required.
3. Use **Test connection** before processing a real file.
4. Start with one clear image and review the transcription.

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

## Credits, checkout, and privacy

Each successfully processed page consumes one OCR credit. In **Settings**, connect
your Constance account before scanning. Garda links its stable installation ID
to that account and refreshes the server-authoritative balance. The current
one-time packs grant 50, 150, 450, or 1,200 pages; current prices and descriptions
come from Paddle through Constance. Garda opens the authenticated checkout in
your browser, then refreshes balance as settlement is confirmed by Constance's
webhook processing rather than the browser return page.

If a network response is lost while a document is being charged, Garda keeps
the pending event ID and retries that same event so the server's idempotency
guard prevents a duplicate debit. Garda prepares the selected image or PDF page
locally, then sends that page directly to OpenRouter. Do not process confidential
handwriting unless you accept the provider's data handling terms.

## Troubleshooting

- If a file is not accepted, check that it is a supported image or PDF and is no larger than 20 MB. Some HEIC/TIFF files depend on browser decoding; convert them to PNG or JPEG if needed.
- If processing fails, check your connection, account status and available page credits, then retry the selected attachment.
- If OCR completes with uncertain pages, review the transcription before using it. Garda prevents replacement when review is required.


## Diagnostics

For troubleshooting, open Garda settings and choose Copy full log, or run Copy full debug log from the command palette. The copied log contains up to the latest 1,000 Garda events since the most recent plugin load. It excludes note contents, file paths, credentials, and raw error messages. Logs reset when Garda reloads.
