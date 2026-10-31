# Sniptale Motion SDK

**Describe the motion. Let an agent make it portable.**

Sniptale Motion SDK is a local-first workspace for creating, inspecting, validating, previewing, and exporting reusable motion effects with a coding agent. It is intended to let people without professional animation or programming skills turn visual intent into a strict `sniptale.effect.v1` document that a compatible Sniptale video editor can import and render.

> **Alpha preview.** The Effect v1 contract, authoring UI, agent workflow, and video-editor integration are still experimental. Formats and editing behavior may change without migration or backward compatibility. Keep important source media and exported effects backed up, and test an effect in the exact editor build where it will be used.

The main result is not only a rendered clip. It is a portable, editable effect definition:

```text
visual idea in plain language
  → Codex uses the repository-local $create-effect skill
  → a local Effect v1 document and assets under ignored .tmp storage
  → SDK preview, timeline editing, validation, and browser proof
  → one exported *.sniptale-effect.json file
  → import into a compatible Sniptale video editor
```

This is the project's main distinction from tools that generate only finished pixels. The output retains effect structure, timing, controls, layers, and runtime-input behavior, so the same artifact can be reused on video-editor media instead of being limited to one flattened render.

## Build from source

### Requirements

- Node.js `>=22.12.0`
- npm
- a modern Chromium browser for the viewer and browser-backed proof

Install the exact dependency versions from `package-lock.json`, verify the generated schema, and start the local viewer and isolated sandbox:

```bash
npm ci
npm run effect:schema:check
npm run dev
```

Open `http://127.0.0.1:4177/`. The sandbox runs on a separate local origin at `http://127.0.0.1:4178/`.

Create a release-mode local build with `npm run build`. The output contains TypeScript declarations under `dist/sdk` and static viewer and sandbox applications under `dist/apps`.

## Why this project exists

Animation software is powerful, but producing even a small polished title, overlay, or transition normally requires a working knowledge of composition, timing, easing, layers, masks, and export formats. A user may know exactly what the result should feel like without knowing how to translate that intent into a render graph or a keyframe timeline.

The SDK moves that translation into a bounded conversation with an agent. The user describes the visual hierarchy, motion, timing, colors, editable parameters, and desired media behavior. The repository-local skill gives Codex the engine contract, supported techniques, file layout, validation commands, and acceptance rules. The agent creates declarative effect data; it does not need to rediscover the engine by parsing the entire repository, and it does not change the engine to register each new effect.

