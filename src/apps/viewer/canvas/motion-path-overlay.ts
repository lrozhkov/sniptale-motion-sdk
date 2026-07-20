import type { ViewerAppContext } from "../app/context.js";
import {
  createCanvasMotionPathModel,
  isCanvasMotionPathPointSelected,
} from "./motion-path-model.js";
import {
  appendMotionPathPoint,
  appendMotionPathTangents,
  getMotionPathTangentStagePoint,
} from "./motion-path-overlay-controls.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export type CanvasMotionPathOverlayEntry = {
  interactive: boolean;
  layer: any;
  primary: boolean;
};

export function renderCanvasMotionPathOverlay(
  ctx: ViewerAppContext,
  template,
  layer,
): boolean {
  return renderCanvasMotionPathOverlays(ctx, template, [
    { interactive: true, layer, primary: true },
  ]);
}

export function renderCanvasMotionPathOverlays(
  ctx: ViewerAppContext,
  template,
  entries: CanvasMotionPathOverlayEntry[],
): boolean {
  const timeline = ctx.getEffectiveTimeline(template);
  const resolved = entries
    .map((entry) => ({
      ...entry,
      model: createCanvasMotionPathModel(timeline, entry.layer.id),
    }))
    .filter(
      (entry) => entry.model.ok && entry.model.points.length > 0,
    ) as Array<
    CanvasMotionPathOverlayEntry & {
      model: Extract<
        ReturnType<ViewerAppContext["getCanvasMotionPathModel"]>,
        { ok: true }
      >;
    }
  >;
  if (resolved.length === 0) {
    return false;
  }
  const viewport = getMotionPathViewport(ctx);
  ctx.refs.motionPathOverlay.removeAttribute("hidden");
  ctx.refs.motionPathOverlay.innerHTML = "";
  ctx.refs.motionPathOverlay.setAttribute(
    "viewBox",
    `0 0 ${viewport.stageRect.width} ${viewport.stageRect.height}`,
  );
  const selectedRefs = ctx.getSelectedKeyframeRefs();
  resolved.forEach((entry, index) =>
    appendMotionPathLayer(ctx, entry, viewport, index, selectedRefs, template),
  );
  return true;
}

function appendMotionPathLayer(
  ctx,
  entry,
  viewport,
  index: number,
  selectedRefs,
  template,
): void {
  const group = document.createElementNS(SVG_NAMESPACE, "g");
  group.setAttribute(
    "class",
    [
      "motion-path-layer",
      entry.primary ? "primary" : "secondary",
      entry.interactive ? "interactive" : "contextual",
    ].join(" "),
  );
  group.dataset.layerId = entry.layer.id;
  group.dataset.pathIndex = String(index);
  if (!entry.interactive) {
    group.setAttribute("aria-hidden", "true");
  }
  const points = entry.model.points.map((point) => ({
    model: point,
    stage: getCanvasMotionPathStagePoint(ctx, entry.layer, point, viewport),
  }));
  if (points.length > 1) {
    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("class", "motion-path-line");
    path.setAttribute("d", createMotionPathData(points, viewport));
    path.dataset.layerId = entry.layer.id;
    group.append(path);
  }
  for (const [pointIndex, point] of points.entries()) {
    const editable =
      entry.interactive &&
      ctx.canEditCanvasMotionPathPoint(entry.layer, point.model, template);
    const selected = isCanvasMotionPathPointSelected(
      point.model,
      selectedRefs,
      entry.model.xTrack.id,
      entry.model.yTrack.id,
    );
    if (editable && selected && point.model.kind !== "linear") {
      appendMotionPathTangents(
        ctx,
        group,
        entry.layer.id,
        point.model,
        point.stage,
        viewport,
      );
    }
    appendMotionPathPoint(
      ctx,
      group,
      entry.layer.id,
      point.model,
      point.stage,
      pointIndex,
      points.length,
      selected,
      entry.interactive,
      editable,
    );
  }
  ctx.refs.motionPathOverlay.append(group);
}

function createMotionPathData(points, viewport): string {
  const commands = [`M ${formatPoint(points[0].stage)}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const linearSegment = from.model.kind === "linear";
    const firstControl = getMotionPathTangentStagePoint(
      from.stage,
      linearSegment ? { x: 0, y: 0 } : from.model.outTangent,
      viewport,
    );
    const secondControl = getMotionPathTangentStagePoint(
      to.stage,
      linearSegment || to.model.kind === "linear"
        ? { x: 0, y: 0 }
        : to.model.inTangent,
      viewport,
    );
    commands.push(
      `C ${formatPoint(firstControl)} ${formatPoint(secondControl)} ${formatPoint(to.stage)}`,
    );
  }
  return commands.join(" ");
}

export function getCanvasMotionPathStagePoint(
  ctx,
  layer,
  point,
  viewport = getMotionPathViewport(ctx),
) {
  const box = ctx.getLayerStaticCanvasBox(layer.id, point.x, point.y, layer);
  return {
    x:
      viewport.canvasRect.left -
      viewport.stageRect.left +
      (box.x + box.width / 2) * viewport.scaleX,
    y:
      viewport.canvasRect.top -
      viewport.stageRect.top +
      (box.y + box.height / 2) * viewport.scaleY,
  };
}

function getMotionPathViewport(ctx: ViewerAppContext) {
  const canvasRect = ctx.refs.canvas.getBoundingClientRect();
  const stageRect = ctx.refs.canvas.parentElement.getBoundingClientRect();
  return {
    canvasRect,
    scaleX: canvasRect.width / ctx.refs.canvas.width,
    scaleY: canvasRect.height / ctx.refs.canvas.height,
    stageRect,
  };
}

function formatPoint(point): string {
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}
