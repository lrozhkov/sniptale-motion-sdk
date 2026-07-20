import type { ViewerAppContext } from "../../app/context.js";

export function syncTimelineSelection(
  ctx: ViewerAppContext,
  template = ctx.state.currentTemplate,
): void {
  ctx.reconcileTimelineSelection(template);
  toggleSelectionClass(
    ctx.refs.timelineTracks,
    ".layer-lane[data-layer-id]",
    "selected-layer",
    (element) => ctx.isSelectedLayer(element.dataset.layerId),
  );
  toggleSelectionClass(
    ctx.refs.timelineTracks,
    ".property-track-lane[data-track-id]",
    "selected-track",
    (element) =>
      ctx.state.selectedItem?.type === "track" &&
      ctx.state.selectedItem.trackId === element.dataset.trackId,
  );
  toggleSelectionClass(
    ctx.refs.timelineTracks,
    ".clip-block[data-layer-id]",
    "selected",
    (element) => ctx.isSelectedClip(element.dataset.layerId),
  );
  toggleSelectionClass(
    ctx.refs.timelineTracks,
    ".phase-block[data-phase-id]",
    "selected",
    (element) => ctx.isSelectedPhase(element.dataset.phaseId),
  );
  toggleSelectionClass(
    ctx.refs.timelineTracks,
    ".scene-block[data-scene-id]",
    "selected",
    (element) => ctx.isSelectedScene(element.dataset.sceneId),
  );
  toggleSelectionClass(
    ctx.refs.timelineTracks,
    ".keyframe-point[data-track-id][data-keyframe-id]",
    "selected",
    (element) =>
      ctx.isSelectedKeyframe(
        element.dataset.trackId,
        element.dataset.keyframeId,
      ),
  );
  toggleSelectionClass(
    ctx.refs.layersPanel,
    ".layer-row[data-layer-id]",
    "selected",
    (element) => ctx.isSelectedLayer(element.dataset.layerId),
  );
  if (ctx.state.selectedItem?.type !== "keyframe") {
    ctx.refs.timelineTracks
      .querySelectorAll(".keyframe-segment-range")
      .forEach((element) => element.remove());
  }
  ctx.renderSelectionCrumb(template);
  ctx.renderCurveEditor(ctx.getEffectiveTimeline(template));
  ctx.renderInspector();
  ctx.updateCanvasSelectionBox();
}

function toggleSelectionClass(
  root: ParentNode,
  selector: string,
  className: string,
  selected: (element: HTMLElement) => boolean,
): void {
  root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    element.classList.toggle(className, selected(element));
  });
}

export function installTimelineSelectionViewOwner(ctx: ViewerAppContext): void {
  ctx.syncTimelineSelection = (...args: any[]) =>
    (syncTimelineSelection as any)(ctx, ...args);
}
