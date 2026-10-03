# Garda Handwriting Text OCR

Version: 5.7.36.

## Current purchase behavior

Purchase settings load the app's current offer configuration and Paddle prices from Constance. Offer quantities use the app's native billing unit from that configuration; displayed amounts and descriptions come from the current provider price. The client matches offers by exact configured price ID and enables purchase only when Constance reports `checkout_available`. Checkout sends that exact price ID through the authenticated billing route. Prices and pack quantities are not fixed in the plugin. Existing account balances and granted credits remain associated with the account.


Garda extracts text from image and PDF attachments in Obsidian. It sends selected images directly to OpenRouter using Garda's existing managed key manifest. Constance handles billing and account operations.

## OCR processing

Images are decoded and resized locally. Bundled PDF.js renders each PDF page locally. Garda decrypts its existing OpenRouter key manifest and sends each selected page image directly to the established image-capable model. Constance verifies the billing account and installation, serves current Paddle offers, and records credit spending. Successful results are cached locally for unchanged attachments.

## Usage and privacy
Connect your billing account in Garda settings, test the connection, select an attachment and choose an extraction command. Simple is the default; Advanced contains diagnostics and less frequent options. Clipboard and new-note commands preserve the original. Replace embed requires confirmation and is blocked when results need review. Folder batches show page progress and support cancellation. Inputs are limited to 20 MB. Browser-dependent HEIC/TIFF files may need conversion to PNG or JPEG.

Only selected page images are sent to OpenRouter; review its data handling terms before processing sensitive content. Constance receives account, checkout, and credit-spend requests. No separate usage analytics are sent. Cancellation stops further pages and discards the pending response; an already-sent provider request may finish. Originals remain intact unless Replace embed is explicitly selected.


## Manual installation

Download `main.js`, `manifest.json`, and `styles.css` from the matching published release and place them in `.obsidian/plugins/garda-handwriting-text-ocr/`, then enable the plugin in Obsidian.
