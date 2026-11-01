# Technical Debt and Tool Noise

The [registry](../../tooling/configs/qa/technical-debt.data.json) owns these decisions. This report is generated. Change the registry. Regenerate the report in the same change.

A debt record never authorizes a failed check. Tool-noise admission requires an exact reviewed finding, source bytes, tool identity, evidence, owner, and removal condition. Changed or obsolete decisions fail QA.

## Deferred defects

This registry accepts no deferred defects.

## Proven tool noise

### `noise.ste.authoring-git-ignore`

Scope: `.agents/skills/create-effect/SKILL.md:29:21`. Owner: `repository-owner (lrozhkov)`. Review by `2027-02-01`.

The Git ignore check protects local storage. Effect validation admits declarative documents. These operations have different inputs and outcomes.

Risk: A broader exception could hide a new defect or ambiguous instruction.

Required action: Keep the exact finding, source, context, and evidence bound together.

Removal: Remove when the tool distinguishes these operations or the reported text changes. Reassess every source or tool change.

Evidence: [docs/engineering/implementation-rules.md](implementation-rules.md), [tooling/qa/policy/technical-debt/registry.test.ts](../../tooling/qa/policy/technical-debt/registry.test.ts).

### `noise.ste.readme-validation-and-compatibility`

Scope: `README.md:5:133`. Owner: `repository-owner (lrozhkov)`. Review by `2027-02-01`.

Target-editor compatibility testing differs from document validation. The text names separate user and SDK operations.

Risk: A broader exception could hide a new defect or ambiguous instruction.

Required action: Keep the exact finding, source, context, and evidence bound together.

Removal: Remove when the tool distinguishes these operations or the reported text changes. Reassess every source or tool change.

Evidence: [docs/engineering/implementation-rules.md](implementation-rules.md), [tooling/qa/policy/technical-debt/registry.test.ts](../../tooling/qa/policy/technical-debt/registry.test.ts).

### `noise.ste.architecture-document-and-artifact-proof`

Scope: `docs/architecture/repository-overview.md:31:175`. Owner: `repository-owner (lrozhkov)`. Review by `2027-02-01`.

Artifact and release checks differ from Effect document validation. Their owners and proof surfaces are separate.

Risk: A broader exception could hide a new defect or ambiguous instruction.

Required action: Keep the exact finding, source, context, and evidence bound together.

Removal: Remove when the tool distinguishes these operations or the reported text changes. Reassess every source or tool change.

Evidence: [docs/engineering/implementation-rules.md](implementation-rules.md), [tooling/qa/policy/technical-debt/registry.test.ts](../../tooling/qa/policy/technical-debt/registry.test.ts).

### `noise.ste.toolkit-fingerprint-and-document-validation`

Scope: `docs/authoring/create-effect/SKILL.md:15:352`. Owner: `repository-owner (lrozhkov)`. Review by `2027-02-01`.

Toolkit fingerprint checks establish executable identity. Document validation evaluates authored Effect data. Neither step replaces the other.

Risk: A broader exception could hide a new defect or ambiguous instruction.

Required action: Keep the exact finding, source, context, and evidence bound together.

Removal: Remove when the tool distinguishes these operations or the reported text changes. Reassess every source or tool change.

Evidence: [docs/engineering/implementation-rules.md](implementation-rules.md), [tooling/qa/policy/technical-debt/registry.test.ts](../../tooling/qa/policy/technical-debt/registry.test.ts).

### `noise.ste.document-contract-validation-and-checks`

Scope: `docs/authoring/create-effect/references/effect-v1-contract.md:53:108`. Owner: `repository-owner (lrozhkov)`. Review by `2027-02-01`.

Toolkit identity checks and render inspection differ from schema and domain validation. The reference preserves those separate authoring steps.

Risk: A broader exception could hide a new defect or ambiguous instruction.

Required action: Keep the exact finding, source, context, and evidence bound together.

Removal: Remove when the tool distinguishes these operations or the reported text changes. Reassess every source or tool change.

Evidence: [docs/engineering/implementation-rules.md](implementation-rules.md), [tooling/qa/policy/technical-debt/registry.test.ts](../../tooling/qa/policy/technical-debt/registry.test.ts).

### `noise.ste.implementation-boundary-and-qa`

Scope: `docs/engineering/implementation-rules.md:9:32`. Owner: `repository-owner (lrozhkov)`. Review by `2027-02-01`.

Repository QA checks differ from boundary-payload validation. The technical vocabulary defines their separate authority and outcomes.

