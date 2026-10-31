import type { ViewerAppContext } from "../../app/context.js";
import type { KeyframeSelectionRef } from "../model/selection-model.js";
import { parseKeyframeSelectionRef } from "../model/selection-validation.js";
import type { TimelineRect, MarqueeSelectionKind } from "./pointer-contract.js";
export function resolveMarqueeSelectionKind(
  event: Pick<MouseEvent, "target">,
): MarqueeSelectionKind {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest(".keyframe-point, .property-track-lane")) {
    return "keyframes";
  }
  if (target?.closest(".clip-block, .layer-lane")) {
    return "clips";
  }
  if (target?.closest(".phase-block, .phase-lane")) {
    return "phases";
  }
  if (target?.closest(".scene-block, .timeline-scene-row")) {
    return "scenes";
  }
  return "auto";
}

export function collectMarqueeKeyframes(
  ctx: ViewerAppContext,
  selectionRect: TimelineRect,
  output: KeyframeSelectionRef[],
): void {
  ctx.refs.timelineTracks
    .querySelectorAll(".keyframe-point")
    .forEach((point) => {
      if (!(point instanceof HTMLElement)) return;
      const ref = parseKeyframeSelectionRef(point.dataset);
      if (
        ref &&
        ctx.rectsIntersect(selectionRect, point.getBoundingClientRect())
      ) {
        output.push(ref);
      }
    });
}

export function collectMarqueeBlockIds(
  ctx: ViewerAppContext,
  selectionRect: TimelineRect,
  selector: string,
  property: string,
  output: string[],
): void {
  ctx.refs.timelineTracks.querySelectorAll(selector).forEach((block) => {
    if (!(block instanceof HTMLElement)) return;
    const id = block.dataset[property];
    const selected = ctx.rectContainsRectCenter(
      selectionRect,
      block.getBoundingClientRect(),
    );
    if (selected && id) {
      output.push(id);
    }
  });
}
