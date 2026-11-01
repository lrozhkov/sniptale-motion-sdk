# Page Assembly Choreography

## Intent and pacing

The default intent combines a camera flyby, visible depth, overlapping events, and an exact final layout. A cinematic label does not replace frame inspection. Choose one visual accent. Relate camera motion to assembly. The camera arc and viewing angle remain creative choices.

One or two large content panels should occupy the center early. Avoid a long empty outline, isolated back button, or decorative-only opening. Navigation should arrive with its heading or context.

This six-second example defines overlapping windows, not mandatory times:

| Time | Event |
| --- | --- |
| 0–1.8 s | Start the flyby. Two large panels fill the center. Backgrounds settle before content. |
| 1.2–3.5 s | Supporting panels arrive in parallel waves from different directions. |
| 3–4.8 s | Lower and side sections, heading context, and peripheral elements assemble in short sequences. |
| 4.1–5.5 s | Top actions drop into place one button at a time. The logo follows its own continuous path. |
| 5.5–6 s | Geometry and sharpness settle. Native scrollbars appear. Hold a short readable final state. |

Plan new visible events through most of the duration. Do not finish the interface halfway through and leave only camera rotation. Avoid simultaneous arrival of every element or a strict queue of every section. Small overlapping groups can preserve a clear hierarchy of attention.

## Arrival geometry

Elements enter from outside the frame or from clearly distant perspective. Check the actual initial position against the camera and block size. A large `x` or `z` value alone does not prove that the element is offscreen. Increase visibility during travel instead of revealing a finished element in the center.

Alternate left, right, top, bottom, and diagonal approaches. Relate travel length, initial tilt, and depth to each element's role and visual weight. Content approaches from the viewer's side above its background. It then settles toward that background. Text must not appear to emerge from inside a flat white panel.

Use `depth`, `lift`, `spread`, and `tilt*` for normal panels. Use binding geometry tracks for individual paths. Each supplied track replaces its normal assembly component. Check combinations against [pose.ts](../../../../src/sdk/dom-motion/pose.ts) and [surface.ts](../../../../src/sdk/dom-motion/surface.ts). Numeric keys must produce continuous arrival and smooth deceleration without unintended loops, late turns, or text bounce.

For paths authored in screen coordinates, account for perspective and the inverse camera transform. Prefer moderate perspective and distinct depth levels over extreme tilt. Motion blur may appear during fast travel. Settled elements must be sharp. Do not blur a common container with 3D descendants or leave halos on white panels.

## Backgrounds and content

A white background remains part of the final design. Its color gains opacity during flight. Do not replace this with whole-panel opacity. The SDK controls background alpha through `assembly`. Validation rejects binding-wide `opacity` and `blur`.

A typical panel can start with `partDelay` near 0.15–0.25 seconds and a short `stagger`. Adjust both to its descendant count. The background should settle slightly before text and fields. With a final `assembly=1` key at `t`, descendant `N` completes no earlier than `t + partDelay + (N - 1) × stagger`. Leave that time before final style restoration. No descendant delay is needed without descendants.

`parts` selects complete field rows, headings, buttons, and sections. An outer selected descendant absorbs nested selections. Do not split a table into nodes that break its layout. Do not promise independent movement of nested spans when their outer row is selected.

Use the existing SDK mechanism for compound backgrounds first. If a separate decorative plane is needed, move only the original container's paint to an empty DOM element. Keep real text and controls unique. Check dimensions, border, padding, and placement against the reference.

Do not add a late Z-axis arrival for the decorative plane. It can expand relative to its settled parent and cover white panels. Do not copy fixed depth compensation from another demo. Check the current page and implementation.

## Final accent

Assemble top actions near the end. Give buttons short downward arrivals with small sequential delays. Keep their container at its original size. Apply similar individual assembly to side items and icons when present. Do not substitute one arrival of the completed toolbar.

Give an existing logo a distinct longer path with a late arrival. It may appear slightly larger during travel. It must finish at the exact source size and position. Keep it moving continuously instead of holding it in the center. It must not obscure readable fields or compete with the last arrivals.

After settlement, local `x/y/z` and rotations are neutral. `scale=1` and `assembly=1` apply to the root and delayed descendants. The camera finishes neutral with `page.opacity=1` and `page.blur=0`. Reveal native scrollbars through `page.scrollbarOpacity` while preserving their reserved space. Do not change scrollbar width, `display`, or layout to reveal them.

## Motion research

[Greenlight Motion Gallery](https://greenlightdash.pro/greenlight-motion-gallery/), [gl-dash-workflows](https://github.com/wpsoul/gl-dash-workflows), and [Flute](https://github.com/webprodigies-org/flute) are possible research starting points. They are not dependencies or a fixed quality standard. Inspect accessible motion for layering, direction, acceleration, event overlap, and sharpness recovery. Translate selected principles into numeric SDK tracks while preserving the source design. If a source is unavailable, use another reference and do not claim to inspect its contents.