The other important goal is portability. Agent-assisted animation products already exist, but a generated preview alone is not a reusable editing primitive. Here the intended deliverable is an Effect v1 artifact that can be imported into a compatible [Sniptale](https://github.com/lrozhkov/sniptale) video editor, applied to project media, adjusted through declared controls, and rendered again as part of the final edit.

Like Sniptale, this repository has been developed through AI coding-agent sessions in Codex under human product direction. The human role is to define the product intent, describe desired behavior, set acceptance criteria, inspect visual results, and decide which trade-offs are acceptable. Agents have produced or revised the implementation, tests, documentation, refactors, and quality tooling through repeated bounded tasks.

The development loop is intentionally constrained:

```text
product intent and acceptance criteria
  → bounded agent task
  → deterministic validation and tests
  → browser-backed runtime proof
  → visual review and correction
  → repeat
```

These controls provide engineering evidence, not artistic judgment, third-party certification, or a guarantee that generated work is visually successful. The user still decides whether the composition, pacing, typography, and transition behavior are right.

## Current maturity

| Area | Current status |
| --- | --- |
| Effect v1 document and graph runtime | Implemented and strictly validated, but still an experimental contract |
| Repository-local Codex authoring skill | Installed and usable for local data-only effect creation; prompt patterns will continue to evolve |
| Viewer, canvas, inspector, and timeline | Functional alpha with editing, playback, review, and export surfaces |
| Sniptale video-editor compatibility | The current editor accepts the same Effect v1 raw JSON contract; compatibility should still be tested against the target build |
| Backward compatibility and migrations | Not promised during the alpha-preview phase |

## Create an effect with Codex

Open this repository in Codex and name the bundled skill explicitly. A useful first request looks like this:

```text
Use $create-effect to create a local 2.4-second transition named soft-prism-wipe.

Move from the outgoing frame to the incoming frame with a left-to-right softened wipe, a restrained cyan highlight, and no black frame at either end. Keep both inputs full-bleed, expose the highlight color and intensity as controls, and make the motion calm rather than elastic.

Store everything under .tmp/effects/soft-prism-wipe, validate it with zero warnings, run browser proof, and do not change SDK source code.
```

The skill teaches the agent how to choose an effect kind, use the declarative graph, organize assets, keep the document closed and observable, and run the acceptance pipeline. If the requested behavior is outside the current engine, the agent should explain the missing capability instead of silently adding JavaScript or patching the runtime.

Every working effect belongs in one ignored local directory:

```text
.tmp/effects/<effect-id>/
├── <effect-id>.sniptale-effect.json
└── assets/
    └── <local PNG, JPEG, WebP, SVG, MP3, OGG, or WAV files>
```

The engine does not scan a source directory and there is no effect registry to edit. The selected JSON document is imported directly. New effects do not belong in `src/`, `public/`, schemas, fixtures, demo packs, or a committed manifest.

The whole `.tmp/` tree is ignored by Git. Before handoff, the agent verifies that the document is ignored and that no effect asset has entered the tracked tree:

```bash
git check-ignore -v .tmp/effects/<effect-id>/<effect-id>.sniptale-effect.json
git status --short
```

Do not stage or commit anything under `.tmp/effects/`.

## A better language for directing the agent

You do not need to write animation code, but a small amount of shared vocabulary makes iteration much more precise. Describe the following when it matters:

- **Kind:** a self-contained composition, an effect over one source clip, or a transition between two clips.
- **Composition:** what is foreground and background, which elements dominate, where text sits, and which areas must stay clear.
- **Timing:** duration plus entrance, hold, accent, and exit intervals. Percentages such as “enter during the first 15%, hold until 75%, then fade” are especially useful.
- **Motion:** direction, distance, path, easing, stagger, overshoot, rotation, scale, reveal, blur, or opacity behavior.
- **Media behavior:** whether source media uses `cover`, `contain`, or intentional stretching, and how outgoing and incoming frames should stack.
- **Editable controls:** which colors, text, sizes, strengths, or other bounded values should remain adjustable in the video editor.
- **Responsive behavior:** safe margins, alignment, and what should happen at output sizes other than the common 1280×720 preview.
- **Acceptance criteria:** what must be visible at the beginning, middle, and end; what must never flash, clip, disappear, or obscure source media.

Useful correction language includes “reduce the entrance to 300 ms,” “keep the title inside a 10% safe margin,” “use a smooth motion path rather than linear x/y movement,” “make the accent color a real control,” “preserve every pixel of the source with `contain`,” and “inspect the phase boundary for a one-frame discontinuity.”

You can also ask the agent to explain the current structure before changing it: which layers exist, which tracks animate them, which controls affect visible pixels, which graph commands render the result, and which engine limit prevents a requested variation.

## Effect kinds

| Kind | Inputs from the host | Typical use |
| --- | --- | --- |
| `standalone` | none | animated title, lower third, overlay, procedural composition, or reusable card |
| `targetEffect` | `source` | frame, reveal, tint, annotation, decoration, or treatment applied to one media item |
| `transition` | `from` and `to` | crossfade, wipe, split, mask-like reveal, zoom, or stylized scene change |

Preview media for `source`, `from`, and `to` is temporary host state. It is not written into the effect, its history, or its exported artifact. The video editor supplies real project frames when it renders the effect.

## What the SDK can do

### Inspect and adjust the composition

The browser viewer combines a live preview, layer hierarchy, inspector, effect controls, review diagnostics, and timeline. When a layer declares the relevant editor capabilities, it can be selected on the canvas and moved, scaled, rotated, repositioned around its pivot, duplicated, reordered, hidden, locked, or edited through exposed properties.

Canvas guides, snapping, zoom, group isolation, timeline snapping, layer search, undo and redo, live playback, cached preview, and fullscreen preview support iterative visual work. The goal is not to force every correction back through JSON: a user can inspect how the animation is built, make bounded adjustments, and then use that result to give the agent more precise feedback.

### Edit animation structure

An Effect v1 document can contain scenes, layer clips, named phases, tracks, keyframes, easing, Bézier handles, and spatial motion paths. The timeline and graph editor make timing relationships visible, while the inspector exposes the selected scene, phase, layer, track, keyframe, asset, or control.

Effects can expose `color`, `text`, and `number` controls. A valid control is not decorative metadata: the graph must read it and it must create an observable visual change.

### Render declarative motion

The graph runtime can draw rectangles and geometric shapes, text, raster images, SVGs, polylines, sampled paths, and Bézier or arc-based paths. It supports gradients, alpha, a bounded set of blend modes, blur, brightness, saturation, shadows, transforms, clipping, conditional groups, reusable definitions, deterministic repeated geometry, stable ordering, and frame-local offscreen render passes.

Animation expressions can read time, normalized progress, frame index, output dimensions, controls, tracks, resolved layer state, local variables, definitions, and kind-appropriate media inputs. Arithmetic, comparisons, selection, easing, trigonometry, color construction, and curve geometry can be combined within deterministic depth and execution budgets.

SVG assets can be rendered as a whole or animated by parts for assemble, scatter, shatter, reveal, stagger, blur, rotation, and scale effects. Repeated elements can create particles, grids, progress marks, rays, waves, or chart-like motion as long as their loop bounds are literal and remain inside the runtime budget.

### Work with local assets and host media

Local authoring supports PNG, JPEG, WebP, sanitized SVG, MP3, OGG, and WAV assets. Asset paths remain relative to the effect directory, are checked for traversal and type mismatches, and are bounded by per-file and total-size limits.

A `targetEffect` receives one temporary `source` frame. A `transition` receives `from` and `to` frames. This makes the same effect reusable across different video clips without embedding preview media into the portable document.

### Export a reusable effect or a review video

The viewer imports strict Effect v1 JSON together with any referenced local files. Its effect export validates the current document and materializes accepted assets into one `*.sniptale-effect.json` file suitable for handoff to a compatible Sniptale video editor.

The viewer can also export an MP4 render for review. That MP4 is a flattened visual result; the reusable editor-compatible artifact is the Effect v1 JSON document.

Compatibility is contract-based, not universal. A `.sniptale-effect.json` file is not an Adobe After Effects, Premiere Pro, Final Cut Pro, DaVinci Resolve, or general plug-in format. A consumer must implement the matching `sniptale.effect.v1` document, asset, timeline, graph, and runtime-input contract.

## Validation and proof pipeline

The SDK treats agent output as untrusted data and checks it at several levels:

```text
strict JSON and generated schema
  → semantic references, closure, timelines, and runtime-input rules
  → local asset paths, signatures, sizes, SVG safety, and integrity
  → isolated browser import and sandbox execution
  → nonblank frames, time variation, control variation, and binding coverage
  → transient-input isolation, stale-response checks, and recovery checks
  → human review of composition, timing, typography, clipping, and media order
```

Static validation must finish with zero errors and zero warnings. Browser proof must report `ok: true`. A green proof means that the effect imports and behaves observably inside the supported contract; it does not mean that the animation is tasteful, readable, on-brand, or ready to publish.

## Run the effect workflow manually

The agent skill owns the recommended workflow, but every step is also available from the command line.

Create a starter directly at its final ignored path:

```bash
npm run effect:new -- --id <effect-id> --kind <standalone|targetEffect|transition> --output .tmp/effects/<effect-id>/<effect-id>.sniptale-effect.json
```

Validate the document and its local asset root:

```bash
npm run -s effect:validate -- .tmp/effects/<effect-id>/<effect-id>.sniptale-effect.json --asset-root .tmp/effects/<effect-id> --json
```

Run browser-backed import and runtime proof:

```bash
npm run effect:prove -- .tmp/effects/<effect-id>/<effect-id>.sniptale-effect.json --asset-root .tmp/effects/<effect-id>
```

To refine or export the effect in the viewer, choose **Import .effect** and select the JSON document together with every referenced asset. After review, choose **Export .effect** to download the portable single-file document. Import that file through the Effect v1 import surface in a compatible Sniptale video editor.

## Deliberate limits

Effect v1 is a bounded declarative format, not an unrestricted animation runtime. Authored JavaScript, TypeScript, JSX, React, Three.js, WASM, dynamic imports, network fetches, browser APIs, external asset URLs, random numbers, wall-clock time, mutable cross-frame state, and executable compatibility fields are rejected.

The runtime starts each frame from a fresh canvas. Loops are statically bounded, expression and graph depth are limited, resources are capped, unknown fields fail validation, and every declared control, track, phase, asset, input, and binding must be connected to real behavior. These limits reduce the range of possible effects, but they make agent-authored documents inspectable, portable, deterministic, and safer to run in a video editor.

When a visual idea cannot be represented by the current commands, expressions, assets, timeline, and inputs, effect creation stops at that boundary. Extending the engine is a separate SDK-development task and must not be smuggled into routine effect authoring.

## Repository architecture

- `src/apps/viewer/` owns the editor, imports, exports, playback, preview, and host-side sandbox transport.
- `src/apps/sandbox/` owns isolated document execution and frame rendering.
- `src/sdk/` owns public TypeScript contracts, validation, the generated Effect v1 schema model, graph contracts, and reusable motion primitives.
- `src/shared/` owns deliberately shared timeline and localization behavior.
- `tooling/effect-v1/` owns effect creation, validation, browser proof, and deterministic compatibility-corpus commands.
- `.agents/skills/create-effect/` is the repository-local authoring manual used by Codex.
- `.tmp/` is the only location for local effects, assets, generated evidence, QA logs, and other disposable working data.

The viewer and sandbox run on separate loopback origins. Imported documents are parsed and validated before registration, and the sandbox interprets the bounded graph rather than compiling authored source code. See the [repository architecture](docs/architecture/repository-overview.md) and [security model](docs/security/security-model.md) for the maintained boundaries.

## Development and quality checks

Run the repository checkpoint after source or documentation changes:

```bash
npm run qa:checkpoint
```

Run the full build, coverage, browser smoke, artifact, and legal checks with:

```bash
npm run qa:build
```

`npm run effect:corpus:check` generates the locked cross-repository Effect v1 compatibility corpus twice and verifies its schema copy, ZIP profile, inventory, expectations, contract lock, and SHA-256 closure. From a clean committed `HEAD`, `npm run effect:corpus` writes handoff artifacts to ignored `.tmp/sniptale-effect-corpus` and records that exact commit in the metadata.

The [documentation index](docs/README.md) identifies the owner for each repository-level contract. Code, schemas, tests, and deterministic checks remain authoritative for implementation details. The detailed agent-facing authoring contract lives in the [`create-effect` skill](.agents/skills/create-effect/SKILL.md).

Project licensing is defined by [LICENSE](LICENSE) and [NOTICE](NOTICE). External code contributions are not accepted; see [CONTRIBUTING.md](CONTRIBUTING.md). [SECURITY.md](SECURITY.md) owns security reporting and support status, and [release readiness](docs/oss/release.md) owns publication blockers.
