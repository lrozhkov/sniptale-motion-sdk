import type { ViewerAppContext } from "../app/context.js";
import {
  motionPathTemporalKeyframesMatch,
  type MotionPathTangent,
} from "../../../shared/timeline/motion-path.js";
import {
  createCanvasMotionPathModel,
  findCanvasMotionPathPoint,
  type CanvasMotionPathModel,
} from "./motion-path-model.js";

function updateCanvasMotionPathPointPosition(
  ctx: ViewerAppContext,
  layerId: string,
  xKeyframeId: string,
  yKeyframeId: string,
  position: { x: number; y: number },
  options: any = {},
): boolean {
  return ctx.updateCanvasMotionPathPointPositions(
    [{ layerId, position, xKeyframeId, yKeyframeId }],
    options,
  );
}

function updateCanvasMotionPathTangent(
  ctx: ViewerAppContext,
  layerId: string,
  xKeyframeId: string,
  yKeyframeId: string,
  side: "in" | "out",
  tangent: MotionPathTangent,
  options: any = {},
): boolean {
  return mutateCanvasMotionPathTimeline(
    ctx,
    layerId,
    xKeyframeId,
    yKeyframeId,
    (model, point, timeline) => {
      if (!canCreateSpatialMotionPath(model)) {
        return false;
      }
      const path = ensureSpatialMotionPath(timeline, model);
      const target = path.points.find(
        (candidate) =>
          candidate.xKeyframeId === point.xKeyframeId &&
          candidate.yKeyframeId === point.yKeyframeId,
      );
      if (!target) {
        return false;
      }
      target[`${side}Tangent`] = tangent;
      if (target.kind === "smooth") {
        const opposite = side === "in" ? "out" : "in";
        target[`${opposite}Tangent`] = mirrorTangent(
          tangent,
          target[`${opposite}Tangent`],
        );
      }
      return true;
    },
    options,
  );
}

function mutateCanvasMotionPathTimeline(
  ctx: ViewerAppContext,
  layerId: string,
  xKeyframeId: string,
  yKeyframeId: string,
  mutate: (model: any, point: any, timeline: any) => boolean,
  options: any = {},
): boolean {
  const template = ctx.state.currentTemplate;
  if (!template) {
    return false;
  }
  const timeline = ctx.getEffectiveTimeline(template);
  const model = createCanvasMotionPathModel(timeline, layerId);
  const point = findCanvasMotionPathPoint(model, xKeyframeId, yKeyframeId);
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const layer = effectiveTemplate?.layers.find((item) => item.id === layerId);
  if (
    !model.ok ||
    !point ||
    !layer ||
    !canEditCanvasMotionPathPoint(ctx, layer, point, effectiveTemplate) ||
    !mutate(model, point, timeline)
  ) {
    if (point && layer) {
      reportCanvasMotionPathEditFailure(ctx, layer, point, effectiveTemplate);
    }
    return false;
  }
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
  );
  if (options.timeline !== false) {
    if (ctx.renderTimelineModel) {
      ctx.renderTimelineModel(template);
    } else {
      ctx.renderTimelineEditor(template);
    }
  }
  if (options.inspector !== false) {
    ctx.renderInspector();
  }
  if (options.selection !== false) {
    ctx.updateCanvasSelectionBox();
  }
  if (options.render !== false) {
    void ctx.renderCurrentFrame();
  }
  return true;
}

export function ensureSpatialMotionPath(
  timeline,
  model: Extract<CanvasMotionPathModel, { ok: true }>,
) {
  const current = (timeline.motionPaths ?? []).find(
    (path) => path.layerId === model.layerId,
  );
  if (current) {
    return current;
  }
  const path = {
    layerId: model.layerId,
    points: model.points.map((point) => ({
      inTangent: { ...point.inTangent },
      kind: point.kind,
      outTangent: { ...point.outTangent },
      xKeyframeId: point.xKeyframeId,
      yKeyframeId: point.yKeyframeId,
    })),
  };
  timeline.motionPaths = [...(timeline.motionPaths ?? []), path];
  return path;
}

export function canCreateSpatialMotionPath(
  model: Extract<CanvasMotionPathModel, { ok: true }>,
): boolean {
  return model.points.every((point) =>
    motionPathTemporalKeyframesMatch(point.xKeyframe, point.yKeyframe),
  );
}

