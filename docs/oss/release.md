# Release Readiness

This document defines local readiness checks and the authorized source-publication boundary.

`tooling/configs/qa/publication.json` authorizes GitHub source publication only to `lrozhkov/sniptale-motion-sdk`, permits checks-only GitHub Actions, keeps registry publication unauthorized, and selects GitHub private vulnerability reporting. Repository hygiene pins the matching package metadata and rejects publication lifecycle scripts, direct publish or push commands, workflow write permissions, undeclared shell commands, unpinned Actions, and owner-document text that conflicts with that state.

`package.json` uses a private package identity for workspace tooling. Registry publication requires a separate maintainer decision. `npm run build:npm` prepares a local installable archive under `.tmp/npm-package`; `npm run test:npm` verifies that archive in an isolated installation. These commands do not publish it.

The distribution manifest omits the workspace's `private` flag and declares public scoped-package access. The reviewed archive can therefore remain byte-identical for a later authorized publication; it does not need a manifest rewrite. Actual publication still requires a separate maintainer decision and an npm account with publishing access to the package scope.

## Candidate checks

1. Run `npm run qa:licenses` and resolve every unknown, denied, or unresolved license decision.
2. Run `npm run release:legal` and `npm run release:legal:check`; generated legal contents must match the production dependency closure exactly.
3. Run `npm run qa:security`; dependency release-age and registry-identity evidence, npm advisories and registry signatures, OSV lockfile findings, and Gitleaks index/worktree scans must pass without suppressions or baselines. Separate index and worktree snapshots preserve staged/worktree divergence; skip-worktree, assume-unchanged, symlink, gitlink, sparse-directory, and unmerged index entries are rejected when they prevent complete regular-file evidence. The retained Gitleaks history command is inactive because candidate proof must not depend on private, rollback, or other non-public refs, and the summary records the history scan as disabled rather than passed. The wrapper removes scanner, npm-scope, Git, and Node injection overrides, pins the public npm registry and full dependency scope, and supplies a checked-in config that selects the installed Gitleaks default rules plus an explicit empty ignore path. The command requires npm-registry and OSV access plus `gitleaks` and `osv-scanner` on `PATH`, logs scanner versions, and records private evidence under `.tmp/security/` and its QA log.
4. Run `npm run qa:checkpoint` and `npm run qa:build`.
5. Inspect the candidate for `LICENSE`, `NOTICE`, generated third-party notices, the dependency inventory, and every required dependency license text.
6. Review the security model against the intended hosting origins and headers.
7. Complete two independent documentation reviews after all invalidating changes, then rerun affected checks.

Passing local checks proves only that the inspected candidate satisfies the repository policy. A push still requires an explicit maintainer decision and must not be inferred from a green build.

## Publication boundary

- GitHub source publication is authorized only for [lrozhkov/sniptale-motion-sdk](https://github.com/lrozhkov/sniptale-motion-sdk).
- GitHub Actions is authorized only for checks and local npm archive preparation. The Linux and Windows matrix uses the same `npm run qa`, `npm run build:npm`, and `npm run test:npm` owners as local verification. Linux also runs workflow lint and supply-chain checks. A prepared workflow does not prove remote execution; remote status requires an actual run after a separately authorized push.
- npm registry publication, tags, GitHub Releases, package distribution, and deployment remain unauthorized.
- Security reports use the private channel defined in [SECURITY.md](../../SECURITY.md).

`CONTRIBUTING.md` remains closed to external code contributions. Source publication does not open a patch or pull-request workflow.

The native `tooling/ci/npm.cjs` bootstrap verifies the official npm archive against `tooling/configs/ci/npm.lock.json` before extraction and activates it only after successful extraction. Every CI npm command uses that pinned version; the bootstrap and its cache stay under `.tmp/ci`. CI tools and Actions are pinned in `tooling/configs/ci/toolchain.lock.json` with upstream release dates. New versions must be at least seven days old; younger versions require a verified vulnerability fix and an explicit policy change. `npm run ci:tools` explicitly downloads the Linux x64 tools, verifies archive SHA-256 values, extracts only their executable members, and stores them under `.tmp/ci`. `npm run lint:ci` requires these tools, proves they accept valid workflows and reject known violations, and checks every repository workflow without suppressions. Zizmor runs offline without a token; online-only audits are not claimed. The workflow downloads controlled Chromium explicitly, disables dependency caches and persisted checkout credentials, and uploads only the archive, inventory and acceptance summary. npm tokens and write permissions are not authorized.
