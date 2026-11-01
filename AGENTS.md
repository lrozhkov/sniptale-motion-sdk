# Sniptale Motion SDK Agent Contract

Code, schemas, tests, and deterministic policies own implementation behavior. Documentation records contracts that these owners do not explain.

## Ownership

- Keep runtime entrypoints thin. Place product logic under its viewer, sandbox, SDK, or shared owner. Repository commands belong under `tooling/`. Do not create a top-level `scripts/` directory.
- Treat JSON, files, messages, generated reports, and browser results as unknown. Parse each value at its receiving boundary.
- Keep Effect v1 documents declarative, dependency-free, deterministic, and compatible with the sandbox.
- Select dependency and downloaded tool versions at least seven full days old. Apply this rule to transitive dependencies. Permit a younger version only for a checked vulnerability fix. Record its exact version, advisory, and expiring exception. Do not exclude packages or scopes from age checks.

  Keep installation scripts disabled. Review scripts before explicit execution.
- Use `path owns the domain, filename owns the role`. Prefer TypeScript owner modules over compatibility files.
- Do not add debt baselines, broad allowlists, or known-failure snapshots. Track real deferred defects separately from proven tool false positives. Debt records never authorize failed QA. Exact tool-noise decisions require evidence, rule, source scope, owner, and removal condition. Read the [technical-debt report](docs/engineering/tech-debt-report.md). Do not generate policies that normalize current debt.
- Store temporary inputs, assets, packs, reports, coverage, browser output, and caches under ignored `.tmp/` storage. Do not commit placeholders there. Keep `docs/` free of empty directories.

## Scope and implementation

- Record observable acceptance criteria, non-goals, planned paths, consumers, boundaries, and required proof before implementation.
- Check the current Git state. Preserve changes outside the task scope.
- Expand scope only for acceptance, an established defect, an existing invariant, a reachable supported flow, or a material risk.
- Material risks concern security, privacy, authorization, trust boundaries, or permanent data loss.
- Keep established defects, hypotheses, and implementation choices separate. Test a hypothesis before making it an architecture constraint.
- Give each investigation a question, a minimal check, and a stopping condition. Stop when evidence supports the task decision.
- Start with the simplest approach that satisfies acceptance and existing invariants. Add infrastructure only after evidence shows a limitation.
- Define failure behavior before implementation. Preserve valid source data and completed work. Restrict only operations affected by the failure.
- For interactive changes, check the actual user flow before blocking QA. Check affected selection, navigation, editing, and recovery.
- Prove the requested result. Tests of internal state alone do not prove the user result.

## Required loop

1. Record scope and proof. Run `npm run qa:preflight -- --files <files>` before changing production behavior, public contracts, boundaries, topology, or QA tooling. Preflight is also required across owners. Repeat preflight before expanding the recorded scope.
2. For an escaped defect, obtain failing proof before the correction. Record why existing QA missed it. Decide whether a deterministic guard can reject it without a debt exception. Add that guard before final proof when applicable.
3. Implement the complete bounded change inside its semantic owners. Do not edit source or tests during a compiler or blocking QA run.
4. Run focused tests and check required success, failure, and recovery paths. Then run `npm run qa:checkpoint` for the complete candidate.
5. Run required coverage, build, and security proof. Preflight reports the conservative command route. Use `npm run ci:proof` for complete repository proof. Use `npm run ci:release` to also check a local npm candidate.
6. Complete applicable local reviews. Collect all findings before corrections. Check each finding against acceptance, evidence, and existing invariants. Apply one correction batch. Repeat only proof and reviews invalidated by corrections.
7. Run `npm run qa:closeout -- -m "message"` only after the user requests a commit. Closeout owns staging and the commit. It must reject failed proof or changed candidate inputs. It must not publish, push, or amend.

Use each blocking wrapper sequentially in the main agent. Keep the candidate fixed during QA and independent review. A successful tool exit does not replace report validation or semantic review. Diagnose the failed stage after a wrapper failure. Return to preflight if the correction changes scope or boundaries.

## Persistence proof

For changes to persistent writes, deletion, or restoration, record these cases in the scope manifest:

- Parallel writers.
- Delayed writes after deletion or restoration.
- Recreation of the same identity.
- Command retry after failure or refusal.

For each applicable case, state the invariant, test file, and test name. Explain each inapplicable case from the supported flow. Include opening operations that can write before an editor session exists. Control operation order in tests. Do not use timing delays to create a race. Checkpoint must execute the selected tests. Fix existing test discovery if it misses them.

## Reviews

Use [architecture review](.agents/skills/architecture-code-review/SKILL.md) for changed ownership, state authority, public contracts, parsing, dependency direction, or i18n ownership. Use [security review](.agents/skills/security-code-review/SKILL.md) for changed trust, assets, messages, import/export, dependencies, publication, or CI permissions. Use [topology review](.agents/skills/topology-plan-review/SKILL.md) before broad owner moves. Mechanical formatting and behavior-preserving local extraction do not require an independent review by themselves.

Check the actual diff against every review trigger. Preflight routing cannot cancel a required review. Record each required review or an implementation-based reason why it does not apply. For persistence changes, reviewers check case selection, test evidence, and inapplicability reasons.

Start each required independent review in a fresh read-only agent with `fork_turns: "none"`. Supply the complete bounded manifest, exact diff, consumers, acceptance criteria, preflight result, QA results, and known limitations. Do not supply desired findings or a desired verdict. The reviewer must not edit files or run blocking QA. Keep review evidence under `.tmp/reviews/`.

Classify findings in this order:

- `security issue`: supported or hostile input reaches unsafe authority or sensitive data.
- `current regression`: the candidate breaks existing supported behavior.
- `acceptance blocker`: the candidate fails an agreed requirement or required proof.
- `pre-existing hardening`: an evidenced defect predates the candidate and does not block its acceptance.

The first three classes block completion. Report pre-existing hardening only when it affects the verdict or the user requests an inventory. Require a reachable trigger and the smallest correction. Do not introduce requirements from hypothetical future behavior.

Repeat review when a correction changes behavior, ownership, public contracts, dependency direction, parser semantics, or security authority. Mechanical cleanup alone does not require another review. Treat heuristic findings as investigation inputs. Inspect the flagged implementation before investigating a possible tool false positive. Establish evidence before requesting an exact tool-noise decision.

If a required tool, check, or reviewer is unavailable, preserve completed work. Continue independent work and report the exact blocker. Do not cancel the requirement or claim completion without its result.

User model restrictions always apply.

## Text and documentation

Apply the local [ASD-STE100 skill](.agents/skills/asd-ste100/SKILL.md) to authored English instructions and documentation. Preserve requirements, uncertainty, technical identifiers, and commands. Mechanical checks do not prove approved-dictionary compliance. All authored documentation under `docs/`, repository skills, and this contract use English. Keep localized examples inside code spans or fences. Preserve intentional negative examples as test data.

Write Markdown and `NOTICE` as natural paragraphs. Do not insert line breaks for width or use prose-reflow formatters. Preserve the checked root `LICENSE` transformation and byte-exact upstream license texts. Keep one contract owner. Use compact tables only when useful. Remove introductions that add no contract or decision.

## i18n

Russian is the source and default locale. English is required. Adopted UI surfaces use shared locale maps and resolvers. See [i18n architecture](docs/architecture/i18n-architecture.md).
