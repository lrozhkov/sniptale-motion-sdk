# Effect v1 graph runtime

## Contents

- [Program model](#program-model)
- [Frame reads](#frame-reads)
- [Expressions](#expressions)
- [Drawing commands](#drawing-commands)
- [Control-flow commands](#control-flow-commands)
- [Paths and paints](#paths-and-paints)
- [Styles and transforms](#styles-and-transforms)
- [SVG part animation](#svg-part-animation)
- [Render passes](#render-passes)
- [Deterministic limits](#deterministic-limits)
- [Design rules](#design-rules)

## Program model

Use only this program envelope:

```json
{
  "kind": "graph",
  "version": 1,
  "definitions": {},
  "commands": []
}
```

The sandbox creates a fresh transparent canvas for every frame and executes commands in array order. Use `clear` with a color for an opaque background or without a color to reset to transparency. Commands may contain literal JSON values or declared expression objects. The runtime never executes authored source code.

Use `definitions` to name reusable expressions that do not depend on loop-local `item` or `vars` values. Read a definition with `defs.<id>`. Definitions are evaluated lazily once per frame and cached, so do not expect re-evaluation under different loop scopes.

## Frame reads

Use `{ "op": "read", "path": "..." }` with only these path families:

- `read`: resolve one declared frame-scope path.

- `time`: absolute effect seconds.
- `progress`: normalized whole-effect progress from `0` to `1`.
- `width`, `height`: logical output dimensions.
- `frameIndex`: deterministic host frame index.
- `duration`: total effect seconds.
- `controls.<id>`: current declared control value.
- `tracks.<id>`: interpolated declared track value, with runtime fallback `0`.
- `layers.<id>` or `layers.<id>.<property>`: resolved leaf layer state or nested property.
- `vars.<name>` or a nested member: a value created by `let` or a loop.
- `item` or `item.<property>`: current literal loop item.
- `defs.<id>`: a declared program definition.
- `input.source`, `input.from`, `input.to`: kind-appropriate transient frames. Use these reads only when a calculation needs frame identity; render frames with `image.input`.

Unknown references and unavailable runtime inputs fail validation. Prefer `progress` for animations that should scale with duration and `time` for physically timed cycles.

## Expressions

Use primitive numbers, booleans, strings, and `null` directly. Use an expression object for computed values. Each expression may contain only `op` and its required `args`, `value`, `values`, `fallback`, or `path` fields.

Arithmetic and numeric operations:

- `add` and `mul`: 1–64 arguments.
- `sub`, `div`, `mod`, and `pow`: exactly 2 arguments. Division and modulo by zero deterministically return `0`.
- `neg`, `abs`, `floor`, `sqrt`, `exp`, `sin`, and `cos`: exactly 1 argument. Trigonometric angles are radians.
- `min` and `max`: 1–64 arguments.
- `clamp`: `[value, min, max]`.
- `mix`: `[from, to, amount]` without implicit clamping.

Logic and selection operations:

- `eq`, `lt`, `lte`, `gt`, and `gte`: exactly 2 arguments.
- `and` and `or`: 1–64 arguments.
- `not`: exactly 1 argument.
- `select`: use `value` as the condition and exactly two `values`, returning the first for truthy and the second for falsey.
- `fallback`: use `value` and `fallback`; substitute only when the primary value is nullish or a non-finite number.

Formatting and easing operations:

- `concat`: join 1–64 evaluated arguments as strings.
- `rgba`: `[red, green, blue]` or `[red, green, blue, alpha]`; channels are clamped and RGB is rounded.
- `out`: cubic ease-out for one normalized argument.
- `inOut`: cubic ease-in-out for one normalized argument.

Geometry operations:

- `point`: `[x, y]`, producing `{ "x": ..., "y": ... }`.
- `cubicPoint`: `[p0, p1, p2, p3, t]`, producing a point on a cubic Bézier.
- `cubicTangent`: `[p0, p1, p2, p3, t]`, producing its tangent vector.
- `ellipsePoint`: `[centerX, centerY, radiusX, radiusY, angle]`.
- `ellipseVelocity`: `[centerX, centerY, radiusX, radiusY, angle]`; center inputs are accepted for signature consistency while the result is the tangent vector.

Nest expressions no deeper than 32 levels. Use finite literal numbers. Use `let` or `definitions` to flatten repeated deep expressions.

Example responsive center point:

```json
{
  "op": "point",
  "args": [
    { "op": "mul", "args": [{ "op": "read", "path": "width" }, 0.5] },
    { "op": "mul", "args": [{ "op": "read", "path": "height" }, 0.5] }
  ]
}
```

## Drawing commands

Use the following drawing operations. Fields named as required must be present.

- `clear`: optionally provide `color` as a paint. Reset the full canvas independently of current transforms.
- `fillRect`: require `fill`, `x`, `y`, `width`, and `height`. Draw an axis-aligned rectangle.
- `shape`: require `shape`, `x`, `y`, `width`, and `height`. Choose `rect`, `roundRect`, `circle`, `ellipse`, or `diamond`; optionally provide `radius`, `rotation`, `fill`, `stroke`, and `lineWidth`.
- `text`: require `text`, `x`, and `y`. Optionally provide `fill`, `fontFamily`, `fontSize`, `fontWeight`, `fontStyle` (`normal`, `italic`, `oblique`), `align` (`left`, `right`, `center`, `start`, `end`), `baseline`, `maxWidth`, `reveal`, and `caret`. `reveal` clips horizontal text reveal from `0` to `1`; `caret` draws during partial reveal.
- `image`: require `x`, `y`, `width`, and `height`, plus exactly one `assetId` or `input`. Choose fit `contain`, `cover`, or `fill`; optionally rotate.
- `path`: require exactly one of `points` or `segments`. Provide `fill` and/or `stroke`, plus optional `closed`, `lineWidth`, `lineCap`, and `lineJoin`.
- `polyline`: require `points` and `stroke`. Optionally use normalized `progress` to reveal the line, plus `lineWidth`, `lineCap`, and `lineJoin`.
- `sampledPath`: require `from`, `to`, `samples`, `x`, `y`, and `stroke`. Evaluate `x` and `y` for each literal sample using `vars.<sampleVar>`; default the variable name to `sample`. Use 2–256 samples.
- `svgParts`: require an SVG `assetId`, `x`, `y`, `width`, and `height`. Optionally provide a per-part transform.

Every command also accepts optional `layerId` for layer gating and binding. Do not use a structural group layer ID.

## Control-flow commands

Use `group` with nonempty `commands` to save canvas state, apply optional `x`, `y`, `rotation`, `scaleX`, `scaleY`, alpha/style, execute children, and restore state.

Use `clip` with `x`, `y`, `width`, `height`, and nonempty `commands` to restrict child drawing to a rectangle.

Use `when` with `condition` and nonempty `commands` for deterministic conditional rendering.

Use `let` with a nonempty `bindings` object and nonempty `commands` to create sequential local values. Later bindings can read earlier ones through `vars.<name>`. The previous scope is restored after the children.

Use literal bounded loops only:

- `forRange`: provide integer `count` from 1 to 512 and nonempty `commands`. Read the value through `vars.<indexVar>` and the zero-based iteration through `vars.index`; the default variable is `index`.
- `forGrid`: provide integer `rows` and `columns`, each from 1 to 512, whose product remains within the loop budget. Read default `vars.row`, `vars.column`, and `vars.index`, or choose safe `rowVar` and `columnVar` names.
- `forEach`: provide a nonempty literal `items` array and nonempty `commands`. Read the current item with `item` or `item.<property>`. Set `itemVar` to expose the item through `vars.<itemVar>`; `vars.index` always contains the zero-based iteration.
- `stableOrderBy`: provide nonempty literal `items`, a numeric `key` expression, optional `direction` `asc` or `desc`, and nonempty `commands`. Equal keys preserve source order.

Do not derive loop length from controls, tracks, assets, input, or time. Animate values inside a statically sized loop.

## Paths and paints

Use a `points` path for a polyline or polygon with at least two `{ "x", "y" }` expression points. Use `segments` for curves and compound geometry. Supported segments are:

- `moveTo` and `lineTo`: `x`, `y`.
- `quadraticTo`: `cpx`, `cpy`, `x`, `y`.
- `cubicTo`: `cp1x`, `cp1y`, `cp2x`, `cp2y`, `x`, `y`.
- `arc`: `centerX`, `centerY`, `radius`, `start`, `end`, optional `counterclockwise`.
- `ellipse`: `centerX`, `centerY`, `radiusX`, `radiusY`, `rotation`, `start`, `end`, optional `counterclockwise`.
- `rect`: `x`, `y`, `width`, `height`.
- `roundRect`: `x`, `y`, `width`, `height`, `radius`.

Use `lineCap` values `butt`, `round`, or `square`; use `lineJoin` values `bevel`, `miter`, or `round`.

Use a color string or color expression as paint. Use `linearGradient` with `x0`, `y0`, `x1`, `y1`, and nonempty `stops`. Use `radialGradient` with those fields plus `r0` and `r1`. Each stop has an expression `offset` and `color`; keep offsets in visual order within `[0, 1]`.

## Styles and transforms

Styled drawing commands accept `alpha`, `blend`, `filter`, and `shadow`. Blend supports `source-over`, `screen`, and `lighter`. Filter supports expression fields `blur`, `brightness`, and `saturate`. Shadow supports `color`, `blur`, `x`, and `y`.

Use command alpha from `0` to `1` by convention. The runtime multiplies it by resolved layer opacity. Filters clamp blur, brightness, and saturation to nonnegative runtime values. Shadow and blur scale with logical canvas resolution.

Apply transforms deliberately. `shape` and `image` rotate around their centers. `group` applies translation, then rotation, then scaling to its children. Commands with a layer translate by resolved layer `x` and `y`; they do not automatically apply layer rotation, scale, anchor, or blur. Read those resolved properties and pass them to an appropriate command or group when needed.

## SVG part animation

Use `svgParts` when individual SVG shapes must reveal, scatter, assemble, shatter, blur, rotate, or scale. The SVG asset must be sanitized and declared.

Use a preset part transform with `kind: "preset"`. Choose optional `mode` `assemble`, `scatter`, or `shatter`; `order` `document`, `reverse`, `center`, `edges`, or `random`; `ease` `linear`, `out`, or `inOut`; and expression values such as `reveal`, `spread`, `stagger`, `blur`, `rotate`, `angle`, and `scaleFrom`.

Use a custom part transform with `kind: "custom"` and expression fields `x`, `y`, `rotate`, `scale`, `alpha`, `blur`, `originX`, and `originY`. During evaluation, `item.index`, `item.cx`, `item.cy`, and other provided part metadata are available. Prefer preset mode unless the desired choreography needs explicit formulas.

The preset `random` order is engine-stable, not `Math.random`; it remains deterministic for the same SVG part set.

## Render passes

Use `renderPass` with a unique `id`, nonempty `commands`, and optional `width` and `height` to draw into an offscreen canvas. Use `compositePass` with the matching `passId` to place the result, optionally with `x`, `y`, `width`, `height`, `rotation`, alpha, blend, filter, and shadow.

Declare every pass exactly once. A composite cannot reference an unknown pass. Use passes for reusable blurs, glows, trails assembled within one frame, masks approximated by composition, or drawing at a reduced internal resolution. Remember that every output frame starts fresh; a render pass does not persist across frames.

## Deterministic limits

Keep graph depth at or below 32, graph nodes at or below 4096, each loop bound at or below 512, and expanded commands at or below 50,000. Keep sampled paths at 2–256 samples and expression nesting at or below 32. Keep all numeric literals finite.

The validator rejects dynamic loop bounds, unknown fields, missing child commands, empty literal item sets, unsafe variable names, cyclic definitions, duplicate render passes, undeclared references, and expanded graphs beyond the budget.

Do not use randomness, system time, mutable cross-frame state, storage, network, DOM, browser APIs, or external modules. Create deterministic variation from literal item data, `frameIndex`, trigonometric functions, stable ordering, and stable SVG part metadata.

## Design rules

Start with the smallest graph that proves the visual idea. Add layers only for authoring or timeline ownership, controls only for real user choices, and passes only when direct drawing cannot express the composition cleanly.

Use `progress` with `out` or `inOut` for entrances and exits. Clamp derived opacity, reveal, scale, and normalized positions. Keep text within responsive safe margins derived from `width` and `height`. Use explicit `clear` behavior to decide whether the result is opaque or composited over host media.

For a transition, draw `from` before `to` unless the design intentionally reverses their stacking. For a target effect, draw `source` before decorations. For standalone transparent overlays, clear without a color and ensure proof still sees nonblank output.

Wire declared bindings into visible pixels. A syntactically read control or track that has no meaningful visual effect may pass part of static closure but fail runtime proof when variants produce identical frames.
