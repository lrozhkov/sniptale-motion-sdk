# Code Quality

`tooling/qa/` owns repository QA policy and wrappers. `tooling/build/`, `tooling/effect-v1/`, `tooling/http/`, `tooling/release/`, `tooling/test/`, and `tooling/vite/` own command entrypoints and their support code. Every QA wrapper writes a unique private log under `.tmp/qa-logs/<date>/`, records commands, timing, exit status, and final status, and redacts values from secret-like environment keys in the persisted copy.

Oxfmt is the canonical formatter. `.oxfmtrc.json` owns formatting options; `.oxfmtignore` excludes temporary/build storage, Markdown and legal text. `npm run format` checks the repository; `npm run format:write` applies formatting. The schema generator uses the same configuration. Editor integration uses the installed Oxfmt language server; the optional Oxc extension is recommended in `.vscode/extensions.json`. Formatting does not reorder imports or package metadata, rewrite embedded source, or format prose and dependency licenses.

## Deterministic rules

- Source formatting, types, unit behavior, and repository guardrails pass — checkpoint wrapper and policy; `npm run qa:checkpoint`.
- Product source stays TypeScript; entrypoints stay thin; owner modules stay bounded; relative source imports stay acyclic — guardrail policy and tests; `npm run qa:checkpoint`.
- Bare package specifiers in TypeScript ESM static, dynamic, and type imports under `src/` belong to root production dependencies or required peers; relative imports and `package.json#imports` targets remain under `src/`; non-literal dynamic imports, CommonJS `require`, `node:module`, `import.meta.resolve`, symlinks, and special entries under `src/` are rejected — runtime-dependency policy and tests; `npm run qa:checkpoint`.
- All repository command tooling, harnesses, wrappers, and command-specific configuration stay under `tooling/`; the top-level `scripts/` directory and unowned root entries are forbidden; application HTML stays under its `src/apps/` owner; architecture debt is not hidden by baseline or allowlist files — repository-hygiene and guardrail policy tests; `npm run qa:checkpoint`.
- Active Markdown stays under its assigned root or `docs/`, every `docs/` owner is linked from the sole index, `docs/` has no empty directories, local links resolve, prose is not hard-wrapped, and tables have at most four columns — repository-hygiene policy; `npm run qa:checkpoint`.
- `.tmp/` is the only local-input and temporary-output root; `dist/` and `node_modules/` retain their explicit build and installation roles; these root-anchored storage directories are ignored and contain no indexed files, while temporary filename shapes outside `.tmp/` are rejected — repository-hygiene policy reads both ignore rules and the raw Git index; `npm run qa:checkpoint`.
- Repository identity remains `Sniptale Motion SDK`, first-party metadata remains MIT and private, and external code contributions and pull requests remain closed — repository-hygiene policy; `npm run qa:checkpoint`.
- Retired product roots and Effect contract identities are rejected from current repository paths and UTF-8 content without an allowlist, and the same identity boundary is rechecked across every release path and file — repository-hygiene and release artifact policies; `npm run qa:checkpoint` and `npm run build`.
- Viewer, sandbox, static, and smoke servers bind to loopback by default — development/static server tests; `npm run qa:checkpoint`.
- Sandbox source excludes the enumerated direct network, storage, extension, and eval-like APIs — guardrail policy; `npm run qa:checkpoint`.
- Adopted viewer TypeScript owners do not assign direct quoted visible UI literals in the patterns covered by the source scanner — guardrail policy and tests; `npm run qa:checkpoint`.
- Effect schema generation is stable — schema generator; `npm run effect:schema:check`.
- The Effect v1 corpus generator writes exactly 14 deterministic DEFLATE archives plus the schema copy, expectations, contract lock, and SHA-256 closure under ignored `.tmp/sniptale-effect-corpus`; ZIP timestamps, Unix modes, entry order, compression level, corpus version, and injected test commit are locked by two-run verification, while final generation requires a clean HEAD and records that exact commit — corpus generator and verifier; `npm run effect:corpus:check` and `npm run effect:corpus`.
- Every executable TypeScript owner under `src/` enters the global coverage measurement; declaration files are the only source exclusion — Vitest configuration and guardrail test; `npm run qa:coverage`.
- Unit, coverage, local build, and browser smoke pass as one logged run — build wrapper; `npm run qa:build`.
- Release output contains both app entrypoints, the SDK declaration manifest and entry declaration, and the exact allowed app, declaration, and legal-file layout; every file is NUL-free UTF-8, JavaScript and CSS parse without warnings, declarations pass grammar and import checks and are bound to current owner, declaration, and exact source-map bytes by SHA-256, JSON and source-map structure parse, app asset names match the configured eight-character hash shape, and every app asset follows a resolved local HTML, JavaScript, or CSS reference from its app entry; symlinks and enumerated local-only markers are rejected — release artifact boundary; `npm run build`.
- Dependencies use exact registry tarball identities and SHA-512 integrity, installation lifecycle scripts remain disabled, and release-age bypass settings are rejected — dependency admission policy; `npm run qa:checkpoint`. Fresh registry evidence must prove at least seven full days since publication, or an exact temporary security-fix record backed by its non-withdrawn advisory; `npm run qa:dependencies` and `npm run qa:security`.
- Full lockfile licensing is accepted and evidence is written locally — license audit; `npm run qa:licenses`.
- Production legal closure is reproducible from installed dependency evidence — legal generator and offline validator; `npm run release:legal && npm run release:legal:check`.
- Publication security evidence has no accepted findings or suppressions: npm advisory and registry-signature checks, OSV lockfile analysis, and Gitleaks index/worktree scans pass — logged security wrapper; `npm run qa:security`. The retained Gitleaks history command is inactive so candidate proof does not depend on private or rollback refs; the security summary records that scan as disabled instead of passed.

`qa:closeout` reruns checkpoint and build before an optional commit. Use it only when a commit closeout is requested. QA logs, reports, coverage, browser output, tool caches, and local packs remain under ignored `.tmp` storage.

## Review-only rules — explicit attention required

The following rules do not have complete deterministic enforcement. Review them directly and record findings instead of treating a passing command as proof.

- The selected owner is the semantic owner, not a mechanical file split.
- Mutable state has one authority and asynchronous recovery preserves it.
- All meaningful boundary payload fields are parsed, bounded, and rejected safely; regex guards cover only known API patterns.
- UI behavior, accessibility, visual quality, HTML copy, template-literal copy, and translations are correct in context.
- Sandbox code does not reach a browser capability outside the explicitly scanned API set.
- CSS and HTML dependency references and build transforms do not introduce runtime packages outside the production legal closure.
- Coverage adequacy is reviewed from the full-source report; no numeric pass threshold is set because a floor derived from current debt would normalize that debt.
- Security trade-offs remain valid for the deployment topology.
- Documentation is current, concise, and has one owner for each meaning.

Review findings should become deterministic checks only when the rule is mechanically detectable without a debt baseline, exception snapshot, or long-lived allowlist.
