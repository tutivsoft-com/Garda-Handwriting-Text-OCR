# Garda Handwriting Text OCR Requirements

## Current product scope

Garda is an Obsidian plugin plus a separately deployed FastAPI service. A user selects an image or PDF and chooses where to put the transcription. The source repository includes the backend; the public plugin repository contains the complete reviewable TypeScript source and bundle, but not the backend implementation.

## Implemented plugin behavior

- Accept JPG/JPEG, PNG, GIF, BMP, TIFF/TIF, HEIC, WEBP, and PDF attachments up to 20 MB.
- Offer clipboard copy, append-to-current-note, replace-embed, and create-transcription-note actions from Obsidian commands and file/editor menus.
- Offer sequential folder batches with progress, per-file error handling, and cancellation.
- Poll asynchronous backend jobs and show the current processing state.
- Cache completed results locally using the source path and a lightweight content signature, so unchanged files can be reused.
- Mark pages with quality and manual-review indicators. Low-quality output cannot be used for embed replacement.
- Preserve originals by default. Replace-embed changes the selected Markdown embed only after successful review checks.
- Avoid overwriting a transcription note by choosing a numbered destination when one already exists.

## Implemented service and billing behavior

- Require a Garda bearer API key for OCR job requests and status polling.
- Accept a single image or PDF through the OCR jobs endpoint; return per-page text, quality, review, failure, and progress state.
- Split PDFs into pages, normalize images, resize to at most 2400 by 2400 pixels, and submit page images to OpenRouter Chat Completions.
- The current backend source selects the model named ~deepseek/deepseek-v4-flash-latest and asks for faithful transcription rather than correction or summarization.
- Charge one Constance OCR credit for each successfully processed page. Account linking, checkout, balance, and idempotent credit spends belong to Constance.
- Keep backend job data in memory. Completed or stopped jobs are removed after the configured retention period, which defaults to 900 seconds. A backend restart can interrupt a job.

## Privacy and data handling

- OCR runs only after a user action. The selected vault file is sent to the configured Garda backend over HTTPS; that backend sends page images to its configured OCR provider.
- The plugin does not collect separate usage analytics. Billing and OCR requests go to their respective services.
- Garda does not train a model on submitted content. The external OCR provider has separate data handling terms; review those terms before processing sensitive notes.
- The service keeps active job inputs and results in process memory until the retention cleanup runs. The plugin's local cache is stored in its Obsidian settings data.
- The plugin can modify a Markdown embed only when the user explicitly chooses Replace embed. Other destinations write to the clipboard or create/append Markdown text.

## Operational requirements and limits

- Use HTTPS for a remote backend URL. HTTP is accepted only for localhost addresses during local development.
- Configure a reachable backend URL and API key, verify the connection, and sign in to Constance before starting paid OCR.
- Review transcriptions, especially pages marked medium or low quality. Quality labels are heuristic warnings, not calibrated confidence scores.
- OCR quality varies by handwriting, scan quality, layout, and model output. Garda does not promise perfect transcription or a service availability target.
- The backend uses in-memory jobs rather than a durable queue. A process restart can interrupt in-flight work.
- Release validation includes the TypeScript build, the existing test command, JavaScript syntax check, version parity, and a public source-inclusive snapshot. These checks do not replace a fresh-vault OCR smoke test.
