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

Create a project with the checked toolkit CLI and keep source documents under `effects/<effect-id>/effect.sniptale-effect.json`. Keep referenced assets in that effect directory, for example `effects/<effect-id>/assets/mark.svg`. `exports/` holds portable delivery files. `.tmp/` holds disposable proof and working output. Source documents are project data and must not be treated as disposable caches.

Treat the effect directory as the asset root. Asset paths use forward slashes and resolve relative to that root, without absolute prefixes, URL schemes, backslashes, or `..` traversal. Symlinks that resolve outside the root are rejected. `validate` materializes local assets and checks the document. `prove` additionally imports through the normal viewer and renders in the isolated sandbox.

The engine needs no source-code registry entry. Keep the implementation unchanged during effect authoring.

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

Use seconds for document duration, scene, clip, phase, track, and keyframe times. Use `progress` for normalized whole-effect progress from `0` to `1`. Use `time` for absolute effect seconds. `frameIndex` is the deterministic frame number at the host FPS. `duration` exposes total seconds.

Use top-left canvas coordinates: positive `x` moves right and positive `y` moves down. Read `width` and `height` from the render scope instead of assuming the preview size when layout should be responsive. The standard preview is commonly 1280×720, but the graph must tolerate the host output size.

Command geometry is local to the command. For a command with `layerId`, the runtime gates execution by layer visibility and clip activity. It multiplies command alpha by resolved layer opacity. It translates drawing by resolved layer `x` and `y`. Therefore a layer position and a command position are additive.

`x`, `y`, and `opacity` layer tracks are applied implicitly to styled commands with that `layerId`. Other layer properties must be read explicitly when the graph needs them.

## Assets

Declare at most 256 assets. Each local asset may contain at most 1,500,000 bytes, and the validation materializer accepts at most 24,000,000 bytes across the bundle. Declare an asset only when a layer or graph command references it.

Supported kinds and MIME types are:

- `image`: `image/png`, `image/jpeg`, or `image/webp`.
- `svg`: `image/svg+xml`.
- `audio`: `audio/mpeg`, `audio/ogg`, or `audio/wav`.

Prefer a local `path` while authoring. Validation checks the file signature, size, optional `byteLength`, and optional lowercase SHA-256 digest, then materializes the bytes for the runtime without rewriting the local document. Embedded raster/audio `dataUrl` and embedded SVG `svgText` are supported, but embedded content must include exact `byteLength` and `sha256`. SVG data URLs are forbidden because they cannot be inspected safely.

Keep SVG declarative and self-contained. Scripts, event handlers, external URLs, foreign executable content, and other unsafe markup are rejected. Use a sanitized file or `svgText`.

Render image and SVG assets with `image`. Render per-part vector animation with `svgParts`, which requires an SVG asset. Associate audio with an `audio` layer and a clip for playback/export. Do not pass audio to `image`.

Provide positive `width` and `height` metadata where meaningful for visual assets and positive `duration` for audio. Match the declared MIME to the real bytes. Renaming a file extension does not change its signature.

## Controls

Use `color`, `text`, or `number` controls. Every control requires `id`, `kind`, and `defaultValue`. Add a localized `label`. For a number control, optionally provide finite `min`, `max`, and positive `step`. Keep `min < max` and the default inside the range.

Set `group` to `content`, `typography`, `appearance`, `geometry`, `processing`, `animation`, or `advanced`. Optional document `controlGroups` defines up to 64 custom groups as `{ id, label, parentId, order?, icon?, collapsed? }`. `parentId` is a semantic root or another custom group. Keep IDs unique, do not redeclare roots, and keep at most four levels including the root. Use the existing `control.group` field for custom groups. Content and geometry descendants retain their semantic identity and remain protected from visual presets.

For number controls, declare meaningful units separately as `unit: "px" | "percent" | "s" | "ms" | "deg" | "ratio" | "count" | "hz"`. Values stay in their original scale: `percent` shows `%`, `deg` shows `°`, and `ratio` shows `×`. The UI does not multiply or divide values. Keep units out of every localized label. For example, use `label: { "ru": "Ширина", "en": "Width" }` with `unit: "px"`, rather than `Width (px)`.

Do not infer a dimension from an identifier or rescale an existing range to make a suffix look plausible. Existing unitless documents remain valid. `validate --authoring` additionally rejects explicit unit suffixes in numeric labels. It does not guess missing dimensions or add warnings to ordinary validation.

Choose `presentation: "auto" | "number" | "slider" | "text" | "textarea" | "dropdown" | "segmented" | "toggle" | "color"`. `number` and `slider` require number controls without options. `text` and `textarea` require text controls without options. `color` requires a color control. For number or text controls, `options` contains 2–64 unique `{ value, label, icon? }` choices matching the control kind, range and default.

