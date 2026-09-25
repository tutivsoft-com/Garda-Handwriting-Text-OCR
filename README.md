# Garda Handwriting Text OCR

Garda Handwriting Text OCR is an Obsidian plugin for turning handwritten notes into searchable text inside Obsidian. V1 uses a Garda SaaS OCR backend and the existing TutivSoft Constance credit system.

Version: `5.7.21` · [Complete user guide](./docs/USER_GUIDE.md)

Setup and troubleshooting: [Complete user guide](./docs/USER_GUIDE.md).

## What Garda does

Garda is an Obsidian plugin that turns a user-selected handwritten image or PDF into Markdown text. It sends the selected file to the configured Garda backend, which preprocesses pages and forwards them to the OCR model configured in the backend. The current backend source uses OpenRouter Chat Completions with `~deepseek/deepseek-v4-flash-latest`; the model is controlled by the backend, not by plugin settings.

Each successfully processed page consumes one OCR credit. The plugin offers 20-, 160-, and 640-page packs through Constance; checkout shows the current price. Unchanged files can be served from the local cache without another OCR request or credit spend.

## Status

This curated TutivSoft release repository is the repository mapped to the Obsidian Community listing. It contains the runtime assets, public metadata, user guide, attestation workflow, and the exact eight-file TypeScript dependency closure required to review the plugin. The complete source, backend, tests, and internal documentation remain in the private main repository.

## Installation

Install Garda from the Obsidian Community plugin browser, or copy main.js, manifest.json, and styles.css into .obsidian/plugins/garda-handwriting-text-ocr/ and enable it under Community plugins. Configure the Garda backend URL and API key in plugin settings, then use Test connection before processing a document.
## Usage

Garda adds image and PDF actions to supported editor and file-explorer menus, plus command-palette entries for clipboard extraction, appending, embed replacement, new-note extraction, and folder batches. The original image or PDF remains in the vault. Generated Markdown is indexed by Obsidian search.

To append a transcription, keep a Markdown note open. Garda captures that note when the action starts, so switching notes while OCR runs does not send the result elsewhere. Creating a transcription note never overwrites an existing note; repeat runs receive a numbered filename.

Supported inputs are JPG, PNG, GIF, BMP, TIFF, HEIC, WEBP, and PDF. Inputs are limited to 20 MB. PDFs are processed one page at a time. Unchanged files are served from a content-hash cache and do not consume another OCR credit.

## Privacy

OCR is explicit and user initiated. The selected vault file is sent over HTTPS to the configured Garda backend and then to its configured OCR provider. The Garda service does not train models; the provider has its own data handling terms, which users should review before processing sensitive content. Job data is held in backend memory and removed after the configured retention period, which defaults to 15 minutes. The plugin does not send separate usage analytics. The original vault file is preserved unless the user explicitly chooses **Replace embed**.

Low-quality pages are marked for manual review and cannot be used for destructive embed replacement without review.

## Billing And Model

Garda uses the account-linked TutivSoft Constance credit system. Sign in or
create a Constance account in plugin settings; Garda links a stable local
installation ID and polls the account-owned entitlement snapshot for the live
balance. One OCR credit is consumed for each successfully processed page, and
the same persisted event ID is reused if a spend response is interrupted.

The 20-, 160-, and 640-page one-time packs use Constance catalog plan codes
`standard`, `pro`, and `ultimate`; the current price is returned by Constance.
Checkout is created through the authenticated Constance
checkout endpoint with an idempotency key, which lets the server resolve the
current Paddle price. The legacy `/buy` URL is retained only as a compatibility
fallback. Paddle webhook fulfillment remains authoritative; after completing
payment in the browser, use **Refresh** in Garda settings. Garda has no shared
billing secret, signed callback endpoint, or raw-body/HMAC callback handler.

## Diagnostics

Use Copy full log in Garda settings or Copy full debug log from the command palette when reporting a problem. Garda copies up to the latest 1,000 plugin events since load; it excludes note contents, file paths, credentials, and raw error messages. The log resets when the plugin reloads.
## Limitations

Remote OCR requires a configured Garda backend and API key. Recognition quality varies with handwriting, image quality, page layout, and legibility. Low-confidence output should be reviewed before it is treated as authoritative.

## License

Garda is distributed under the MIT license. The backend uses its runtime dependencies' respective licenses.
