import type { EffectLayer } from "../../../sdk/types.js";
import type { EditorTemplate } from "../templates/model.js";
import type { CanvasSelectionTarget } from "./path-contract.js";
import type { CanvasPoint } from "./geometry-contract.js";
import { bindViewerAction } from "../app/bind-action.js";
import type { CanvasPathActions } from "./path-contract.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  renderCanvasMotionPathOverlay,
  renderCanvasMotionPathOverlays,
} from "./motion-path-overlay.js";

function hideMotionPathOverlay(ctx: ViewerAppContext) {
  if (
    ctx.refs.motionPathOverlay.hasAttribute("hidden") &&
    ctx.refs.motionPathOverlay.childElementCount === 0
  ) {
    return;
  }
  ctx.refs.motionPathOverlay.setAttribute("hidden", "");
  ctx.refs.motionPathOverlay.innerHTML = "";
}

function showMotionPathOverlay(ctx: ViewerAppContext) {
  ctx.refs.motionPathOverlay.removeAttribute("hidden");
}

function renderMotionPathOverlay(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  layer: EffectLayer,
) {
  if (layer.type === "path") {
    ctx.renderEditablePathOverlay(layer);
    return;
  }
  if (!renderCanvasMotionPathOverlay(ctx, template, layer)) {
    ctx.hideMotionPathOverlay();
  }
}

function renderSelectedMotionPathOverlay(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  target: CanvasSelectionTarget,
): boolean {
  const primaryLayer = template?.layers?.find(
    (layer) => layer.id === target?.primaryLayerId,
  );
  if (
    target?.kind === "layer" &&
    ctx.state.selectedItem?.type === "layer" &&
    primaryLayer?.type === "path"
  ) {
    ctx.renderEditablePathOverlay(primaryLayer);
    return true;
  }
  const selectedPointLayerIds = new Set(
    ctx
      .getSelectedCanvasMotionPathPoints(template)
      .map(({ layer }) => layer.id),
  );
  const contextLayerIds =
    ctx.state.selectedItem?.type === "keyframe"
      ? ctx.state.canvasMotionPathContextLayerIds
      : [];
  const rootLayerIds = new Set(target?.rootLayerIds ?? []);
  const layerIds = [
    ...new Set([
      ...(target?.layerIds ?? []),
      ...(target?.primaryLayerId ? [target.primaryLayerId] : []),
      ...contextLayerIds,
      ...selectedPointLayerIds,
    ]),
  ];
  const entries = layerIds
    .map((layerId) => template?.layers?.find((layer) => layer.id === layerId))
    .filter(
      (layer): layer is EffectLayer =>
        layer !== undefined &&
        layer.visible !== false &&
        ctx.isLayerCanvasSelectable(layer),
    )
    .map((layer) => ({
      interactive:
        rootLayerIds.has(layer.id) ||
        selectedPointLayerIds.has(layer.id) ||
        contextLayerIds.includes(layer.id) ||
        (target?.kind === "layer" && target.primaryLayerId === layer.id),
      layer,
      primary:
        target?.primaryLayerId === layer.id ||
        selectedPointLayerIds.has(layer.id),
    }));
  if (entries.length === 0) {
    return false;
  }
  return renderCanvasMotionPathOverlays(ctx, template, entries);
}