`dropdown`, `segmented` and `toggle` require options. `segmented` allows at most eight choices and `toggle` exactly two. `auto` with options always uses a dropdown. A long list belongs in a dropdown. For example, use `presentation: "segmented"` with two or three short alignment choices rather than exposing an arbitrary number.

Controls, custom groups and options accept an optional semantic `icon`. Supported IDs are:

```text
text type font-size font-weight align-left align-center align-right align-justify palette fill
stroke opacity shadow blur position move size width height rotation
scale spacing corner-radius shape rectangle circle pointer anchor layers layout
list grid play pause clock timer duration speed repeat sparkles
settings sliders check x drawing tracing path easing motion mask
focus lens crop composition baseline decoration texture
```

Supply IDs only, never SVG, HTML, component names or code. Standard authoring assigns icons to groups and disclosures and keeps individual parameter rows and choices text-only. The stock viewer shows icons beside group headings, preserving their visible labels. Control and option icon metadata remains accepted and is preserved during round trips.

A nested group does not need an icon. Omit it if no registry icon accurately describes the group. Do not add groups or icons to every effect. Choose by meaning: `drawing` for drawing tools, `tracing` for progressive path drawing, `path` for path geometry or nodes, `easing` for interpolation, and `motion` for motion settings. Use `mask` for mask regions, `focus` for focus, `lens` for lens parameters, `crop` for cropping, `composition` for arrangement, `baseline` for text baseline, `decoration` for text decoration, and `texture` for surface texture.

Existing `stroke`, `fill`, `typography` group, and layout icons cover their named purposes. Use `pointer` only for pointer interaction. Do not use `pointer`, `sparkles`, or `settings` as generic filler. These are recommendations, not required icons. Use `hz` for cycles or updates per second (English `Hz`, Russian `Гц`).

Numeric `unit` describes the raw value scale: a ratio of 0.5 remains 0.5 with `ratio`, whereas 50 percent remains 50 with `percent`. A label or shown suffix does not convert the stored value.

Custom group icons must be unique across the document, including unused custom groups. Omitted icons reserve nothing. Used semantic roots reserve their icons: content `text`, typography `type`, appearance `palette`, geometry `shape`, processing `sliders`, animation `play`, and advanced `settings`. A control uses its semantic root through its parent chain. A control without `group` uses advanced.

Unused roots reserve nothing. A custom group must not reuse a reserved root icon. Validation reports `CONTROL_GROUP_ICON_DUPLICATE` at the conflicting custom group icon. For custom/custom collisions, the later group is rejected. Control and option icon metadata does not participate in this group-only rule.

JSON Schema validates structure. The runtime validator enforces icon uniqueness. Strict authoring/import is the default. SDK callers that replay a persisted snapshot can explicitly pass `{ presentationPolicy: "retained" }` to `validateEffectV1Document` or `parseEffectV1Source`. Only `CONTROL_GROUP_ICON_DUPLICATE` becomes a warning.

All structural and security rules remain enforced. The document remains unchanged, and the stock viewer hides duplicate group icons while retaining their labels. This replay mode does not make the snapshot acceptable for new strict authoring.

Read every declared control through `{ "op": "read", "path": "controls.<id>" }`. The proof changes controls away from their defaults and requires observable pixel changes. Do not expose a cosmetic control whose value never affects rendering.

Controls are user parameters, not animation state. Use tracks for time-keyed values and expressions for deterministic calculations.

## Layers and clips

Use layers to define authoring identity, hierarchy, visibility, editing bounds, base transform values, asset ownership, and the bridge between timeline values and graph commands. Supported layer types are `audio`, `customDraw`, `ellipse`, `group`, `imageAsset`, `line`, `path`, `rect`, `svgAsset`, and `text`.

Layer `name` is an optional plain string, not a locale map. Use locale maps only for fields whose schema explicitly accepts them, such as effect, scene, control and custom-group labels. Layer `fontFamily`, `fill`, `stroke`, `color`, `blendMode`, `partOrder` and `svgPartMode` are also plain strings. `svgPartIds` is an array of strings, and a scene `transition` is an object.

Every spatial layer type (`ellipse`, `imageAsset`, `line`, `path`, `rect`, `svgAsset`, and `text`) requires positive `width` and `height`. `audio`, `imageAsset`, and `svgAsset` require a matching `assetId`. A `text` layer requires `text`. Common numeric authoring properties include `x`, `y`, `anchorX`, `anchorY`, `rotation`, `scaleX`, `scaleY`, `opacity`, `blur`, sizes, typography, path trim, SVG-part values, and volume.

