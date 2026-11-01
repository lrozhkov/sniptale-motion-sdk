---
name: create-page-assembly
description: Animate existing live HTML pages through the SDK with layered arrivals and an exact final layout. Use for DOM assembly rather than raster effects or new website construction.
---

# Assemble a Live Page

Animate real HTML elements in a `sniptale.dom-motion.v1` document through the standard SDK viewer. The source page defines the final design. User requirements for timing, motion, and content override the choreography preferences below.

## Prepare

Find the source HTML or local example. Inspect the relevant SDK implementation and running viewer. Start without another file request when the source is available. Without source HTML, you may research references and plan motion. Do not promise an exact design match.

Read the [DOM motion contract](../../../docs/architecture/dom-motion.md). The [SDK types and validator](../../../src/sdk/dom-motion/index.ts) define accepted data. Do not introduce Canvas Effect v1, runtime JavaScript, `motionPaths`, or animation libraries into this format. Use existing numeric tracks for supported trajectories. Isolate a reproducible engine defect and apply the repository development loop to its owner.

Create a still reference at the selected `width` and `height`. Wait for fonts and resources. Record geometry, styles, and a screenshot. Prepare scriptless HTML with accepted embedded resources. Preserve original nodes, SVG, icons, fields, tables, typography, and layout.

Do not replace the page with screenshots, image fragments, or rectangular slices. Use agreed plausible content when new data is necessary. Check text wrapping. The prepared HTML defines the final reference.

Store sources, generators, and evidence under ignored `.tmp/page-assembly/<id>/`. Store the portable document at `.tmp/dom-motion/<id>.sniptale-dom-motion.json`. Do not make temporary demos a skill dependency or commit their contents.

## Design and implement

Read [choreography](references/choreography.md) before building the timeline. Complete one main variant first. Research references that the user provides. When another motion idea is needed, identify the observation that informs your animation.

Map semantic parts and event times: main panels, backgrounds, content, actions, peripheral sections, and branding. Fill the center early. Overlap arrivals from different areas. Continue visible assembly toward the end. Prefer five to six seconds unless the user specifies another duration.

Use non-overlapping binding roots and semantic `parts`. Each root requires an `assembly` track. Use `partDelay`, `stagger`, `partLift`, depth, and geometric tracks for separate levels. Compute complex curves during authoring and store numeric keys. Do not run another animation system inside the HTML.

Backgrounds should settle slightly before their content. Their color should gain opacity during arrival. Settled elements retain their original page coordinates. The camera may continue moving. Panels, background edges, and columns must not resize or shift when original CSS returns.

## Check and deliver

Read [proof](references/proof.md). Check the real DOM through the SDK, including arbitrary seeks and the assembled-state transition. A final screenshot alone is insufficient. Correct landing artifacts, late layout shifts, white flashes, remaining blur, and scrollbars that appear during flight.

Add the document to the local catalog. Use the running SDK viewer or start `npm run dev`. Check scene selection and autoplay in that viewer. Deliver its working URL, document path, and a short proof result. Do not present another demo server as the SDK or promise unsupported DOM-mode MP4 export.

After the main variant passes, apply its principles to other variants with separate trajectories and evidence. Use review subagents only with applicable authorization. Follow user requirements for model and effort.
