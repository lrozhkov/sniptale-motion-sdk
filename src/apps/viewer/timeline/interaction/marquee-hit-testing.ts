export function resolveMarqueeSelectionKind(event) {
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

export function collectMarqueeKeyframes(ctx, selectionRect, output): void {
  ctx.refs.timelineTracks
    .querySelectorAll(".keyframe-point")
    .forEach((point) => {
      if (ctx.rectsIntersect(selectionRect, point.getBoundingClientRect())) {
        output.push({
          keyframeId: point.dataset.keyframeId,
          trackId: point.dataset.trackId,
        });
      }
    });
}

export function collectMarqueeBlockIds(
  ctx,
  selectionRect,
  selector,
  property,
  output,
): void {
  ctx.refs.timelineTracks.querySelectorAll(selector).forEach((block) => {
    const selected = ctx.rectContainsRectCenter(
      selectionRect,
      block.getBoundingClientRect(),
    );
    if (selected && block.dataset[property]) {
      output.push(block.dataset[property]);
    }
  });
}
