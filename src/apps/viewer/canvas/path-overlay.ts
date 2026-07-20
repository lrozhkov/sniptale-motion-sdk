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

function renderMotionPathOverlay(ctx: ViewerAppContext, template, layer) {
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
  template,
  target,
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
      (layer) =>
        layer && layer.visible !== false && ctx.isLayerCanvasSelectable(layer),
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

function renderEditablePathOverlay(ctx: ViewerAppContext, layer) {
  const points = ctx.getEditablePathPoints(layer);
  if (points.length < 2) {
    ctx.hideMotionPathOverlay();
    return;
  }
  const stageRect = ctx.refs.canvas.parentElement.getBoundingClientRect();
  showMotionPathOverlay(ctx);
  ctx.refs.motionPathOverlay.innerHTML = "";
  ctx.refs.motionPathOverlay.setAttribute(
    "viewBox",
    `0 0 ${stageRect.width} ${stageRect.height}`,
  );
  const stagePoints = points.map((point) =>
    ctx.getEditablePathStagePoint(layer, point),
  );
  const polyline = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "polyline",
  );
  polyline.setAttribute("class", "editable-path-line");
  polyline.setAttribute(
    "points",
    stagePoints
      .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(" "),
  );
  ctx.refs.motionPathOverlay.append(polyline);
  if (layer.pathClosed === true || layer.pathClosed === "true") {
    polyline.setAttribute(
      "points",
      [...stagePoints, stagePoints[0]]
        .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
        .join(" "),
    );
  }
  stagePoints.forEach((point, index) => {
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    circle.setAttribute("class", "editable-path-point");
    circle.setAttribute("cx", point.x.toFixed(2));
    circle.setAttribute("cy", point.y.toFixed(2));
    circle.setAttribute(
      "r",
      index === 0 || index === stagePoints.length - 1 ? "6" : "5",
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

function getEditablePathPoints(ctx: ViewerAppContext, layer) {
  return Array.isArray(layer.pathPoints)
    ? layer.pathPoints.map((point) => ({
        x: ctx.deps.clamp(Number(point?.x) || 0, -2, 2),
        y: ctx.deps.clamp(Number(point?.y) || 0, -2, 2),
      }))
    : [];
}

function getEditablePathStagePoint(ctx: ViewerAppContext, layer, point) {
  const box = ctx.getLayerCanvasBox(layer.id, layer);
  const canvasRect = ctx.refs.canvas.getBoundingClientRect();
  const stageRect = ctx.refs.canvas.parentElement.getBoundingClientRect();
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

export function installCanvasPathOverlayOwner(ctx: ViewerAppContext): void {
  ctx.hideMotionPathOverlay = (...args: any[]) =>
    (hideMotionPathOverlay as any)(ctx, ...args);
  ctx.renderMotionPathOverlay = (...args: any[]) =>
    (renderMotionPathOverlay as any)(ctx, ...args);
  ctx.renderSelectedMotionPathOverlay = (...args: any[]) =>
    (renderSelectedMotionPathOverlay as any)(ctx, ...args);
  ctx.renderEditablePathOverlay = (...args: any[]) =>
    (renderEditablePathOverlay as any)(ctx, ...args);
  ctx.getEditablePathPoints = (...args: any[]) =>
    (getEditablePathPoints as any)(ctx, ...args);
  ctx.getEditablePathStagePoint = (...args: any[]) =>
    (getEditablePathStagePoint as any)(ctx, ...args);
}
