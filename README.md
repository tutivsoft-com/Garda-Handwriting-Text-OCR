# Garda Handwriting Text OCR

Garda Handwriting Text OCR is an Obsidian plugin for turning handwritten notes into searchable text inside Obsidian. V1 uses a Garda SaaS OCR backend and the existing TutivSoft Constance credit system.

Version: `5.7.11` · [Complete user guide](./docs/USER_GUIDE.md)

## Why This Plugin

Handwriting-to-text OCR inside Obsidian has persistent, documented demand and no adequate free solution for real handwriting.

- People have requested searchable handwriting OCR since at least 2021. A forum thread titled ["Searchable OCR - Let's get it built!"](https://forum.obsidian.md/) asked for automatic background OCR integrated with Obsidian's global search.
- Obsidian still has no native handwriting support. Users continue to assemble manual workflows, and the same request appears repeatedly in Obsidian forums and r/ObsidianMD.
- Generic OCR plugins, including Tesseract-based tools such as OCR Extractor, are useful for typed text but are weak on cursive, messy, and genuinely handwritten pages.
- A July 2026 writeup still describes the gap: good handwriting recognition remains an external, paid service rather than a native Obsidian capability.

## Opportunity

Garda uses a metered SaaS OCR backend for V1. The plugin may be free to install, but scans consume Garda OCR page credits through the existing TutivSoft Constance billing service.

Current Garda credit packs:

- $1 for 20 pages.
- $5 for 160 pages.
- $15 for 640 pages.

One page consumes one OCR credit. Unchanged files are served from the local content-hash cache and do not consume another credit.

## Product Direction

Garda provides handwriting OCR inside Obsidian through a remote V1 backend. The selected page is sent to the Garda backend and its configured OCR model only after an explicit user action.

The intended value proposition is:

- Convert handwritten images or scanned pages into searchable Markdown text.
- Preserve the source image alongside the extracted text.
- Preserve the original source file while adding searchable Markdown output.
- Avoid the incumbent service's pricing and workflow while keeping Garda's V1 page-credit pricing transparent.
- Integrate extracted text with Obsidian's vault and global search.
- Handle cursive, messy handwriting, page layouts, and multiple pages better than generic OCR.

## Status

V1 implementation is complete and pushed to the repository. The plugin bundle and FastAPI backend are included in source control. Garda’s live Constance catalog entry is active, and the three live Paddle credit packs are provisioned.

## Installation

Build the plugin, then copy `publish/main.js`, `manifest.json`, and `styles.css` into the Obsidian plugin directory. The backend is deployed separately as a FastAPI service from `backend/app.py`.

```text
npm install
npm run build
```

## Usage

Garda adds image and PDF actions to supported editor and file-explorer menus, plus command-palette entries for clipboard extraction, appending, embed replacement, new-note extraction, and folder batches. The original image or PDF remains in the vault. Generated Markdown is indexed by Obsidian search.

Supported inputs are JPG, PNG, GIF, BMP, TIFF, HEIC, WEBP, and PDF. Inputs are limited to 20 MB. PDFs are processed one page at a time. Unchanged files are served from a content-hash cache and do not consume another OCR credit.

## Privacy

OCR is explicit and user initiated. The selected vault file is sent over HTTPS to the configured Garda backend and then to its configured OCR model. Garda does not train models on user images, extracted text, or metadata, and does not collect unrelated telemetry. Uploaded source data and derived page images are removed after the configured retention window. The original vault file is preserved.

Low-quality pages are marked for manual review and cannot be used for destructive embed replacement without review.

## Billing And Model

Garda uses the existing TutivSoft Constance browser-relay credit system. One OCR credit is consumed for each successfully processed page. The OCR model is selected by the Garda backend. Checkout and balance display are provided through Constance; Garda does not contain billing secrets or checkout infrastructure.

## Limitations

Remote OCR requires a configured Garda backend and API key. Recognition quality varies with handwriting, image quality, page layout, and legibility. Low-confidence output should be reviewed before it is treated as authoritative.

## License

Garda is distributed under the MIT license. The backend uses its runtime dependencies' respective licenses.
