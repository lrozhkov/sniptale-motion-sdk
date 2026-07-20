# Code Review

Use this workflow for analysis-only review of Sniptale Motion SDK changes.

## Review

1. Read the diff and identify the product owner, state authority, trust boundaries, public contracts, and proof surface.
2. Report behavioral regressions, boundary values accepted without parsing, stale asynchronous results, ownership drift, oversized entrypoints, i18n regressions, security changes, and missing tests.
3. Check whether a repeated failure class can be rejected by a deterministic guard without introducing a debt baseline or allowlist.
4. Check documentation only when the change alters a repository-level contract; implementation detail belongs in code and tests.

## Output

List findings first, ordered by severity, with exact file and line references. Then list residual risks, guardrail candidates, and the verdict. Do not edit files during an analysis-only review.
