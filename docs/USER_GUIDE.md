<!-- SETTINGS-CURRENT-2026-09-30 -->
## Current local settings implementation

The local working tree uses persisted **Simple** and **Advanced** modes; new installs default to Simple. Simple shows everyday workflow and account/billing controls; Advanced adds customization and diagnostics. Review-before-apply remains off by default in current source; explicit saved preferences remain in effect.


This guide describes the prepared plugin behavior; release availability is tracked separately.
Simple: account, page balance, purchases and connection test. Advanced: service/privacy details and diagnostics. Model and retention are controlled by the service.

<!-- SETTINGS-CURRENT-2026-09-30:END -->

<!-- BILLING-CURRENT-2026-09-30 -->
## Current local account and billing behavior

Use **Connect** with your email and password. A new account is registered; an existing account is authenticated. New users must follow the emailed verification link and Connect again. Incorrect passwords offer password recovery; passwords are never saved. Paid purchases and free allowances belong to the authenticated account, not a locally entered email or an editable cached balance. Reinstalling does not replenish the same account's allowance.

Constance is the billing authority. Credit units remain app-specific: characters, OCR pages, searches, conversions, repair/protection batches, or captures. Checkout return URLs and cached balances never grant credits. Payment fulfillment comes from the server’s verified Paddle webhook, and balances refresh from authenticated entitlements. Unknown usage or checkout results reuse the persisted operation ID; they must not create a new debit or alternative checkout.


Current Paddle offers and page allowances load from the authenticated Constance catalog; the client does not keep a second price table.
<!-- BILLING-CURRENT-2026-09-30:END -->

# Garda Handwriting Text OCR — user guide

## What Garda does


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


## Diagnostics

For troubleshooting, open Garda settings and choose Copy full log, or run Copy full debug log from the command palette. The copied log contains up to the latest 1,000 Garda events since the most recent plugin load. It excludes note contents, file paths, credentials, and raw error messages. Logs reset when Garda reloads.

## OCR provider
Garda prepares image and PDF pages locally, decrypts its existing managed OpenRouter key manifest (Pattern B), and sends each page directly to OpenRouter using the established image-capable model. No provider key field or custom endpoint is required. Constance handles billing account verification, current Paddle offers, and idempotent credit spending. OCR results are cached locally for unchanged attachments.
