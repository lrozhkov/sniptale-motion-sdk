# Code Quality

`tooling/qa/` owns QA policy and wrappers. Domain commands remain under their matching `tooling/` owner. Every wrapper writes a private log under `.tmp/qa-logs/`. Logs record commands, timing, exit status, and final status. The persisted copy redacts values from secret-like environment keys.

## Commands

| Command | Scope | Result |
| --- | --- | --- |
| `qa:preflight -- --files <files>` | Planned paths | Owner and proof routing |
| `qa:checkpoint` | Complete candidate | Formatting, strict types, type-aware lint, licenses, legal closure, tests, guardrails |
| `qa:coverage` | All executable product TypeScript | Full-source coverage report |
| `qa:build` | Local and release artifacts | Local build, Chromium smoke, release build |
| `qa:security` | Complete dependency lock and candidate files | Release age, identities, advisories, signatures, OSV, secrets |
| `qa:duplicates` | Product and non-test tooling code | Zero accepted substantial clones |
| `qa:codeql` | Product and non-test tooling TypeScript | No unreviewed findings in the declared source owners |
| `lint:ci` | All workflows | Repository policy, actionlint, and offline zizmor |
| `ci:proof` | Whole repository | All proof lanes above |
| `ci:release` | Whole repository and local npm archive | Full proof plus isolated installation acceptance |
| `qa:closeout -- -m "message"` | Complete current diff | Required proof, staging, and one commit |

Run commands through npm scripts. The native preload places loader caches and temporary storage under `.tmp/` before TypeScript starts.

The full local CI toolchain requires Linux x64. Windows users can run it through WSL. Native product QA and npm acceptance remain separate Windows checks. macOS has no checked run. Nine native Windows fixture tests require filesystem symlink privileges. The accepted local limitation remains recorded until those fixtures can run with suitable privileges.

Install dependencies with `npm ci --ignore-scripts`. Install controlled Chromium with `node node_modules/playwright-core/cli.js install chromium`. Linux needs the browser's system libraries. Local CI downloads checksum-pinned audit tools, the CodeQL bundle, and controlled Chromium into `.tmp/`. Cached archives require the pinned digest before reuse.

Full npm browser acceptance remains enabled. Registry, OSV, and upstream download access are required. Missing tools, network evidence, or reports fail the relevant lane.

## Proof and closeout

Checkpoint accepts no path filter. It records successful proof only after its log closes and candidate inputs remain unchanged. The receipt binds HEAD, the semantic index, tracked and untracked candidate bytes, file modes, runtime identity, selected environment, and installed tool metadata. It also binds the completed log digest. Ignored `.tmp/` evidence does not change candidate identity.

Closeout requires `-m` and checks the full current diff. It reuses successful checkpoint and coverage receipts only for those exact inputs. Missing, malformed, failed, or stale evidence requires the affected lane again. These receipts prevent accidental stale-proof reuse. They do not authenticate evidence against a malicious local user.

Closeout requires full repository proof for production, executable tooling, harnesses, configuration, artifacts, security paths, and unknown paths. A successful exact-input `ci:proof` or `ci:release` run satisfies that requirement.

Ordinary documentation requires checkpoint. Unit test or spec changes under `tests/` and `tooling/` require checkpoint and coverage. Smoke tests and `tooling/test/` remain on the full route. Packaged authoring instructions also remain on the full route. Mixed candidates use the strongest required route. Coverage records success only after report validation, log completion, and an unchanged candidate. It checks for candidate drift before staging and before committing. A failed command stops the sequence.

A debt record cannot authorize failure. Closeout does not push, publish, amend, or change GitHub settings.

`ci:proof` always runs complete checks without GitHub Actions. `ci:release` then builds the npm archive and checks it in an isolated installation. Neither command stages or commits. Keep the candidate fixed throughout the run.

## Deterministic rules

Oxfmt owns source formatting. `.oxfmtrc.json` defines options. `.oxfmtignore` excludes Markdown, legal bytes, temporary files, and build output. Formatting does not reflow prose or upstream license texts. Use `format:write` only outside a live QA run.

`qa:docs` checks authored Markdown with the vendored ASD linter. Structural errors block checkpoint. Advisory findings require contextual review. Every hard finding blocks unless an exact proven false positive matches the review registry. All repository skill prose enters the same gate. Fenced negative examples remain test data.

