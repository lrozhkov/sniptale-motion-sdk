# i18n Architecture

`src/shared/i18n/config.ts` defines `ru` and `en`, with `ru` as the default and `en` as the fallback locale. Unknown locale values normalize to `ru`. `translateText` resolves the active locale and uses English fallback. Portable document metadata uses `resolveEffectV1LocaleText`: case-insensitive exact locale, then base language, then `en`; an empty translation falls through. The product UI remains Russian by default.

`src/shared/i18n/messages.ts` owns shared adopted UI messages. Viewer owners consume `t()` for keyed messages and `translateText()` for localized document data. `setLocale()` updates the active locale and the root HTML `lang` attribute; the viewer startup owner rerenders adopted surfaces when the locale changes.

Effect v1 localized metadata requires a non-empty `en` whenever the field is present. Russian is not required for third-party documents. Control, option and handle labels use the same rule. Language keys are bounded to 64 characters and validated as well-formed BCP47 under RFC 5646, including private-use and grandfathered tags, with no duplicate variants or extension singletons. This is syntax validation, not a snapshot of the evolving IANA registry. The runtime validator performs semantic checks beyond the schema’s structural key pattern. User-entered control values are content and are never translated. See [RFC 5646](https://www.rfc-editor.org/rfc/rfc5646.html).

## Rules and proof

- New adopted viewer UI copy uses shared messages. `tooling/qa/policy/guardrails.mjs` rejects the direct quoted assignment patterns it can identify without an exception baseline.
- Localized document fields are validated by `npm run effect:validate -- <file> --json`.
- Locale normalization, fallback, and message lookup are covered by `tests/i18n.test.ts`; DOM adoption and rerender behavior require focused viewer review.
- HTML fallback text, template literals, computed strings, and accessibility attributes require review because the current guardrail does not cover those surfaces completely. Existing feature-local status text is not an accepted exception; touched copy must move to shared messages.
