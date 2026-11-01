# Implementation Rules

The [agent contract](../../AGENTS.md) owns the development loop. [Repository architecture](../architecture/repository-overview.md) assigns runtime owners. [Code quality](../tooling/code-quality.md) maps checks to commands.

Choose an owner by the behavior it changes. Keep entrypoints as composition. Extract a module only when it has an independent boundary or change reason. Keep related state, effects, and recovery together when they form one coherent operation.

Use strict TypeScript for product code. Enable exact optional properties, checked indexed access, and unused-code checks. Reject explicit `any`, unsafe operations, and lost Promises. Tooling and tests have separate explicit lint scopes. Do not weaken product rules to accommodate test factories.

Parse unknown data before use. Validate the complete meaningful payload, its size, and its identity. Keep schema, semantic validation, runtime behavior, authoring instructions, and artifact contracts consistent.

Give mutable state one authority. Bind asynchronous results to the current request and revision. Release owned resources on success, failure, replacement, and cancellation. A stale response must not replace current state.

Before a broad move, inventory all paths, consumers, imports, mocks, source-reading tests, package commands, build inputs, and documentation links. Review the complete move plan before changing paths. File counts and line limits do not determine architecture.

Run independent reviews only for changed semantic boundaries. Supply exact evidence without suggested conclusions. Fix established blockers together. Rerun proof that the corrections invalidate.

## Technical vocabulary

Document validation applies schema and domain rules to an effect or boundary payload. A QA check evaluates a repository, artifact, environment, or transport invariant. Confirmation records a user or maintainer decision. These operations have different inputs, authority, and outcomes. Do not merge their names solely to satisfy a general-language heuristic.
