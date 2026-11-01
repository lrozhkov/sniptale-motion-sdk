# Linter Edge Cases

The snippets below intentionally violate or exercise writing rules. Their fenced contents are test data. Use `scripts/ste-lint.py --selftest` for executable checker tests.

## Incomplete list items

These items have a missing continuation:

```text
- Set the target and
- Record the result or
```

## Fenced code

A writing checker must not interpret this source-code sample as prose:

```javascript
const result = first();
second(result);
```

## Preserved modality

This text must retain uncertainty:

```text
The request may have failed.
```

## Contextual vocabulary

Technical actions can have distinct meanings even when a general-language heuristic groups their names. Inspect the actual operation before changing terminology. A rule-level exception is not a substitute for that inspection.