Use a layer `editor` object only to declare operations that the viewer may safely expose. `canvas` accepts `bounds`, `fullFrame`, or `none`. `operations` accepts `delete`, `duplicate`, and `reorder`. `transform` accepts `anchorX`, `anchorY`, `rotation`, `scaleX`, `scaleY`, `x`, and `y`. `properties` and `keyframeProperties` are string lists.

Use `parentId` only to place a layer below a structural `group`. Group layers organize the editor and do not render. They cannot own geometry, transforms, opacity, assets, editor capabilities, clips, or tracks. Do not confuse a layer with `type: "group"` and a graph command with `op: "group"`. The former is hierarchy metadata, while the latter saves canvas state and applies a runtime transform to child commands.

Use at most one clip per non-group layer. A clip gates the layer from `start` through `start + duration`, optionally associates it with `sceneId`, and offsets local layer time with `offset`. A command with `layerId` is skipped when the layer is hidden or outside its enabled clip. Omit clips only when the layer should remain active for the full effect.

## Scenes, phases, tracks, and motion paths

Declare at least one scene. For a simple effect, use one scene from `start: 0` across the full effect duration. Scene, clip, phase, and keyframe ranges must remain inside the effect duration. `enabled` gates runtime participation. `locked` is authoring state.

Use phases to name time intervals that gate tracks or keyframes. Every phase must be referenced by `track.phaseId` or `keyframe.phaseId`. An unreferenced phase is invalid. The timeline resolver applies phase progress, which can gate keyframe participation. The graph reads rendered values through tracks. It has no direct `phases.*` expression path.

Every track requires `id`, `property`, and a `keyframes` array. Keyframes require unique usable IDs, finite times in ascending order, and values. Supported easing names include `linear`, `in`, `out`, `inOut`, `hold`, and `bezier`. A bezier keyframe may provide finite `handles` values `x1`, `y1`, `x2`, and `y2`.

Read a general track with `{ "op": "read", "path": "tracks.<track-id>" }`. A track that is editable but never read is invalid. For a layer property track, use `id: "<layer-id>.<property>"`, `layerId: "<layer-id>"`, and matching `property`. The runtime resolves `anchorX`, `anchorY`, `blur`, `opacity`, `rotation`, `scaleX`, `scaleY`, `x`, and `y` into `layers.<layer-id>.<property>`. Styled commands implicitly observe only `x`, `y`, and `opacity`. Explicitly read the remaining properties into command fields when needed.

Use `timeline.motionPaths` to connect paired `<layer-id>.x` and `<layer-id>.y` track keyframes. Each motion point references one existing x keyframe ID and one existing y keyframe ID and may use `linear`, `corner`, or `smooth` plus finite incoming/outgoing tangents. The motion path layer must exist, and referenced coordinate tracks and keyframes must remain consistent.

## Closure and identity rules

Keep the document closed and observable:

- Reference only declared assets, layers, controls, tracks, phases, definitions, render passes, and kind-appropriate runtime inputs.
- Reference every declared asset from a layer or graph command.
- Read every declared control and general track from the graph.
- Attach every declared phase to a track or keyframe.
- Consume every required runtime input.
- Bind command `layerId` only to a declared non-group leaf layer.
- Keep IDs unique within their owner collection and keep keyframes ordered. The validator never silently fixes author data.

Use `program.definitions` for reusable expressions. Definition names must be safe lowercase-leading IDs, references use `defs.<id>`, and definition cycles are rejected.

## Unsupported content

Do not add executable or legacy fields such as `renderer`, `source`, `code`, `compiledJs`, `moduleId`, or `engineVersion` anywhere in the document. Do not use JavaScript, TypeScript, JSX, React, Three.js, R3F, WASM, dynamic import, network fetches, browser APIs, random numbers, wall-clock time, or external asset URLs. Runtime packages present elsewhere in the SDK are not Effect v1 authoring capabilities.

Do not create a manifest or pack for a single local effect. Do not change `package.json`, the generated schema, the sandbox registry, viewer startup, test fixtures, or build inputs to make the effect visible. Use direct import and proof.

## Acceptance contract

Require static validation with zero errors and zero warnings. Then require browser proof. It must import the document, materialize assets, and render nonblank frames. It must observe intended time variation, exercise every control, and cover bindings. It must isolate transient media, avoid stale sandbox responses, and avoid runtime recovery.

Treat proof success as a technical floor. Inspect visual samples at representative output sizes. Check the requested composition, safe text placement, readable contrast, and smooth timing. Check input ordering and transparent/opaque areas. Reject unwanted accumulated frames and clipping.
