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

## Required loop

1. Define acceptance criteria, non-goals, owners, boundaries, and required proof. Run `npm run qa:preflight -- --files <files>` before a change across owners.
2. Implement the complete bounded change inside its semantic owners. Do not edit source or tests while a compiler or blocking QA run owns them.
3. Run focused tests. Run `npm run qa:checkpoint` for the complete candidate.
4. Run coverage for changed test surfaces or source coverage. Run build proof for runtime, artifact, or browser changes. Run security proof for dependencies, publication, or trust boundaries. Use `npm run ci:proof` for the complete repository proof. Use `npm run ci:release` to also check a local npm candidate.
5. Complete applicable local reviews. Collect findings before one correction batch. Rerun only invalidated proof and reviews.
6. Add a deterministic check when it can reject the failure without a debt exception.
7. Run `npm run qa:closeout -- -m "message"` only after the user requests a commit. Closeout owns staging and the commit. It must reject failed proof or changed candidate inputs. It must not publish, push, or amend.

Use each blocking wrapper sequentially. Keep the candidate fixed during QA and independent review. A successful tool exit does not replace report validation or semantic review.

## Reviews

Use [architecture review](.agents/skills/architecture-code-review/SKILL.md) for changed ownership, state authority, public contracts, parsing, dependency direction, or i18n ownership. Use [security review](.agents/skills/security-code-review/SKILL.md) for changed trust, assets, messages, import/export, dependencies, publication, or CI permissions. Use [topology review](.agents/skills/topology-plan-review/SKILL.md) before broad owner moves. Mechanical formatting and behavior-preserving local extraction do not require an independent review by themselves.

Start each required independent review in a fresh read-only agent with `fork_turns: "none"`. Supply the complete bounded manifest, exact diff, consumers, acceptance criteria, QA results, and known limitations. Do not supply desired findings or a desired verdict. The reviewer must not edit files or run blocking QA. Keep review evidence under `.tmp/reviews/`.

Classify findings in this order:

- `security issue`: supported or hostile input reaches unsafe authority or sensitive data.
- `current regression`: the candidate breaks existing supported behavior.
- `acceptance blocker`: the candidate fails an agreed requirement or required proof.
- `pre-existing hardening`: an evidenced defect predates the candidate and does not block its acceptance.

The first three classes block completion. Report pre-existing hardening only when it affects the verdict or the user requests an inventory. Require a reachable trigger and the smallest correction. Do not introduce requirements from hypothetical future behavior.

User model restrictions always apply.

## Text and documentation

Apply the local [ASD-STE100 skill](.agents/skills/asd-ste100/SKILL.md) to authored English instructions and documentation. Preserve requirements, uncertainty, technical identifiers, and commands. Mechanical checks do not prove approved-dictionary compliance. All authored documentation under `docs/`, repository skills, and this contract use English. Keep localized examples inside code spans or fences. Preserve intentional negative examples as test data.

Write Markdown and `NOTICE` as natural paragraphs. Do not insert line breaks for width or use prose-reflow formatters. Preserve the checked root `LICENSE` transformation and byte-exact upstream license texts. Keep one contract owner. Use compact tables only when useful. Remove introductions that add no contract or decision.

## i18n

Russian is the source and default locale. English is required. Adopted UI surfaces use shared locale maps and resolvers. See [i18n architecture](docs/architecture/i18n-architecture.md).
