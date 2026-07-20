---
name: create-effect
description: Create, modify, validate, preview, and prove local Sniptale Motion Effect v1 JSON documents and their assets without changing the SDK engine. Use when Codex needs to prepare a standalone animation, a target effect over source media, a transition between media inputs, or explain what the declarative Effect v1 engine can render and how local effect bundles must be organized.
---

# Create a Sniptale effect

Create only declarative Effect v1 data. Keep the SDK implementation static and let the existing importer, validator, and sandbox interpret the document.

## Load the contract

Read [references/effect-v1-contract.md](references/effect-v1-contract.md) completely before creating or changing an effect. Read [references/graph-runtime.md](references/graph-runtime.md) completely before designing its render graph. Read [references/authoring-patterns.md](references/authoring-patterns.md) when implementing any nontrivial animation, runtime-input composition, asset usage, timeline, or repeated geometry.

Treat these skill references as the working authoring manual. Consult `schemas/sniptale-effect-v1.schema.json` or `src/sdk/effect-v1/` only when the validator reports a case that the manual does not cover or when the user explicitly asks to audit the engine contract.

## Keep the effect local

Use one ignored directory per effect:

```text
.tmp/effects/<effect-id>/
├── <effect-id>.sniptale-effect.json
└── assets/
    └── <local files>
```

Use the `*.sniptale-effect.json` suffix and safe identifiers made from letters, digits, `.`, `_`, and `-`. Keep asset paths relative to the effect directory, for example `assets/logo.svg`. Never place authored effects in `src/`, `public/`, `docs/`, fixtures, schemas, or a committed pack. Never edit runtime, SDK, viewer, sandbox, tooling, package, schema, or test files merely to register an effect. The engine imports the JSON document directly; it does not require a source-code registry entry.

Before handing off, verify that Git ignores the local bundle:

```bash
git check-ignore -v .tmp/effects/<effect-id>/<effect-id>.sniptale-effect.json
git status --short
```

Do not stage or commit anything under `.tmp/effects/`.

## Choose the effect kind

- Choose `standalone` for a self-contained composition with no transient media input.
- Choose `targetEffect` for an effect applied over one temporary `source` frame. Consume `source` with an `image` command.
- Choose `transition` for an effect joining temporary `from` and `to` frames. Consume both inputs with `image` commands.

Do not store preview media in the document. Runtime inputs are session-only frames supplied by the host.

## Author the effect

1. Derive a stable `<effect-id>` and choose the kind before editing JSON.
2. Create the starter at the final ignored path. Omit `--force` unless replacing the exact local effect is intentional.

```bash
npm run effect:new -- --id <effect-id> --kind <standalone|targetEffect|transition> --output .tmp/effects/<effect-id>/<effect-id>.sniptale-effect.json
```

3. Preserve `schemaVersion: "sniptale.effect.v1"`, `program.kind: "graph"`, and `program.version: 1`. Express all behavior with supported commands and expressions. Do not add a JavaScript renderer, module source, `eval`, dynamic import, or compatibility fields.
4. Keep `label.ru` and `label.en` present. Provide both locales for visible metadata and control labels.
5. Declare every asset, control, track, phase, layer, and runtime input only when the graph observes it. Remove inert declarations instead of suppressing diagnostics.
6. Use logical canvas `width` and `height` reads for responsive layout. Use `time`, `progress`, controls, tracks, and bounded literal loops for deterministic animation.
7. Keep layer-owned `x`, `y`, and `opacity` separate from command-local geometry. Remember that the runtime adds layer `x` and `y` before drawing a command with the same `layerId`.

## Validate and prove

Check schema freshness once when the repository state is uncertain:

```bash
npm run effect:schema:check
```

Validate after every meaningful edit. Keep `-s` and `--json` so stdout is machine-readable:

```bash
npm run -s effect:validate -- .tmp/effects/<effect-id>/<effect-id>.sniptale-effect.json --asset-root .tmp/effects/<effect-id> --json
```

Fix every error and warning. Do not weaken the document to bypass closure checks; wire the intended feature into the graph or delete it.

Run browser-backed import and runtime proof after static validation passes:

```bash
npm run effect:prove -- .tmp/effects/<effect-id>/<effect-id>.sniptale-effect.json --asset-root .tmp/effects/<effect-id>
```

Accept the result only when the proof reports `ok: true`, nonblank frames, expected time variation, runtime-input isolation, observable control changes, complete binding coverage, and zero recovery or stale-response deltas. Review the start, middle, end, phase boundaries, text placement, clipping, opacity, and transitions for visual intent; automated proof establishes execution, not taste.

## Respect the boundary

Keep effect creation as a data-only task. If the requested behavior cannot be expressed with the documented commands, expressions, assets, layers, timeline, and runtime inputs, explain the missing capability and stop. Change the engine only when the user separately and explicitly requests an engine feature.
