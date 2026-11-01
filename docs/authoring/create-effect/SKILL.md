---
name: create-effect
description: Create, edit, validate, preview and prove declarative Sniptale Motion Effect v1 animations, effects over source media, and transitions. Use for authoring portable effect JSON and assets through an installed toolkit, without changing the engine.
license: MIT
---

# Create a Sniptale effect

Use Node.js 22.12 or later and the matching toolkit. Browser proof needs compatible Chrome, Edge or managed Chromium.

Produce a portable, editable `*.sniptale-effect.json` document. Keep authoring data separate from the installed engine. Match the user's composition, timing, typography and media intent. Automated proof does not replace visual review.

## Bind the toolkit

Read the generated `references/toolkit.json` next to these references. It identifies the toolkit version, runtime digest and skill digest for this installed skill. Run `sniptale-motion skills --json` and compare all three values. Use the returned `cli.node` and `cli.entry` as the executable and script for subsequent commands, so another global executable cannot silently take over the task. The examples below abbreviate that checked invocation as `sniptale-motion`.

If the command is missing, install the exact toolkit archive supplied for the task or use its explicitly identified executable. If the version or either digest differs, obtain the skill from the matching toolkit before authoring. Do not use an unpinned network `latest` to resolve the mismatch. Do not ignore the mismatch. Alpha archives with the same version can contain different code. Repeat the check before final proof and export if the toolkit changed during the task.

Run `doctor --json` to inspect the environment. A missing browser does not block creation, validation or export. `browser install` explicitly downloads separate Chromium. Run it only when environment setup is authorized. Chrome and Edge can be used without replacement. Report a missing browser as proof not run, never as success.

## Load the authoring contract

Read [references/effect-v1-contract.md](references/effect-v1-contract.md) and [references/graph-runtime.md](references/graph-runtime.md) before designing the document. Read [references/authoring-patterns.md](references/authoring-patterns.md) for responsive geometry, timeline motion, repeated geometry, assets, target effects or transitions. The `skills --json` result also locates the schema and installed guide. Use the schema to resolve a validation case that these references do not cover. Do not search for engine source code.

Choose `standalone` for a composition without transient input, `targetEffect` for one session-only `source` input, or `transition` for session-only `from` and `to` inputs. Consume the declared inputs in the graph. Preview media is not a persistent effect asset.

## Create and refine

Create a project when one does not already exist:

```bash
sniptale-motion init my-motion
cd my-motion
sniptale-motion new my-effect --kind standalone
```

Edit `effects/my-effect/effect.sniptale-effect.json`. Keep asset paths relative to `effects/my-effect/`, for example `assets/logo.svg`. Existing projects and effect names are not overwritten. Choose a new destination when creation reports a collision. Preserve the user's existing source and unrelated files.

Keep `schemaVersion: "sniptale.effect.v1"`, `program.kind: "graph"` and `program.version: 1`. Supply Russian and English localized labels where the schema accepts locale text. Layer `name` remains a plain string. Use supported expressions and commands. Do not add JavaScript renderers, imports, network access or host APIs.

Every declared asset, control, layer, clip, phase and track must contribute to the graph. Preserve required closure relationships when replacing the starter's design. Layer-owned transforms are added to command-local geometry. Avoid applying the same translation twice.

Use clean control labels and declare numeric units separately in `unit` when the value has a meaningful unit. Choose `presentation` for the intended input, and use semantic groups as described in the Controls reference. Assign unique registry icons within each effect to groups and disclosures (see the Controls reference for reserved root icons). Keep individual parameter rows and choices text-only. Nested group icons are optional: omit the icon if no accurate semantic match exists.

Do not add groups or icons merely to fill the inspector. Units never rescale graph values.

After a meaningful change, validate the exact file and its asset root:

```bash
sniptale-motion validate effects/my-effect/effect.sniptale-effect.json --asset-root effects/my-effect --authoring --json
```

Require `ok: true` and zero errors and warnings. Diagnostics provide codes and structural positions without echoing document values. An unknown field name may appear as `<field>`. Correct the document against the schema instead of weakening validation or removing intended behavior just to obtain a green result.

Open `studio` for visual review. It reloads valid external changes while idle and retains the last working state for incomplete or invalid writes. If UI edits exist, applying an external update first saves them as a separate revision. Saving a revision does not overwrite the canonical source. Explicit adoption chooses the source or a revision.

When delivering UI edits, identify the intended revision document under `effects/<id>/revisions/<uuid>/effect.sniptale-effect.json` and validate, prove and export that exact file. Do not silently export the unchanged original instead.

## Prove and deliver

```bash
sniptale-motion prove effects/my-effect/effect.sniptale-effect.json --asset-root effects/my-effect --json
sniptale-motion export effects/my-effect/effect.sniptale-effect.json --output exports/my-effect.sniptale-effect.json --json
```

Require `ok: true` and `proof.runtime: "passed"` for proof. Inspect animation and visibility, determinism, controls, missing binding reads, asset transfers, transient-media export isolation and restart recovery. A `NO_ALTERNATE` control has no distinct legal probe value. Do not label it successfully exercised. Proof intentionally restarts the sandbox, so a zero restart count is not an acceptance requirement.

It samples behavior and records the actual browser version and materialized-input digest. Do not claim identical output across browsers or complete coverage of every possible time and control combination.

Review the start, midpoint, end, phase boundaries, clipping, text and media order in Studio against the user's intent. Export creates a new self-contained file. An existing destination is protected. After an interruption, check whether a complete destination already exists before retrying. Revalidate the exported file with the checked toolkit.

Report the output path, its SHA-256, the exact source or revision, proof status and any missing visual review. Keep source documents and revisions available for further editing.

If the requested behavior exceeds the documented declarative contract, explain the missing capability. Treat an engine extension as a separate task that requires the user's instruction. Effect authoring does not authorize changing the SDK or publishing anything.
