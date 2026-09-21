# Garda Handwriting Text OCR Requirements

## Product Goal

Build an Obsidian plugin that converts handwritten pages into searchable text,
handles cursive and messy writing better than generic OCR, and avoids mandatory
per-page billing from the incumbent service.

## V1 Scope

V1 uses a SaaS OCR backend with the model configured by that backend.

## Core OCR Pipeline

- Accept JPG, PNG, GIF, BMP, TIFF, HEIC, WEBP, and PDF files.
- Support uploads up to at least 20 MB per input.
- Split multi-page PDFs into individual page images before OCR.
- Process and charge one OCR unit per page, not one unit per uploaded file.
- Downscale and compress images before sending them to control token cost and keep per-page processing predictable.
- Use the configured Garda OCR model with a fixed system prompt tuned specifically for handwriting transcription, not generic OCR.
- Return plain text with line breaks and recognizable layout preserved where the model can infer it reliably.
- Return a confidence or quality flag for every page.
- Mark pages that require manual review.

## Obsidian Plugin

- Add image and PDF embed context-menu actions in the editor.
- Add image and PDF actions in the file explorer.
- Provide these extraction actions:
  - Extract to clipboard.
  - Append to the current note.
  - Replace the embed with extracted text.
  - Extract to a new note.
- Provide command-palette entries for every extraction action.
- Support a folder batch mode for scans.
- Queue batch pages sequentially and show progress, current page, failures, and cancellation.
- Provide API-key entry in plugin settings.
- Show the live Constance credit balance in plugin settings.
- Cache OCR results by source-file identity and content hash so rerunning OCR on an unchanged file does not charge again.
- Preserve the original image or PDF.
- Make generated text searchable through Obsidian global search.

## Billing

- Reuse the existing TutivSoft Constance billing and credit system.
- Do not rebuild billing, checkout, entitlement, or credit-spend infrastructure in Garda.
- Charge one credit per processed page.
- Use the account-linked Constance integration: stable installation linking,
  bearer entitlements, authenticated catalog-plan checkout, and authenticated
  idempotent credit spend.
- Preserve a pending spend event and reuse its event ID after a timeout or
  temporary server failure; never create a replacement event for the same OCR
  operation.
- Make credit usage and remaining balance visible to the user.
- Never bundle a billing secret, API key, or private credential in the plugin.

## OCR Backend

- Provide an upload endpoint for single images and PDFs.
- Provide an asynchronous job endpoint for large PDFs and batch requests.
- Provide job-status polling so the plugin can show progress.
- Return per-page text, quality flag, failure state, and retry state.
- Delete uploaded files and derived page images after a short configurable retention window.
- Do not train models on user images, extracted text, or metadata. State this explicitly in user-facing privacy documentation.
- Keep OCR input and output isolated by user and job.
- Keep billing outside this service by calling the existing Constance integration.

## Privacy and Safety

- Do not access files outside the user's Obsidian vault through the plugin.
- Do not upload content without an explicit OCR action by the user.
- Explain that remote OCR sends the selected page to the Garda backend and its configured OCR model.
- State explicitly that user data is not used for model training.
- Delete uploaded source data after the retention window.
- Preserve the user's original files.
- Require review of low-confidence output before destructive actions.
- Do not collect unrelated telemetry.
- Use HTTPS for all remote requests.

## Model and Quality

- Benchmark cursive, print, mixed handwriting, messy notes, skewed scans, low-light images, and multi-page notebooks.
- Measure transcription accuracy and processing reliability.
- Detect empty, repetitive, truncated, or obviously garbled responses before saving them.
- Preserve paragraph breaks, headings, lists, dates, punctuation, and simple layout where the model can infer them.
- Never present low-confidence transcription as certain.
- Disclose the exact model used for remote OCR in the backend's user-facing configuration and documentation.

## Differentiators

- Keep token costs predictable through per-page preprocessing and charging.
- Make the model, privacy behavior, retention policy, and billing model transparent.

## Validation

- Test every supported file format and the 20 MB upload limit.
- Test multi-page PDF splitting and one-credit-per-page accounting.
- Test image downscaling and compression behavior.
- Test confidence flags and page quality reporting.
- Test cache hits and verify unchanged files are not recharged.
- Test clipboard, append, replace, new-note, command-palette, and batch actions.
- Test asynchronous jobs, polling, cancellation, retries, and partial failures.
- Test credit balance and Constance integration using the existing billing contract.
- Test automatic deletion after the retention window.
- Test that no user data is used for training and no unintended network requests occur.

## Release Requirements

- Include a README covering installation, usage, supported formats, limits, privacy, retention, model disclosure, billing, and limitations.
- Include a compatible license for the plugin and any distributed model/runtime components.
- Include an accurate Obsidian `manifest.json`.
- Include complete source code in the public repository if submitted to the Obsidian Community directory.
- Keep release tags synchronized with `manifest.json`.
