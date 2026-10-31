# Effect v1 document and local bundle contract

## Contents

- [Local storage and engine ingestion](#local-storage-and-engine-ingestion)
- [Required document shape](#required-document-shape)
- [Effect kinds and runtime inputs](#effect-kinds-and-runtime-inputs)
- [Time and coordinate model](#time-and-coordinate-model)
- [Assets](#assets)
- [Controls](#controls)
- [Layers and clips](#layers-and-clips)
- [Scenes, phases, tracks, and motion paths](#scenes-phases-tracks-and-motion-paths)
- [Closure and identity rules](#closure-and-identity-rules)
- [Unsupported content](#unsupported-content)
- [Acceptance contract](#acceptance-contract)

## Local storage and engine ingestion

Create a project with the verified toolkit CLI and keep source documents under `effects/<effect-id>/effect.sniptale-effect.json`. Keep referenced assets in that effect directory, for example `effects/<effect-id>/assets/mark.svg`. `exports/` holds portable delivery files; `.tmp/` holds disposable proof and working output. Source documents are project data and must not be treated as disposable caches.

Treat the effect directory as the asset root. Asset paths use forward slashes and resolve relative to that root, without absolute prefixes, URL schemes, backslashes, or `..` traversal. Symlinks that resolve outside the root are rejected. `validate` materializes local assets and checks the document. `prove` additionally imports through the normal viewer and renders in the isolated sandbox. The engine needs no source-code registry entry. Keep the implementation unchanged during effect authoring.

Use these exact path relationships:

```text
effects/orbit-title/
├── effect.sniptale-effect.json
└── assets/
    ├── mark.svg
    ├── texture.webp
    └── hit.ogg
```

```json
{
  "assets": [
    {
      "id": "mark",
      "kind": "svg",
      "mimeType": "image/svg+xml",
      "path": "assets/mark.svg"
    }
  ]
}
```

Pass `effects/orbit-title` as `--asset-root` for that document.

## Required document shape

Use one strict UTF-8 JSON object without comments or trailing commas. Unknown fields are rejected at every validated boundary.

The root requires `schemaVersion`, `id`, `kind`, `duration`, `label`, `assets`, `controls`, `layers`, `clips`, `scenes`, `timeline`, and `program`. `description` and `presets` are optional. Use `schemaVersion: "sniptale.effect.v1"` exactly. Use a positive duration in seconds. Use identifiers that start with a letter and contain at most 128 letters, digits, `.`, `_`, or `-` characters.

Use this minimal topology for a standalone effect:

```json
{
  "assets": [],
  "clips": [],
  "controls": [],
  "description": { "ru": "Описание", "en": "Description" },
  "duration": 3,
  "id": "my-effect",
  "kind": "standalone",
  "label": { "ru": "Мой эффект", "en": "My effect" },
  "layers": [],
  "program": {
    "commands": [{ "color": "#10131d", "op": "clear" }],
    "kind": "graph",
    "version": 1
  },
  "scenes": [{ "duration": 3, "id": "main", "start": 0 }],
  "schemaVersion": "sniptale.effect.v1",
  "timeline": { "phases": [], "tracks": [] }
}
```

Require both `ru` and `en` in the root `label`. Use the same pair for authored visible metadata and control labels. Russian is the product source/default locale and English is required.

## Effect kinds and runtime inputs

| Kind | Host frames | Runtime registration | Typical use |
| --- | --- | --- | --- |
| `standalone` | none | composition | self-contained intro, title, overlay, procedural animation |
| `targetEffect` | `source` | effect | decorate, reveal, distort, frame, or annotate one selected target |
| `transition` | `from`, `to` | effect | crossfade, wipe, mask, split, or stylized scene change |

Consume a runtime frame only through an `image` command with `input`. A target effect must consume `source`. A transition must consume both `from` and `to`. A standalone effect cannot consume runtime input and must use declared assets or procedural drawing. An `image` command must select exactly one of `assetId` and `input`.

Preview files selected for `source`, `from`, and `to` are host session state. Never add their paths, names, bytes, controls, clips, assets, history entries, or exported effect data to the document.

## Time and coordinate model

Use seconds for document duration, scene, clip, phase, track, and keyframe times. Use `progress` for normalized whole-effect progress from `0` to `1`; use `time` for absolute effect seconds. `frameIndex` is the deterministic frame number at the host FPS. `duration` exposes total seconds.

Use top-left canvas coordinates: positive `x` moves right and positive `y` moves down. Read `width` and `height` from the render scope instead of assuming the preview size when layout should be responsive. The standard preview is commonly 1280×720, but the graph must tolerate the host output size.

Command geometry is local to the command. When a command has `layerId`, the runtime gates it by layer visibility and clip activity, multiplies command alpha by resolved layer opacity, and translates drawing by resolved layer `x` and `y`. Therefore a layer position and a command position are additive. `x`, `y`, and `opacity` layer tracks are applied implicitly to styled commands with that `layerId`; other layer properties must be read explicitly when the graph needs them.

## Assets

Declare at most 256 assets. Each local asset may contain at most 1,500,000 bytes, and the validation materializer accepts at most 24,000,000 bytes across the bundle. Declare an asset only when a layer or graph command references it.

Supported kinds and MIME types are:

- `image`: `image/png`, `image/jpeg`, or `image/webp`.
- `svg`: `image/svg+xml`.
- `audio`: `audio/mpeg`, `audio/ogg`, or `audio/wav`.

Prefer a local `path` while authoring. Validation verifies the file signature, size, optional `byteLength`, and optional lowercase SHA-256 digest, then materializes the bytes for the runtime without rewriting the local document. Embedded raster/audio `dataUrl` and embedded SVG `svgText` are supported, but embedded content must include exact `byteLength` and `sha256`. SVG data URLs are forbidden because they cannot be inspected safely.

Keep SVG declarative and self-contained. Scripts, event handlers, external URLs, foreign executable content, and other unsafe markup are rejected. Use a sanitized file or `svgText`.

Render image and SVG assets with `image`. Render per-part vector animation with `svgParts`, which requires an SVG asset. Associate audio with an `audio` layer and a clip for playback/export; do not pass audio to `image`.

Provide positive `width` and `height` metadata where meaningful for visual assets and positive `duration` for audio. Match the declared MIME to the real bytes; renaming a file extension does not change its signature.

## Controls

Use `color`, `text`, or `number` controls. Every control requires `id`, `kind`, and `defaultValue`. Add a localized `label`. For a number control, optionally provide finite `min`, `max`, and positive `step`; keep `min < max` and the default inside the range.

Read every declared control through `{ "op": "read", "path": "controls.<id>" }`. The proof changes controls away from their defaults and requires observable pixel changes. Do not expose a cosmetic control whose value never affects rendering.

Controls are user parameters, not animation state. Use tracks for time-keyed values and expressions for deterministic calculations.

## Layers and clips

Use layers to define authoring identity, hierarchy, visibility, editing bounds, base transform values, asset ownership, and the bridge between timeline values and graph commands. Supported layer types are `audio`, `customDraw`, `ellipse`, `group`, `imageAsset`, `line`, `path`, `rect`, `svgAsset`, and `text`.

Every spatial layer type (`ellipse`, `imageAsset`, `line`, `path`, `rect`, `svgAsset`, and `text`) requires positive `width` and `height`. `audio`, `imageAsset`, and `svgAsset` require a matching `assetId`. A `text` layer requires `text`. Common numeric authoring properties include `x`, `y`, `anchorX`, `anchorY`, `rotation`, `scaleX`, `scaleY`, `opacity`, `blur`, sizes, typography, path trim, SVG-part values, and volume.

Use a layer `editor` object only to declare operations that the viewer may safely expose. `canvas` accepts `bounds`, `fullFrame`, or `none`; `operations` accepts `delete`, `duplicate`, and `reorder`; `transform` accepts `anchorX`, `anchorY`, `rotation`, `scaleX`, `scaleY`, `x`, and `y`; `properties` and `keyframeProperties` are string lists.

Use `parentId` only to place a layer below a structural `group`. Group layers organize the editor and do not render. They cannot own geometry, transforms, opacity, assets, editor capabilities, clips, or tracks. Do not confuse a layer with `type: "group"` and a graph command with `op: "group"`; the former is hierarchy metadata, while the latter saves canvas state and applies a runtime transform to child commands.

Use at most one clip per non-group layer. A clip gates the layer from `start` through `start + duration`, optionally associates it with `sceneId`, and offsets local layer time with `offset`. A command with `layerId` is skipped when the layer is hidden or outside its enabled clip. Omit clips only when the layer should remain active for the full effect.

## Scenes, phases, tracks, and motion paths

Declare at least one scene. For a simple effect, use one scene from `start: 0` across the full effect duration. Scene, clip, phase, and keyframe ranges must remain inside the effect duration. `enabled` gates runtime participation; `locked` is authoring state.

Use phases to name time intervals that gate tracks or keyframes. Every phase must be referenced by `track.phaseId` or `keyframe.phaseId`; an unreferenced phase is invalid. Phase progress is applied by the timeline resolver and can gate keyframe participation, but the graph reads rendered values through tracks rather than through a direct `phases.*` expression path.

Every track requires `id`, `property`, and a `keyframes` array. Keyframes require unique usable IDs, finite times in ascending order, and values. Supported easing names include `linear`, `in`, `out`, `inOut`, `hold`, and `bezier`; a bezier keyframe may provide finite `handles` values `x1`, `y1`, `x2`, and `y2`.

Read a general track with `{ "op": "read", "path": "tracks.<track-id>" }`. A track that is editable but never read is invalid. For a layer property track, use `id: "<layer-id>.<property>"`, `layerId: "<layer-id>"`, and matching `property`. The runtime resolves `anchorX`, `anchorY`, `blur`, `opacity`, `rotation`, `scaleX`, `scaleY`, `x`, and `y` into `layers.<layer-id>.<property>`. Styled commands implicitly observe only `x`, `y`, and `opacity`; explicitly read the remaining properties into command fields when needed.

Use `timeline.motionPaths` to connect paired `<layer-id>.x` and `<layer-id>.y` track keyframes. Each motion point references one existing x keyframe ID and one existing y keyframe ID and may use `linear`, `corner`, or `smooth` plus finite incoming/outgoing tangents. The motion path layer must exist, and referenced coordinate tracks and keyframes must remain consistent.

## Closure and identity rules

Keep the document closed and observable:

- Reference only declared assets, layers, controls, tracks, phases, definitions, render passes, and kind-appropriate runtime inputs.
- Reference every declared asset from a layer or graph command.
- Read every declared control and general track from the graph.
- Attach every declared phase to a track or keyframe.
- Consume every required runtime input.
- Bind command `layerId` only to a declared non-group leaf layer.
- Keep IDs unique within their owner collection and keep keyframes ordered; the validator never silently fixes author data.

Use `program.definitions` for reusable expressions. Definition names must be safe lowercase-leading IDs, references use `defs.<id>`, and definition cycles are rejected.

## Unsupported content

Do not add executable or legacy fields such as `renderer`, `source`, `code`, `compiledJs`, `moduleId`, or `engineVersion` anywhere in the document. Do not use JavaScript, TypeScript, JSX, React, Three.js, R3F, WASM, dynamic import, network fetches, browser APIs, random numbers, wall-clock time, or external asset URLs. Runtime packages present elsewhere in the SDK are not Effect v1 authoring capabilities.

Do not create a manifest or pack for a single local effect. Do not modify `package.json`, the generated schema, the sandbox registry, viewer startup, test fixtures, or build inputs to make the effect visible. Use direct import and proof.

## Acceptance contract

Require static validation with zero errors and zero warnings. Then require browser proof to import the document, materialize assets, render nonblank frames, observe intended time variation, exercise every control, cover bindings, isolate transient media, avoid stale sandbox responses, and avoid runtime recovery.

Treat proof success as a technical floor. Inspect visual samples for the requested composition, safe text placement, readable contrast, smooth timing, no unwanted accumulated frames, correct input ordering, correct transparent/opaque areas, and no clipping at representative output sizes.