function mirrorTangent(
  tangent: MotionPathTangent,
  opposite: MotionPathTangent,
): MotionPathTangent {
  const direction = normalizeTangent(tangent);
  const length = tangentLength(opposite) || tangentLength(tangent);
  return scaleTangent(direction, -length);
}

function normalizeTangent(tangent: MotionPathTangent): MotionPathTangent {
  const length = tangentLength(tangent);
  return length > 0.0001
    ? { x: tangent.x / length, y: tangent.y / length }
    : { x: 1, y: 0 };
}

function scaleTangent(
  tangent: MotionPathTangent,
  scale: number,
): MotionPathTangent {
  return { x: tangent.x * scale, y: tangent.y * scale };
}

function tangentLength(tangent: MotionPathTangent): number {
  return Math.hypot(Number(tangent?.x) || 0, Number(tangent?.y) || 0);
}

export function reportSpatialMotionPathFailure(ctx: ViewerAppContext): void {
  ctx.logDiagnostic(
    ctx.deps.t(
      "viewer.canvas.motionPath.temporalMismatch",
      "Spatial interpolation requires matching temporal easing on the X and Y keyframes.",
    ),
    "error",
  );
}

export type CanvasMotionPathPointEditBlockReason =
  | "disabled"
  | "inactive"
  | "locked"
  | "unsupported";

export function getCanvasMotionPathPointEditBlockReason(
  ctx: ViewerAppContext,
  layer,
  point,
  template = ctx.getEffectiveTemplate(ctx.state.currentTemplate),
): CanvasMotionPathPointEditBlockReason | null {
  if (layer?.locked) {
    return "locked";
  }
  if (!point?.enabled) {
    return "disabled";
  }
  if (!template || !ctx.isLayerActiveAtTime(template, layer.id, point.time)) {
    return "inactive";
  }
  if (
    !ctx.canTransformLayerProperty(layer, "x") ||
    !ctx.canTransformLayerProperty(layer, "y")
  ) {
    return "unsupported";
  }
  return null;
}

function canEditCanvasMotionPathPoint(
  ctx: ViewerAppContext,
  layer,
  point,
  template = ctx.getEffectiveTemplate(ctx.state.currentTemplate),
): boolean {
  return !getCanvasMotionPathPointEditBlockReason(ctx, layer, point, template);
}

export function reportCanvasMotionPathEditFailure(
  ctx: ViewerAppContext,
  layer,
  point,
  template = ctx.getEffectiveTemplate(ctx.state.currentTemplate),
  reason = getCanvasMotionPathPointEditBlockReason(ctx, layer, point, template),
): void {
  const [key, fallback] =
    reason === "locked"
      ? [
          "viewer.canvas.motionPath.locked",
          "Unlock the layer before editing its motion path.",
        ]
      : reason === "disabled"
        ? [
            "viewer.canvas.motionPath.disabled",
            "Enable both spatial keyframes and their tracks before editing this point.",
          ]
        : reason === "inactive"
          ? [
              "viewer.canvas.motionPath.inactive",
              "This motion point is outside the active layer interval.",
            ]
          : [
              "viewer.canvas.motionPath.unsupported",
              "This layer does not support spatial position editing.",
            ];
  ctx.logDiagnostic(ctx.deps.t(key, fallback), "error");
}

export function installCanvasMotionPathUpdatesOwner(
  ctx: ViewerAppContext,
): void {
  ctx.updateCanvasMotionPathPointPosition =
    updateCanvasMotionPathPointPosition.bind(undefined, ctx);
  ctx.updateCanvasMotionPathTangent = updateCanvasMotionPathTangent.bind(
    undefined,
    ctx,
  );
  ctx.canEditCanvasMotionPathPoint = canEditCanvasMotionPathPoint.bind(
    undefined,
    ctx,
  );
  ctx.getCanvasMotionPathPointEditBlockReason =
    getCanvasMotionPathPointEditBlockReason.bind(undefined, ctx);
  ctx.reportCanvasMotionPathEditFailure =
    reportCanvasMotionPathEditFailure.bind(undefined, ctx);
}