Strict TypeScript covers product, tooling, and tests through explicit configurations. Product rules include exact optional properties, checked indexed access, unused-code checks, unsafe-operation checks, and Promise checks. Type-aware oxlint runs with warnings and unused disable directives as errors.

Repository guardrails enforce TypeScript product owners, thin entrypoints, bounded modules, acyclic relative imports, and production dependency ownership. They reject unowned root entries, tracked temporary content, stale identities, debt policies, broken documentation links, and invalid documentation topology. Markdown uses natural paragraphs and tables with at most four columns.

The runtime dependency policy rejects undeclared package imports, escaping relative imports, non-literal dynamic imports, CommonJS loading, and symlinks under product source. Release artifact checks independently inspect output layout, syntax, declarations, maps, reference closure, and local-only markers.

Effect schema generation must remain stable. The compatibility corpus contains 14 deterministic DEFLATE archives and their schema, expectations, contract lock, and SHA-256 closure. `effect:corpus:check` compares two generations. Final `effect:corpus` generation requires a clean HEAD and records that commit.

Every executable TypeScript owner under `src/` enters coverage. Declaration files are the only source exclusion. Review adequacy against the changed behavior. No debt-derived numeric floor substitutes for that review.

Jscpd scans TypeScript, TSX, JavaScript, and CSS under `src/` and `tooling/`. Test and spec files have a separate behavior-proof role. The detector requires at least 100 tokens and eight lines per substantial clone. Its duplication threshold is zero. Reports stay under `.tmp/jscpd/`. No baseline, inline ignore pattern, or accepted current percentage applies.

CodeQL scans product and tooling code with the bundled JavaScript security-and-quality suite. Tests have their own test lane. The CLI bundle has an exact version, publication date, URL, and SHA-256. SARIF must contain completed analysis runs and no findings. Reports stay under `.tmp/codeql/`.

The raw SARIF retains all results, including bundled third-party models. The uploaded SARIF follows the declared `src/` and `tooling/` input owners. Every unreviewed finding in those owners blocks the lane. Exact proven false positives require the review registry. Raw and scoped reports retain those findings with their decision evidence. No debt baseline or broad suppression applies.

Dependency admission checks exact registry tarballs, SHA-512 integrity, disabled lifecycle scripts, and release-age configuration. Security proof checks fresh registry identity and publication evidence. A younger security fix requires an exact expiring advisory record. Full-lock license auditing and production legal closure remain separate checks.

Security proof runs npm advisories, registry signatures, OSV lockfile analysis, and Gitleaks index/worktree scans. The retained whole-history scan remains inactive. Its summary reports `disabled`, not `passed`. Candidate proof does not depend on private or rollback refs.

## CI

Linux calls `ci:release`. Windows runs native `qa`, `build:npm`, and `test:npm`. Workflows use SHA-pinned Actions and the locked Node/npm toolchain. Checkout credentials and dependency caches remain disabled. Only the CodeQL upload job receives `security-events: write`. Registry publication and npm tokens remain unauthorized.

The PR label `ci-local-proof-bypass` skips both heavy jobs. A separate job states that checks did not run. The label does not affect push or manual runs. A bypass is not successful proof. External contributions remain closed under the contribution policy.

Prepared workflows do not prove remote execution. GitHub Actions must be enabled separately before remote runs can occur.

## Review-only rules — explicit attention required

Deterministic checks do not prove semantic ownership, complete boundary validation, state authority, or recovery correctness. Review these properties directly. Review UI behavior, accessibility, translations, visual quality, and unsupported scanner patterns in context.

Deployment review owns origin separation, CSP, exposed browser capabilities, and resource budgets. Review CSS, HTML, and build-transform provenance outside the TypeScript import scanner. Documentation review must preserve requirements and commands. The ASD skill checks writing structure but does not certify official dictionary compliance.

Use the local architecture, security, and topology review skills when their boundaries change. Fix evidenced blockers. Add a deterministic guard only when it can reject the failure without normalizing debt.

## Debt and tool noise

The [technical-debt report](../engineering/tech-debt-report.md) is generated from the exact review registry. Real deferred defects and proven false positives have separate classifications. Each record needs an owner, evidence, risk, required action, review date, and removal condition. Debt cannot waive a failed check.

Tool-noise admission binds the exact rule, reported location, full finding, source digest, tool identity, and required context. A changed message, trace, source, context, or tool invalidates admission. Expired and obsolete records fail QA. `qa:registry`, `qa:docs`, and `qa:codeql` enforce their respective parts of this contract.
