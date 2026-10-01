<!-- SETTINGS-CURRENT-2026-09-30 -->
## Current local settings implementation

The local working tree uses persisted **Simple** and **Advanced** modes; new installs default to Simple. Simple shows everyday workflow and account/billing controls; Advanced adds customization and diagnostics. Review-before-apply remains off by default in current source; explicit saved preferences remain in effect.


This describes local source changes, not a published release or verified live deployment.
Simple: account, page balance, purchases and connection test. Advanced: service/privacy details and diagnostics. Model and retention are controlled by the service.

<!-- SETTINGS-CURRENT-2026-09-30:END -->

<!-- BILLING-CURRENT-2026-09-30 -->
## Current local account and billing behavior

Use **Connect** with your email and password. A new account is registered; an existing account is authenticated. New users must follow the emailed verification link and Connect again. Incorrect passwords offer password recovery; passwords are never saved. Paid purchases and free allowances belong to the authenticated account, not a locally entered email or an editable cached balance. Reinstalling does not replenish the same account's allowance.

Constance is the billing authority. Credit units remain app-specific: characters, OCR pages, searches, conversions, repair/protection batches, or captures. Checkout return URLs and cached balances never grant credits. Payment fulfillment comes from the server’s verified Paddle webhook, and balances refresh from authenticated entitlements. Unknown usage or checkout results reuse the persisted operation ID; they must not create a new debit or alternative checkout.


See [local billing changes](../BILLING_REVIEW_2026-09-30.md). This section describes the current local source; older release walkthroughs below apply to their dated artifacts. Constance must support `/api/v1/auth/connect` before these clients are released.
<!-- BILLING-CURRENT-2026-09-30:END -->

# Garda Handwriting Text OCR — user guide

## What Garda does


## First setup

1. Install and enable **Garda Handwriting Text OCR**.
3. In **Settings → Community plugins → Garda Handwriting Text OCR**, Connect your Constance account. No endpoint or API-key field is required.
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

## Credits, checkout, and privacy

Each successfully processed page consumes one OCR credit. In **Settings**, enter
your Constance billing email and sign in or create an account before scanning.
The plugin links its stable installation ID to that account and refreshes the
server-authoritative balance. The 20-, 160-, and 640-page packs are one-time
purchases. Garda opens the authenticated Constance checkout in your browser;
after payment, return to Obsidian and press **Refresh balance**. Payment fulfillment is
confirmed by Constance's webhook processing, not by the browser return page.

If a network response is lost while a document is being charged, Garda keeps
the pending event ID and retries that same event so the server's idempotency
guard prevents a duplicate debit. The selected file is uploaded to the
upload confidential handwriting unless that remote-processing flow is
acceptable to you.

## Troubleshooting


## Diagnostics

For troubleshooting, open Garda settings and choose Copy full log, or run Copy full debug log from the command palette. The copied log contains up to the latest 1,000 Garda events since the most recent plugin load. It excludes note contents, file paths, credentials, and raw error messages. Logs reset when Garda reloads.

## Managed OCR through Constance
Managed AI runs through Constance with a server-selected model and bounded output. The plugin never fetches or decrypts a provider key. Guest previews remain in memory while open; sign up, verify email and authorize the displayed allowance split to reveal the exact result. Later apply/save of that result incurs no second charge. Prices and quantities refresh from Paddle through Constance. Lifetime starter use does not refill daily.
