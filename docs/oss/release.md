# Release Readiness

This document defines local readiness checks and the authorized source-publication boundary.

`tooling/configs/qa/publication.json` authorizes GitHub source publication only to `lrozhkov/sniptale-motion-sdk`, disables GitHub Actions, keeps registry publication unauthorized, and selects GitHub private vulnerability reporting. Repository hygiene pins the matching package metadata, rejects GitHub workflow files, publish lifecycle scripts, direct publish or push commands in package scripts, and owner-document text that conflicts with that state.

`package.json` uses a private package identity for workspace tooling. Registry publication is not planned or authorized. A release candidate is the output of `npm run build`: declarations under `dist/sdk` and static applications under `dist/apps/viewer` and `dist/apps/sandbox`.

## Candidate checks

1. Run `npm run qa:licenses` and resolve every unknown, denied, or unresolved license decision.
2. Run `npm run release:legal` and `npm run release:legal:check`; generated legal contents must match the production dependency closure exactly.
3. Run `npm run qa:security`; npm advisories and registry signatures, OSV lockfile findings, and Gitleaks index/worktree scans must pass without suppressions or baselines. Separate index and worktree snapshots preserve staged/worktree divergence; skip-worktree, assume-unchanged, symlink, gitlink, sparse-directory, and unmerged index entries are rejected when they prevent complete regular-file evidence. The retained Gitleaks history command is inactive because candidate proof must not depend on private, rollback, or other non-public refs, and the summary records the history scan as disabled rather than passed. The wrapper removes scanner, npm-scope, Git, and Node injection overrides, pins the public npm registry and full dependency scope, and supplies a checked-in config that selects the installed Gitleaks default rules plus an explicit empty ignore path. The command requires npm-registry and OSV access plus `gitleaks` and `osv-scanner` on `PATH`, logs scanner versions, and records private evidence under `.tmp/security/` and its QA log.
4. Run `npm run qa:checkpoint` and `npm run qa:build`.
5. Inspect the candidate for `LICENSE`, `NOTICE`, generated third-party notices, the dependency inventory, and every required dependency license text.
6. Review the security model against the intended hosting origins and headers.
7. Complete two independent documentation reviews after all invalidating changes, then rerun affected checks.

Passing local checks proves only that the inspected candidate satisfies the repository policy. A push still requires an explicit maintainer decision and must not be inferred from a green build.

## Publication boundary

- GitHub source publication is authorized only for [lrozhkov/sniptale-motion-sdk](https://github.com/lrozhkov/sniptale-motion-sdk).
- GitHub Actions is disabled and workflow files are forbidden. Candidate, security, browser, coverage, and release checks run locally before a push.
- npm registry publication, tags, GitHub Releases, package distribution, and deployment remain unauthorized.
- Security reports use the private channel defined in [SECURITY.md](../../SECURITY.md).

`CONTRIBUTING.md` remains closed to external code contributions. Source publication does not open a patch or pull-request workflow.
