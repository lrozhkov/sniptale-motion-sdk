# Effect v1 authoring patterns

## Contents

- [Start from the generated document](#start-from-the-generated-document)
- [Responsive placement](#responsive-placement)
- [Entrance, hold, and exit](#entrance-hold-and-exit)
- [Control-driven styling](#control-driven-styling)
- [Timeline-driven layer motion](#timeline-driven-layer-motion)
- [Target effect composition](#target-effect-composition)
- [Transition composition](#transition-composition)
- [Local asset usage](#local-asset-usage)
- [Bounded repeated geometry](#bounded-repeated-geometry)
- [Offscreen glow](#offscreen-glow)
- [Common invalid designs](#common-invalid-designs)
- [Review checklist](#review-checklist)

## Start from the generated document

Generate the final local document instead of writing the root contract from memory:

```bash
sniptale-motion new orbit-title --kind standalone
```

The starter consumes required runtime inputs for `targetEffect` and `transition`. It declares a visible control and connects leaf layers to clips. Its graph passes validation. Replace its visual design while preserving any still-needed closure relationships.

Keep the starter's full-duration `main` scene unless the concept truly needs multiple scenes. Remove a starter control, layer, or clip together with all of its uses. Partial deletion produces explicit closure errors.

## Responsive placement

Derive canvas-relative positions from frame reads. This shape stays centered at any output size:

```json
{
  "op": "shape",
  "shape": "circle",
  "width": 160,
  "height": 160,
  "x": {
    "op": "sub",
    "args": [
      { "op": "mul", "args": [{ "op": "read", "path": "width" }, 0.5] },
      80
    ]
  },
  "y": {
    "op": "sub",
    "args": [
      { "op": "mul", "args": [{ "op": "read", "path": "height" }, 0.5] },
      80
    ]
  },
  "fill": "#5f7cff"
}
```

Treat shape and image `x`, `y` as top-left coordinates. Treat text `x`, `y` according to its alignment and baseline. Use centered text with `align: "center"` and `baseline: "middle"` when anchoring to the frame center.

## Entrance, hold, and exit

Build a three-part envelope from global progress. For example, reveal during the first 20%, hold, and fade during the last 20%:

```json
{
  "op": "mul",
  "args": [
    {
      "op": "out",
      "args": [
        {
          "op": "clamp",
          "args": [
            { "op": "mul", "args": [{ "op": "read", "path": "progress" }, 5] },
            0,
            1
          ]
        }
      ]
    },
    {
      "op": "out",
      "args": [
        {
          "op": "clamp",
          "args": [
            {
              "op": "mul",
              "args": [
                { "op": "sub", "args": [1, { "op": "read", "path": "progress" }] },
                5
              ]
            },
            0,
            1
          ]
        }
      ]
    }
  ]
}
```

Place the envelope in `program.definitions` as `visibility` and read `defs.visibility` from command `alpha` when several commands share it. Keep definitions independent of loop-local values because they are cached once per frame.

## Control-driven styling

Declare a real user parameter:

```json
{
  "id": "accent",
  "kind": "color",
  "defaultValue": "#5f7cff",
  "label": { "ru": "Акцент", "en": "Accent" }
}
```

Read it directly into visible paint:

```json
{
  "op": "shape",
  "shape": "roundRect",
  "x": 120,
  "y": 260,
  "width": 1040,
  "height": 200,
  "radius": 32,
  "fill": { "op": "read", "path": "controls.accent" }
}
```

Use number controls for strength, size, count-independent spread, or intensity. Keep loop counts literal even when a control changes how visible each repeated element becomes. Use text controls as the `text` expression and give text enough responsive width for proof variants.

## Timeline-driven layer motion

Declare a leaf layer with base geometry and bind the command to it:

```json
{
  "id": "card",
  "name": "Card",
  "type": "rect",
  "width": 520,
  "height": 180,
  "x": 0,
  "y": 0,
  "opacity": 1
}
```

Add a matching x track:

```json
{
  "id": "card.x",
  "layerId": "card",
  "property": "x",
  "keyframes": [
    { "id": "card-x-in", "time": 0, "value": -560, "easing": "out" },
    { "id": "card-x-hold", "time": 0.7, "value": 0, "easing": "linear" }
  ]
}
```

Use `layerId: "card"` on a styled command. The runtime applies `card.x` automatically as a layer translation. Keep the command's own x position at its intended local coordinate. Do not copy the same track read into command `x` or the movement doubles.

Use `id: "card.opacity"` and property `opacity` for implicit opacity. For rotation, either read `tracks.card.rotation` directly into a command `rotation`, or declare the canonical layer track and read `layers.card.rotation`. Layer rotation is resolved but not applied automatically to arbitrary commands.

## Target effect composition

Draw the host `source` first and add decorations afterward:

```json
[
  { "op": "clear" },
  {
    "op": "image",
    "input": "source",
    "x": 0,
    "y": 0,
    "width": { "op": "read", "path": "width" },
    "height": { "op": "read", "path": "height" },
    "fit": "cover"
  },
  {
    "op": "fillRect",
    "x": 0,
    "y": 0,
    "width": { "op": "read", "path": "width" },
    "height": { "op": "read", "path": "height" },
    "fill": "rgba(16, 19, 29, 0.22)",
    "blend": "screen"
  }
]
```

Use `contain` when every source pixel must remain visible, `cover` for full-bleed framing, and `fill` only when distortion is acceptable. Do not declare `source` as an asset.

## Transition composition

Use `progress` to crossfade host frames:

```json
[
  { "op": "clear" },
  {
    "op": "image",
    "input": "from",
    "x": 0,
    "y": 0,
    "width": { "op": "read", "path": "width" },
    "height": { "op": "read", "path": "height" },
    "fit": "cover",
    "alpha": { "op": "sub", "args": [1, { "op": "read", "path": "progress" }] }
  },
  {
    "op": "image",
    "input": "to",
    "x": 0,
    "y": 0,
    "width": { "op": "read", "path": "width" },
    "height": { "op": "read", "path": "height" },
    "fit": "cover",
    "alpha": { "op": "read", "path": "progress" }
  }
]
```

For a wipe, keep `from` full-frame and put the `to` image inside a rectangular `clip` whose width is `width * easedProgress`. For a split, use two clips. For a zoom transition, use responsive image dimensions and center offsets. Always render both input commands so closure and runtime proof observe both frames.

## Local asset usage

Place a file at `effects/orbit-title/assets/mark.svg` and declare:

```json
{
  "id": "mark",
  "kind": "svg",
  "mimeType": "image/svg+xml",
  "path": "assets/mark.svg",
  "width": 512,
  "height": 512
}
```

Render it with exactly one source:

```json
{
  "op": "image",
  "assetId": "mark",
  "x": 96,
  "y": 96,
  "width": 180,
  "height": 180,
  "fit": "contain"
}
```

Run validation with `--asset-root effects/orbit-title`. The validator calculates materialized integrity metadata in memory. Do not manually embed a large data URL unless the delivery format specifically requires a single file.

For SVG choreography, replace `image` with `svgParts` and use a preset:

```json
{
  "op": "svgParts",
  "assetId": "mark",
  "x": 96,
  "y": 96,
  "width": 360,
  "height": 360,
  "part": {
    "kind": "preset",
    "mode": "assemble",
    "order": "center",
    "ease": "out",
    "reveal": { "op": "read", "path": "progress" },
    "spread": 140,
    "stagger": 0.45
  }
}
```

## Bounded repeated geometry

Create deterministic particles with a literal loop count and arithmetic from `vars.index`:

```json
{
  "op": "forRange",
  "count": 24,
  "indexVar": "particle",
  "commands": [
    {
      "op": "shape",
      "shape": "circle",
      "width": 8,
      "height": 8,
      "x": {
        "op": "add",
        "args": [
          160,
          { "op": "mul", "args": [{ "op": "read", "path": "vars.particle" }, 36] }
        ]
      },
      "y": {
        "op": "add",
        "args": [
          360,
          {
            "op": "mul",
            "args": [
              { "op": "sin", "args": [{ "op": "read", "path": "vars.particle" }] },
              80
            ]
          }
        ]
      },
      "fill": "#ffffff"
    }
  ]
}
```

Animate the phase by adding `time` or `progress` inside the sine argument. Do not call random or change the literal count across frames. For irregular stable placement, use a literal `forEach.items` array of point objects.

## Offscreen glow

Draw bright geometry into a pass and composite it twice:

```json
[
  {
    "op": "renderPass",
    "id": "mark-pass",
    "commands": [
      {
        "op": "shape",
        "shape": "circle",
        "x": 560,
        "y": 280,
        "width": 160,
        "height": 160,
        "fill": "#5f7cff"
      }
    ]
  },
  {
    "op": "compositePass",
    "passId": "mark-pass",
    "blend": "screen",
    "alpha": 0.7,
    "filter": { "blur": 24 }
  },
  { "op": "compositePass", "passId": "mark-pass" }
]
```

Every pass is frame-local. Use repeated compositing for glow, not for stateful trails across frames.

## Common invalid designs

- Declaring a control, track, phase, asset, or runtime input without a visible graph use.
- Adding an asset file beside the JSON but omitting it from `assets`, or declaring it without referencing it.
- Passing both `assetId` and `input` to `image`, or passing neither.
- Using `source` in a standalone effect, `from` in a target effect, or only one transition input.
- Using a group layer as a command `layerId`, clip owner, or track target.
- Giving a structural group geometry or transforms.
- Applying the same x/y motion through both a canonical layer track and a command expression.
- Assuming layer rotation, scale, anchor, or blur is automatically applied to graph drawing.
- Creating a phase that gates nothing or a track that the graph never reads.
- Writing unsorted keyframes and expecting runtime normalization to repair author data.
- Using dynamic, empty, or oversized loops.
- Embedding an SVG data URL, unsafe SVG markup, mismatched MIME, or an asset path outside the effect root.
- Adding a JavaScript renderer or editing SDK files because a desired graph operation is missing.

## Review checklist

Before validation, check the kind and required inputs. Check one full-duration scene or intentional scene ranges. Check closed IDs, localized visible labels, and safe relative assets. Check bounded loops, responsive geometry, and explicit layer/command ownership.

After static validation, check that every control variant should change pixels. Check that the graph reads every general track and uses every asset. Every phase must gate animation. Transparent or opaque clearing must match the host composition.

After runtime proof, inspect the first, middle, and last frames plus entrance/exit boundaries. Check source/to ordering, text overflow, edge clipping, blend buildup, output-size assumptions, abrupt easing, invisible controls, and unintended black or transparent backgrounds.
