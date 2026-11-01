# Proof and Viewer Handoff

## Implementation authority

Use [model.ts](../../../../src/sdk/dom-motion/model.ts) and [validation.ts](../../../../src/sdk/dom-motion/validation.ts) instead of duplicating the JSON format. The document needs HTML, source viewport, Russian and English labels, bindings, and a numeric timeline with empty `phases`. Each root requires its own `assembly`. `page.assembly` is invalid.

Track IDs use `<target>.<property>`. Key times increase strictly. Easing belongs to the outgoing key. The last delayed descendant must finish within `duration`.

Parse through the [public entrypoint](../../../../src/sdk/dom-motion/index.ts). Then mount `createDomMotionSurface(host, input)` in a browser and wait for `surface.ready`. Valid JSON does not prove valid selectors or DOM structure. Each `selector` with optional `closest` must resolve to exactly one element. Roots must not nest. Dispose the surface after inspection.

The SDK also checks part-count limits after loading. It sanitizes HTML and does not execute source-site scripts. Check that fonts and embedded resources load. A rejected external resource must not leave missing content. Use a prepared static DOM state for dynamic applications and compare it with the source design before assembly.

## Motion proof

Record actual start and complete-settlement times for roots and descendants. Watch normal autoplay from start to end in the SDK. Inspect arrival, the first background settlement, its text settlement, overlapping waves, late buttons, the logo, and the final state. Frames and short video help assess rhythm. A still contact sheet does not prove smoothness.

Test arbitrary `render(time)` order, such as late frame, early frame, final frame, and the same late frame. Test viewer restart. The same time must produce the same geometry, styles, and image. Check that readiness prevents empty preview and autoplay advances time. Check browser errors and normal timeline access to layers and tracks.

Use `surface.bindingReads` to investigate unused tracks. Compare it with enabled tracks and selected layers.

Check these results from observed frames:

- Large panels fill the center early without an empty outline or isolated navigation.
- Parallel flows use different directions and visible depth. Assembly continues toward the end.
- Backgrounds gain opacity during travel and settle before content. Text does not emerge from one flat plane.
- Late actions and peripheral elements assemble individually. The logo moves continuously to its source position.
- Settled elements stay sharp and stable. White panels do not turn gray or flash. Edges do not expand. Scrollbars appear only at the end.

If playback becomes slow, measure actual playback and animated-node count. Reduce unnecessary small parts, excessive keys, and expensive blur while preserving intent. Do not promise a fixed frame rate from still images.

## Return to source CSS

Identify time `T` when the camera, bindings, and delayed descendants finish and the SDK restores original styles. Inspect `T − 0.2`, `T − 1/30`, `T − 0.001`, `T`, the next frame, and `duration`. Distinguish geometry completion from later scrollbar reveal. Include an exact failing frame and its neighbors in defect evidence.

Compare panel, row, button, and column positions and dimensions with the still reference. While the camera moves, compare coordinates in the page plane. Perspective screen bounds are not equivalent. Compare final geometry directly. A decorative background and its parent must finish with matching projections and no late relative-width change.

Overlay scrollbars can hide a gutter defect. For scrollable containers, repeat the transition with a real reserved gutter, such as `scrollbar-gutter: stable`. Check that the environment supplies nonzero scrollbar width. Compare source and animated states under identical conditions. Right columns must not shift before or after native scrollbars return. Do not conceal a shift with a final horizontal track.

For scroll-layout owner changes, inspect [browser regressions](../../../../tests/dom-motion-scroll-layout.test.ts), including RTL and box sizing. Check node and field-value preservation. Check restored styles on animated elements and ancestors. Compare a complete final screenshot.

Antialiasing and CSSOM may produce small raster or rounding differences. State the measured difference. Do not accept an unexplained error margin. Position, column width, color, or control-size changes require correction.

## Use the SDK viewer

The development catalog reads `.tmp/dom-motion/<id>.sniptale-dom-motion.json` through [local-dom-motion.ts](../../../../tooling/vite/local-dom-motion.ts). Parse before writing into that catalog. One invalid document can break the list. Do not escape its boundary through symlinks.

Use the running viewer or start `npm run dev` from the repository root. The [viewer](../../../../tooling/configs/vite/viewer.ts) and [sandbox](../../../../tooling/configs/vite/sandbox.ts) configurations currently use ports 4177 and 4178. Another demo server does not prove SDK integration. If startup fails, inspect its owned process and output. Do not change sandbox or system settings for authoring.

Open `http://127.0.0.1:<viewer-port>/?scene=<document-id>&autoplay=1&rev=<revision>`. Check document selection, nonempty preview, and advancing time. Use a fresh revision URL after catalog changes. Check viewer import, export, and reimport of the DOM document. Common toolbar buttons do not imply Canvas cache or MP4 support in this mode.

Keep evidence, browser output, and temporary generators under `.tmp/`. SDK, viewer, and tooling changes require the root `AGENTS.md` loop and applicable focused proof. A new animation alone does not require engine changes. Deliver the checked scene URL, document path, geometry and visual results, and concrete remaining limitations.
