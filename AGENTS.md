# Sniptale Motion SDK Agent Contract

Code, schemas, tests, and deterministic policies are the implementation authority. Repository documentation records only contracts that are not clear from those owners.

## Ownership

- Keep runtime entrypoints thin and place product logic under the matching viewer, sandbox, SDK, shared, tooling, or test owner. Repository commands and support code belong under `tooling/`; do not create a top-level `scripts/` directory.
- Treat JSON, files, `postMessage`, generated data, and browser API results as unknown until the receiving boundary parses or validates them.
- Keep Effect v1 runtime documents declarative, dependency-free, deterministic, and compatible with the sandbox.
- Select dependency versions that were published at least seven days ago, including transitive dependencies and downloaded development tools. A younger version is permitted only to fix a verified vulnerability, with the exact package version, advisory, and temporary exception recorded and checked. Do not use package-wide or scope-wide release-age exclusions. Review dependency installation scripts before explicitly running any of them.
- Use `path owns the domain, filename owns the role` and prefer TypeScript owner modules over compatibility files.
- Do not add debt baselines, long-lived allowlists, known-failure snapshots, or generated policies that normalize current debt.
- Keep temporary files, templates, packs, media assets, generated evidence, reports, coverage, browser output, and tool caches under ignored `.tmp/` storage. Do not commit their contents or placeholder files. Keep `docs/` free of empty directories.

## Required loop

1. Run `npm run qa:preflight -- --files <files>` or perform the same owner, boundary, proof, and risk analysis.
2. Implement inside the selected owner seam.
3. Run focused tests and `npm run qa:checkpoint`.
4. Run `npm run qa:coverage` when test surfaces or owner coverage change, run `npm run qa:build` for runtime, artifact, or browser changes, and run `npm run qa:security` for dependency, publication, or security-boundary changes.
5. Review architecture, state authority, boundary payloads, i18n, security, documentation ownership, and guardrail candidates.
6. Fix findings or add a deterministic check when the rule is mechanically enforceable.
7. Run `npm run qa:closeout -- -m "message"` only when the user requests a commit closeout.

## Text files

Write authored Markdown and `NOTICE` as natural paragraphs. Do not insert manual line breaks for width, and do not use formatters that reflow prose. Preserve the verified root `LICENSE` transformation and byte-exact upstream dependency license texts; never reflow them. Keep one semantic owner, use tables only when they are compact, and remove introductions that do not add a contract or decision.

## i18n

Russian is the source and default locale; English is required. Adopted UI surfaces use shared locale maps and resolvers instead of hard-coded visible copy. See [docs/architecture/i18n-architecture.md](docs/architecture/i18n-architecture.md).

## Review triggers

Run the local review workflow for TypeScript migration, topology changes, public SDK contracts, sandbox/runtime messaging, import/export, validation, timeline editing, asset handling, i18n adoption, QA tooling, licensing, security, and documentation topology.
