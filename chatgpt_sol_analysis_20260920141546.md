# Garda implementation analysis

## Reviewed code map

Reviewed `src/main.ts`, `src/billing.ts`, settings/types, OCR destination and batch workflows, `constance-account.ts`, `plugin-support.ts`, and public build inputs.

## Changes and safeguards

- OCR billing is account-linked and intended to use authenticated entitlement/spend operations with stable pending event IDs.
- Free usage is claimed server-side; missing or expired authentication blocks OCR rather than granting untracked usage.
- Automatic defaults support clipboard/current-note extraction immediately; batch cancellation and destination choices remain explicit.
- Settings place account/connection and primary OCR actions first, with custom instructions and advanced options later.

## Threat model and migration

Installation ownership is checked by the account service. Passwords are not retained; invalid 401/403/404 sessions are cleared. OCR inputs and note contents stay local to the plugin workflow and are not written to diagnostics.

## Documentation and logging

The help modal documents commands, supported inputs, defaults, billing, privacy, troubleshooting, and cancellation. Support logging covers startup/shutdown, OCR requests, batch progress/cancel, billing outcomes, and failures without secrets.

## Validation

Run `npm run typecheck`, `npm test`, `npm run build`, and `git diff --check`; then compare the shipped public surface with `publish`. No vault data or live deployment is touched.

## Remaining limitation

OCR provider and Constance service behavior require live credentials/service availability for end-to-end confirmation.
