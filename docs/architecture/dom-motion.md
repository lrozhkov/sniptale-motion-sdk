# Live HTML Scenes

`createDomMotionSurface(host, input)` accepts a separate `sniptale.dom-motion.v1` document. It parses the input with `parseDomMotionDocument`. The returned surface provides `ready`, `render(time)`, `setTimeline`, `setVisibleTargets`, and `dispose`. Wait for `ready` before rendering. Call `dispose` when the surface is no longer needed. Effect v1 documents retain their separate Canvas interpreter.

The document contains HTML, embedded styles and data resources, source dimensions, Russian and English labels, element bindings, and numeric keyframes. Each binding selects exactly one element through `selector` and optional `closest`. Binding roots must not contain each other. Optional `parts` selects semantic descendants, such as rows, headings, fields, and buttons. When selected descendants overlap, the outer element owns the animation.

The surface preserves original nodes, field values, and layout positions. It restores original `style` attributes after assembly and on disposal. It does not slice geometry, clone panels, or rasterize the page.

## Motion

The `page` target owns the camera. It supports `x`, `y`, `z`, `rotateX`, `rotateY`, `rotateZ`, `scale`, `opacity`, and `blur`. Each binding consumes its own `assembly` track between zero and one. `depth`, `lift`, and `spread` define approach depth, vertical travel, and horizontal travel. `stagger` defines descendant delays in seconds.

Delayed descendants consume the same track with a time offset. Leave enough time after the final assembly key for every descendant to finish. Interpolation and outgoing-key easing follow the Canvas timeline contract. Validation rejects phases, scenes, and motion paths in this document format.

During assembly, panel backgrounds gain opacity and descendants approach from separate depth levels. Background color alpha changes independently of panel opacity. Whole-panel opacity would flatten its 3D descendants. The assembled frame restores original backgrounds and styles.

`lift` and `spread` range from −2000 to 2000 pixels. Positive values enter from above or the left. Negative values enter from below or the right. Optional `tiltX`, `tiltY`, and `tiltZ` define initial panel angles within ±45 degrees. These angles approach zero during assembly.

Optional `partLift` defines descendant vertical travel independently of panel travel. It ranges from −2000 to 2000 pixels. Combined with `stagger`, it can assemble buttons through short sequential drops while their container stays still.

Optional `partDelay` delays descendants by zero to two seconds. Panels and backgrounds use the original time. Descendants use time shifted by `partDelay` and their `stagger`. Final style restoration includes both delays. A binding without descendants does not delay restoration for `partDelay`.

A binding can declare numeric `x`, `y`, `z`, `rotateX`, `rotateY`, `rotateZ`, and `scale` tracks for a separate trajectory. Each declared track replaces the corresponding assembly-derived component. Other components retain normal assembly behavior. Style restoration waits for descendants, the camera, and all binding trajectories. Validation rejects binding-wide `opacity` and `blur` because they flatten descendant depth.

Optional `page.scrollbarOpacity` controls native scrollbar color alpha between zero and one. It preserves scrollbar size and reserved layout space. One restores original scrollbar styles and is the default without a track. Spatial overflow does not create scrolling for the whole iframe.

## Isolation and viewer

HTML loads in an iframe with `sandbox="allow-same-origin"` and no script permission. Inert parsing removes active embeds, event handlers, and external resource URLs. CSP blocks scripts, network access, nested pages, and form submission. Imported HTML does not execute the source application's behavior.

Validation bounds document size, duration, bindings, tracks, and keys. After loading, the surface limits animated descendants to 256.

The viewer imports and exports `*.sniptale-dom-motion.json`. It uses live preview and the existing timeline, keyframes, layer visibility, and clips. This mode has no Canvas cache or MP4 export. The development catalog reads ignored documents under `.tmp/dom-motion/`. It rejects links that escape that directory.