function renderEditablePathOverlay(ctx: ViewerAppContext, layer: EffectLayer) {
  const points = ctx.getEditablePathPoints(layer);
  if (points.length < 2) {
    ctx.hideMotionPathOverlay();
    return;
  }
  const stageRect = ctx.refs.canvas.parentElement?.getBoundingClientRect();
  if (!stageRect) return;
  showMotionPathOverlay(ctx);
  ctx.refs.motionPathOverlay.innerHTML = "";
  ctx.refs.motionPathOverlay.setAttribute(
    "viewBox",
    `0 0 ${stageRect.width} ${stageRect.height}`,
  );
  const stagePoints = points.map((point) =>
    ctx.getEditablePathStagePoint(layer, point),
  );
  if (stagePoints.some((point) => point === null)) {
    ctx.hideMotionPathOverlay();
    return;
  }
  const visiblePoints = stagePoints.filter((point) => point !== null);
  const polyline = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "polyline",
  );
  polyline.setAttribute("class", "editable-path-line");
  polyline.setAttribute(
    "points",
    visiblePoints
      .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(" "),
  );
  ctx.refs.motionPathOverlay.append(polyline);
  if (layer.pathClosed === true || layer.pathClosed === "true") {
    polyline.setAttribute(
      "points",
      [...visiblePoints, ...visiblePoints.slice(0, 1)]
        .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
        .join(" "),
    );
  }
  visiblePoints.forEach((point, index) => {
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    circle.setAttribute("class", "editable-path-point");
    circle.setAttribute("cx", point.x.toFixed(2));
    circle.setAttribute("cy", point.y.toFixed(2));
    circle.setAttribute(
      "r",
      index === 0 || index === visiblePoints.length - 1 ? "6" : "5",
    );
    circle.setAttribute("pointer-events", "all");
    circle.dataset.layerId = layer.id;
    circle.dataset.pointIndex = String(index);
    circle.addEventListener("pointerdown", (event) => {
      ctx.beginEditablePathPointDrag(event, layer.id, index);
    });
    ctx.refs.motionPathOverlay.append(circle);
  });
}

export function getEditablePathPoints(
  ctx: { deps: Pick<ViewerAppContext["deps"], "clamp"> },
  layer: EffectLayer,
) {
  if (!Array.isArray(layer.pathPoints)) return [];
  const values: readonly unknown[] = layer.pathPoints;
  const points: CanvasPoint[] = [];
  for (const point of values) {
    if (
      !point ||
      typeof point !== "object" ||
      !("x" in point) ||
      !("y" in point) ||
      typeof point.x !== "number" ||
      !Number.isFinite(point.x) ||
      typeof point.y !== "number" ||
      !Number.isFinite(point.y)
    )
      return [];
    points.push({
      x: ctx.deps.clamp(point.x, -2, 2),
      y: ctx.deps.clamp(point.y, -2, 2),
    });
  }
  return points;
}

function getEditablePathStagePoint(
  ctx: ViewerAppContext,
  layer: EffectLayer,
  point: CanvasPoint,
) {
  const box = ctx.getLayerCanvasBox(layer.id, layer);
  const canvasRect = ctx.refs.canvas.getBoundingClientRect();
  const stageRect = ctx.refs.canvas.parentElement?.getBoundingClientRect();
  if (!stageRect || !box) return null;
  const scaleX = canvasRect.width / ctx.refs.canvas.width;
  const scaleY = canvasRect.height / ctx.refs.canvas.height;
  return {
    x:
      canvasRect.left -
      stageRect.left +
      (box.x + box.width * 0.5 + point.x * box.width) * scaleX,
    y:
      canvasRect.top -
      stageRect.top +
      (box.y + box.height * 0.5 + point.y * box.height) * scaleY,
  };
}

export function createCanvasPathOverlayActions(
  getContext: () => ViewerAppContext,
): Pick<
  CanvasPathActions,
  | "hideMotionPathOverlay"
  | "renderMotionPathOverlay"
  | "renderSelectedMotionPathOverlay"
  | "renderEditablePathOverlay"
  | "getEditablePathPoints"
  | "getEditablePathStagePoint"
> {
  return {
    hideMotionPathOverlay: bindViewerAction(hideMotionPathOverlay, getContext),
    renderMotionPathOverlay: bindViewerAction(
      renderMotionPathOverlay,
      getContext,
    ),
    renderSelectedMotionPathOverlay: bindViewerAction(
      renderSelectedMotionPathOverlay,
      getContext,
    ),
    renderEditablePathOverlay: bindViewerAction(
      renderEditablePathOverlay,
      getContext,
    ),
    getEditablePathPoints: bindViewerAction(getEditablePathPoints, getContext),
    getEditablePathStagePoint: bindViewerAction(
      getEditablePathStagePoint,
      getContext,
    ),
  };
}