Risk: A broader exception could hide a new defect or ambiguous instruction.

Required action: Keep the exact finding, source, context, and evidence bound together.

Removal: Remove when the tool distinguishes these operations or the reported text changes. Reassess every source or tool change.

Evidence: [docs/engineering/implementation-rules.md](implementation-rules.md), [tooling/qa/policy/technical-debt/registry.test.ts](../../tooling/qa/policy/technical-debt/registry.test.ts).

### `noise.ste.provenance-maintainer-confirmation`

Scope: `docs/oss/provenance.md:9:16`. Owner: `repository-owner (lrozhkov)`. Review by `2027-02-01`.

Maintainer confirmation establishes licensing authority. Automated checks inspect license evidence. Effect validation admits declarative runtime data.

Risk: A broader exception could hide a new defect or ambiguous instruction.

Required action: Keep the exact finding, source, context, and evidence bound together.

Removal: Remove when the tool distinguishes these operations or the reported text changes. Reassess every source or tool change.

Evidence: [docs/engineering/implementation-rules.md](implementation-rules.md), [tooling/qa/policy/technical-debt/registry.test.ts](../../tooling/qa/policy/technical-debt/registry.test.ts).

### `noise.ste.provenance-effect-admission`

Scope: `docs/oss/provenance.md:11:191`. Owner: `repository-owner (lrozhkov)`. Review by `2027-02-01`.

Maintainer confirmation establishes licensing authority. Automated checks inspect license evidence. Effect validation admits declarative runtime data.

Risk: A broader exception could hide a new defect or ambiguous instruction.

Required action: Keep the exact finding, source, context, and evidence bound together.

Removal: Remove when the tool distinguishes these operations or the reported text changes. Reassess every source or tool change.

Evidence: [docs/engineering/implementation-rules.md](implementation-rules.md), [tooling/qa/policy/technical-debt/registry.test.ts](../../tooling/qa/policy/technical-debt/registry.test.ts).

### `noise.ste.security-payload-and-origin`

Scope: `docs/security/security-model.md:13:227`. Owner: `repository-owner (lrozhkov)`. Review by `2027-02-01`.

Origin checks establish sender authority. Document validation admits payload structure and semantics. These controls enforce different boundaries.

Risk: A broader exception could hide a new defect or ambiguous instruction.

Required action: Keep the exact finding, source, context, and evidence bound together.

Removal: Remove when the tool distinguishes these operations or the reported text changes. Reassess every source or tool change.

Evidence: [docs/engineering/implementation-rules.md](implementation-rules.md), [tooling/qa/policy/technical-debt/registry.test.ts](../../tooling/qa/policy/technical-debt/registry.test.ts).

### `noise.ste.toolkit-validation-and-update`

Scope: `docs/tooling/npm-toolkit.md:3:192`. Owner: `repository-owner (lrozhkov)`. Review by `2027-02-01`.

The explicit update check inspects registry compatibility. Document validation evaluates a local effect. The CLI exposes separate commands.

Risk: A broader exception could hide a new defect or ambiguous instruction.

Required action: Keep the exact finding, source, context, and evidence bound together.

Removal: Remove when the tool distinguishes these operations or the reported text changes. Reassess every source or tool change.

Evidence: [docs/engineering/implementation-rules.md](implementation-rules.md), [tooling/qa/policy/technical-debt/registry.test.ts](../../tooling/qa/policy/technical-debt/registry.test.ts).

### `noise.codeql.contained-static-file`

Scope: `src/apps/cli/files.ts:65:33`. Owner: `repository-owner (lrozhkov)`. Review by `2027-02-01`.

The selected path passes lexical containment before canonical resolution and real-path containment afterward. The reader uses a bounded no-follow descriptor. The query does not model the custom containment predicate.

Risk: Removing containment or changing root authority could expose files outside the permitted runtime root.

Required action: Retain traversal, sibling-root, absolute-path, and symlink-escape denial proof. Admit no other path finding.

Removal: Remove when CodeQL models the containment predicate or this call disappears. Any source, caller, tool, message, or trace change requires review.

Evidence: [tests/motion-contained-files.test.ts](../../tests/motion-contained-files.test.ts), [tests/motion-studio.test.ts](../../tests/motion-studio.test.ts), [src/apps/cli/files.ts](../../src/apps/cli/files.ts).

## Verification limits

Platform verification limits remain owned by [code quality](../tooling/code-quality.md). A platform limitation is not proof of a source defect or a tool false positive.
