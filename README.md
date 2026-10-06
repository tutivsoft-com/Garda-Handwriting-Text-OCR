# Garda Handwriting Text OCR

Extract handwriting or text from supported vault images and PDF pages into a clipboard or note destination.

Current version: **5.7.51**.

## First use

Enable the plugin and use its settings page. Simple is the default settings mode; Advanced exposes optional configuration. Open or select a supported attachment, then choose an extraction destination command.

Garda prepares supported images and PDF pages locally and calls OpenRouter directly. Destinations include clipboard, append, replace embed and new note; a folder batch and cancellation command are available. Its attachment cache avoids unnecessary repeated extraction.

## Account and processing

AI requests go directly to OpenRouter using the fixed request model `~openai/gpt-luna-latest`. The existing managed-key resolver supplies the connection; legacy personal-key/model preferences do not override it. Constance handles account and billing operations.

Garda meters pages successfully processed. New account usage uses a persisted event ID and atomic consumption; unknown results reconcile using the original event.

Connect the existing Constance account in settings; registration can require email verification before signing in again. Billing account passwords are sent for authentication and are not persisted. Access/refresh session data and a stable installation identity are saved locally. Account free usage and purchased balance are determined by Constance; cached values and checkout return URLs do not create entitlement. Catalog displays current formatted names, prices, availability and exact price IDs. Unknown usage and checkout results retain their original identities for recovery.

## Diagnostics

Help is available in settings and through Open documentation. Open plugin settings and Copy full debug log are command-palette fallbacks. Debug logging defaults off for a new installation; failures and full Error objects/stacks still appear in the local developer console. Timed information is enabled by the debug preference. The copyable diagnostic buffer keeps at most 1,000 summarized events and excludes raw error text, stacks, note text, paths and credentials. Full console exceptions can contain whatever the failed operation placed in its error. Logs are not uploaded automatically.

## Documentation

- [User guide](docs/USER_GUIDE.md)

License terms are in LICENSE.
