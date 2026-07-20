# i18n Architecture

`src/shared/i18n/config.ts` defines `ru` and `en`, with `ru` as the default and `en` as the fallback locale. Unknown locale values normalize to `ru`. `translateText` resolves the active locale, then `ru`, then `en`.

`src/shared/i18n/messages.ts` owns shared adopted UI messages. Viewer owners consume `t()` for keyed messages and `translateText()` for localized document data. `setLocale()` updates the active locale and the root HTML `lang` attribute; the viewer startup owner rerenders adopted surfaces when the locale changes.

Effect v1 validation requires non-empty `label.ru` and `label.en`. Other localized fields use the locale-text validator defined under `src/sdk/effect-v1/`; the schema and validator are the field-level authority.

## Rules and proof

- New adopted viewer UI copy uses shared messages. `tooling/qa/policy/guardrails.mjs` rejects the direct quoted assignment patterns it can identify without an exception baseline.
- Localized document fields are validated by `npm run effect:validate -- <file> --json`.
- Locale normalization, fallback, and message lookup are covered by `tests/i18n.test.ts`; DOM adoption and rerender behavior require focused viewer review.
- HTML fallback text, template literals, computed strings, and accessibility attributes require review because the current guardrail does not cover those surfaces completely. Existing feature-local status text is not an accepted exception; touched copy must move to shared messages.
