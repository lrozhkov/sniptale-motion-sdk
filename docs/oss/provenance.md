# Provenance

## First-party license

The MIT text must first be acquired verbatim from the [Open Source Initiative MIT page](https://opensource.org/license/mit) into `.tmp`. The verified bytes are pinned under the legal tooling source owner, and the policy records the source URL, source path, source SHA-256, expected repository-file SHA-256, title, source placeholder, and final copyright. The repository copy adds the `MIT License` title and substitutes the placeholder with `Copyright (c) 2026 Lev Rozhkov`; the license paragraphs are not reformatted or reflowed. The audit reconstructs `LICENSE` from that transformation and rejects independently pinned but non-derived output.

The maintainer confirmed authority to license all first-party code under MIT, including applicable employer or work-for-hire rights, and authority to use the `Sniptale Motion SDK` name on 2026-07-18.

First-party provenance cannot be established by renaming a compatibility layer. Product source must not retain executable facades modeled on external authoring runtimes; the sandbox accepts validated Effect v1 documents and interprets the repository-owned declarative graph. A future implementation derived from third-party source requires an explicit source record, compatible redistribution terms, preserved notices, and deterministic release-boundary coverage before it enters the tracked tree.

`LICENSE` owns first-party terms. `NOTICE` owns first-party attribution and points to generated third-party notices; it does not restate license terms.

## Dependencies

`npm run qa:licenses` audits the complete lockfile and writes its inventory, status, findings, and logs under `.tmp/licenses`. Reviewed decisions remain owned by `tooling/configs/qa/licenses.json`. The audit fails on unknown or denied license expressions and does not use a baseline to suppress existing findings.

`npm run release:legal` derives the production dependency closure and generates the third-party inventory, notices, and dependency license texts from installed package evidence. `npm run release:legal:check` validates that closure offline and rejects manual edits, missing evidence, unexpected packages, and digest drift.

Evidence selection is deterministic: a package with a configured pinned source uses that checked-in upstream text and verifies its exact package identity, package source, origin URL, and digest; other packages use an installed `LICENSE`, `LICENCE`, or `COPYING` variant. An unsupported expression requires an explicit current package decision; suppressions, debt baselines, and open-ended allowlists are not accepted.

The full-lock audit and production closure are separate proofs. The production closure follows root `dependencies` and required peers; correspondence between product imports and that closure is owned by the [code-quality deterministic rules](../tooling/code-quality.md#deterministic-rules). Development dependencies are audited but excluded from the redistributed legal payload. Non-TypeScript build provenance remains outside this deterministic proof and is owned by the [code-quality review-only rules](../tooling/code-quality.md#review-only-rules--explicit-attention-required).

The exact reviewed versions and dispositions are owned by `tooling/configs/qa/licenses.json`. The production MPL-2.0 dependency uses its exact package tarball as corresponding source; development-only license decisions do not authorize redistribution. Version, scope, or expression drift fails every reviewed decision; corresponding-source drift fails when that evidence is required. Pinned license sources also fail on package tarball identity, integrity, or license-byte drift.

Dependency selection requires seven complete days since registry publication, including transitive dependencies. `.npmrc` applies the selection window, disables installation lifecycle scripts, and saves exact direct versions. `tooling/qa/security/dependency-admission.ts` checks lock identities, registry tarball URLs, SHA-512 integrity, and installation configuration offline. `npm run qa:dependencies`, also run by `qa:security`, checks publication dates and exact identities against fresh registry evidence. Missing evidence fails the check. A younger security fix requires a temporary exact record in `tooling/configs/qa/security-fixes.json`; its non-withdrawn advisory must identify that exact patched npm version. The exception expires no later than the end of the seven-day window and must then be removed. Package-wide exclusions and future-date cutoffs are rejected. These checks do not execute installation scripts; any necessary script execution is an explicit reviewed setup operation.

## Templates and assets

Templates, packs, media assets, visual references, and generated proof are local inputs. Their only repository storage root is `.tmp/`, which is root-anchored in `.gitignore`; the tracked tree and release artifacts must contain none of their contents. Test scenarios generate neutral inputs under that storage root.

Adding a first-party or third-party asset to a future release requires an explicit policy change, original-source provenance, redistribution terms, an exact byte digest, and release-boundary coverage. Release assets must be generated or copied into the artifact from an approved local or external source; template and asset storage contents never enter Git.
