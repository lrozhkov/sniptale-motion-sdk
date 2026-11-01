# Release Readiness

This document defines local readiness checks and the authorized source-publication boundary.

`tooling/configs/qa/publication.json` authorizes GitHub source publication only to `lrozhkov/sniptale-motion-sdk`, permits checks-only GitHub Actions, keeps registry publication unauthorized, and selects GitHub private vulnerability reporting. Repository hygiene pins the matching package metadata. It rejects publication lifecycle scripts, direct publish or push commands, undeclared shell commands, and unpinned Actions. It rejects workflow permissions outside the declared CodeQL upload boundary and conflicting owner-document text.

`package.json` uses a private package identity for workspace tooling. Registry publication requires a separate maintainer decision. `npm run build:npm` prepares a local installable archive under `.tmp/npm-package`. `npm run test:npm` checks that archive in an isolated installation. These commands do not publish it.

The distribution manifest omits the workspace's `private` flag and declares public scoped-package access. The reviewed archive can therefore remain byte-identical for a later authorized publication. It does not need a manifest rewrite. Actual publication still requires a separate maintainer decision and an npm account with publishing access to the package scope.

## Candidate checks

1. Run `npm run qa:licenses` and resolve every unknown, denied, or unresolved license decision.
2. Run `npm run release:legal` and `npm run release:legal:check`. Generated legal contents must match the production dependency closure exactly.
3. Run `npm run qa:security`. Dependency release-age and registry-identity evidence, npm advisories and registry signatures, OSV lockfile findings, and Gitleaks index/worktree scans must pass without suppressions or baselines. Separate index and worktree snapshots preserve staged/worktree divergence. Skip-worktree, assume-unchanged, symlink, gitlink, sparse-directory, and unmerged index entries are rejected when they prevent complete regular-file evidence.

   The retained Gitleaks history command is inactive. Candidate proof must not depend on private, rollback, or other non-public refs. The summary records the history scan as disabled. The wrapper removes scanner, npm-scope, Git, and Node injection overrides. It pins the public npm registry and full dependency scope.

   Its checked-in config selects installed Gitleaks default rules and an explicit empty ignore path. The command requires npm-registry and OSV access plus `gitleaks` and `osv-scanner` on `PATH`, logs scanner versions, and records private evidence under `.tmp/security/` and its QA log.
4. Run `npm run ci:release`. It includes checkpoint, coverage, build, workflow lint, dependency security, duplication, CodeQL, and npm acceptance.
5. Inspect the candidate for `LICENSE`, `NOTICE`, generated third-party notices, the dependency inventory, and every required dependency license text.
6. Review the security model against the intended hosting origins and headers.
7. Complete two independent documentation reviews after all invalidating changes, then rerun affected checks.

Passing local checks proves only that the inspected candidate satisfies the repository policy. A push still requires an explicit maintainer decision and must not be inferred from a green build.

## Publication boundary

- GitHub source publication is authorized only for [lrozhkov/sniptale-motion-sdk](https://github.com/lrozhkov/sniptale-motion-sdk).
- GitHub Actions is authorized only for checks and local npm archive preparation. Linux calls `npm run ci:release` for full repository proof and isolated npm acceptance. Windows runs native `qa`, `build:npm`, and `test:npm`. The PR label `ci-local-proof-bypass` skips heavy jobs and reports that checks did not run. Push and manual runs ignore that label.

  A prepared workflow does not prove remote execution. Remote status requires an actual run after a separately authorized push.
- npm registry publication, tags, GitHub Releases, package distribution, and deployment remain unauthorized.
- Security reports use the private channel defined in [SECURITY.md](../../SECURITY.md).

`CONTRIBUTING.md` remains closed to external code contributions. Source publication does not open a patch or pull-request workflow.

The native `tooling/ci/npm.cjs` bootstrap checks the official npm archive against `tooling/configs/ci/npm.lock.json` before extraction and activates it only after successful extraction. Every CI npm command uses that pinned version. The bootstrap and its cache stay under `.tmp/ci`. CI tools and Actions are pinned in `tooling/configs/ci/toolchain.lock.json` with upstream release dates. New versions must be at least seven days old.

Younger versions require a checked vulnerability fix and an explicit policy change. `npm run ci:tools` explicitly downloads the Linux x64 tools, checks archive SHA-256 values, extracts only their executable members, and stores them under `.tmp/ci`. `npm run lint:ci` requires these tools, proves they accept valid workflows and reject known violations, and checks every repository workflow without suppressions. Zizmor runs offline without a token. Online-only audits are not claimed.

The workflow downloads controlled Chromium explicitly, disables dependency caches and persisted checkout credentials, and uploads only the archive, inventory, acceptance summary, and CodeQL SARIF. npm tokens and registry publication remain unauthorized. Only the CodeQL job can write security events.
