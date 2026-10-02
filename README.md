## Current purchase behavior

Purchase settings load the app's current offer configuration and Paddle prices from Constance. Offer quantities use the app's native billing unit from that configuration; displayed amounts and descriptions come from the current provider price. The client matches offers by exact configured price ID and enables purchase only when Constance reports `checkout_available`. Checkout sends that exact price ID through the authenticated billing route. Prices and pack quantities are not fixed in the plugin. Existing account balances and granted credits remain associated with the account.

# Garda Handwriting Text OCR

Garda extracts text from image and PDF attachments in Obsidian. It sends selected images directly to OpenRouter using Garda's existing managed key manifest. Constance handles billing and account operations.

## OCR processing

Images are decoded and resized locally. Bundled PDF.js renders each PDF page locally. Garda decrypts its existing OpenRouter key manifest and sends each selected page image directly to the established image-capable model. Constance verifies the billing account and installation, serves current Paddle offers, and records credit spending. Successful results are cached locally for unchanged attachments.

## Usage and privacy
Connect your billing account in Garda settings, test the connection, select an attachment and choose an extraction command. Simple is the default; Advanced contains diagnostics and less frequent options. Clipboard and new-note commands preserve the original. Replace embed requires confirmation and is blocked when results need review. Folder batches show page progress and support cancellation. Inputs are limited to 20 MB. Browser-dependent HEIC/TIFF files may need conversion to PNG or JPEG.

Only selected page images are sent to OpenRouter; review its data handling terms before processing sensitive content. Constance receives account, checkout, and credit-spend requests. No separate usage analytics are sent. Cancellation stops further pages and discards the pending response; an already-sent provider request may finish. Originals remain intact unless Replace embed is explicitly selected.

## Build and publication
Run `npm install`, `npm run build`, and `npm test`. PDF rendering is bundled in `publish/main.js`, without a remote worker download. Install `main.js`, `manifest.json`, and `styles.css` into the Obsidian plugin directory. See [User guide](docs/USER_GUIDE.md) and the private release procedure in `docs/OBSIDIAN_RELEASE_RUNBOOK.md`. Curate only the explicit public allow-list; do not publish private history, tests, credentials, logs or internal documentation.

Garda is MIT licensed. Bundled PDF.js retains its Apache-2.0 notice.



<!-- RA1-CODEBASE-SNAPSHOT:START -->
## Local Codebase Snapshot

Updated: `2026-10-02`

Source scanned from: `C:\Users\Rahul\Desktop\ghrepos\Garda-Handwriting-Text-OCR`
Category: `Local repositories`
Current branch: `main`

### Detected Stack

- `TypeScript` (20)
- `JavaScript` (11)
- `CSS` (2)

### Source Map

- Code files scanned: `33`
- Markdown/docs files scanned: `36`
- Manifest/deploy files scanned: `2`
- Main source areas: `publish/` (25), `/` (22), `src/` (10), `tests/` (9), `docs/` (5)

### Main Entry Points

- `publish\main.js`
- `publish\src\main.ts`
- `src\main.ts`

### Manifests And Deploy Files

- `package.json`
- `tsconfig.json`

### Documentation Files

- `AGENTS.md`
- `ai_model.md`
- `ai_model_change_20260910224059.md`
- `architecture.md`
- `BILLING_REVIEW_2026-09-30.md`
- `CHANGELOG.md`
- `chatgpt_sol_analysis_20260920141546.md`
- `CONTRIBUTORS.md`
- `docs\END_TO_END_OBSIDIAN_RELEASE_WORKFLOW.md`
- `docs\OBSIDIAN_RELEASE_RUNBOOK.md`
- `docs\release-evidence\obsidian-community-5.7.26.md`
- `docs\RELEASE_STATUS_2026-09-12.md`
- `docs\USER_GUIDE.md`
- `FEATURES.md`
- `HISTORY.md`
- `LOC Lines of Code.md`
- `luna_20260921113627.md`
- `MARKETING.md`
- ... 18 more

### Detected Routes Or App Handlers

- No framework route declarations detected by the scanner.

### Detected Package Commands

- `npm run build`
- `npm run dev`
- `npm run test`
- `npm run typecheck`

### Maintenance Rule

When source files, routes, user flows, manifests, Docker/compose settings, or deployment behavior change, refresh this managed block with:

```bash
python "C:/Users/Rahul/Desktop/ghrepos/RA1/MAIN/40 Common/Scripts/refresh_local_repo_docs.py" --repo "Garda-Handwriting-Text-OCR"
```
<!-- RA1-CODEBASE-SNAPSHOT:END -->
