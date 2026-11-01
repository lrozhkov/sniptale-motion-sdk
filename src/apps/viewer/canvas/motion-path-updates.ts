import { commitCanvasMotionPathUpdate } from "./motion-path-commit.js";
import {
  normalizeTangent,
  scaleTangent,
  tangentLength,
} from "./motion-path-tangent.js";
import { bindViewerAction } from "../app/bind-action.js";
import type { EffectLayer } from "../../../sdk/types.js";
import type { EditorTimeline } from "../editor/model-types.js";
import type {
  CanvasMotionPathPoint,
  CanvasMotionPathEditBlockReason,
} from "./motion-path-model.js";
import type {
  CanvasMotionPathUpdateActions,
  CanvasMotionPathUpdateOptions,
} from "./contract.js";
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
  options: CanvasMotionPathUpdateOptions = {},
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
  options: CanvasMotionPathUpdateOptions = {},
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
  mutate: (
    model: Extract<CanvasMotionPathModel, { ok: true }>,
    point: CanvasMotionPathPoint,
    timeline: EditorTimeline,
  ) => boolean,
  options: CanvasMotionPathUpdateOptions = {},
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
  commitCanvasMotionPathUpdate(ctx, template, timeline, options);
  return true;
}

export function ensureSpatialMotionPath(
  timeline: EditorTimeline,
  model: Extract<CanvasMotionPathModel, { ok: true }>,
) {
  const current = (timeline.motionPaths ?? []).find(
    (path) => path.layerId === model.layerId,
  );
  if (current) {
    const normalized = {
      ...current,
      points: current.points.map((point) => ({
        ...point,
        kind: point.kind ?? "linear",
        inTangent: point.inTangent ?? { x: 0, y: 0 },
        outTangent: point.outTangent ?? { x: 0, y: 0 },
      })),
    };
    timeline.motionPaths = (timeline.motionPaths ?? []).map((path) =>
      path === current ? normalized : path,
    );
    return normalized;
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

export function reportSpatialMotionPathFailure(ctx: ViewerAppContext): void {
  ctx.logDiagnostic(
    ctx.deps.t(
      "viewer.canvas.motionPath.temporalMismatch",
      "Spatial interpolation requires matching temporal easing on the X and Y keyframes.",
    ),
    "error",
  );
}

export function getCanvasMotionPathPointEditBlockReason(
  ctx: ViewerAppContext,
  layer: EffectLayer,
  point: CanvasMotionPathPoint,
  template = ctx.getEffectiveTemplate(ctx.state.currentTemplate),
): CanvasMotionPathEditBlockReason | null {
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
  layer: EffectLayer,
  point: CanvasMotionPathPoint,
  template = ctx.getEffectiveTemplate(ctx.state.currentTemplate),
): boolean {
  return !getCanvasMotionPathPointEditBlockReason(ctx, layer, point, template);
}

export function reportCanvasMotionPathEditFailure(
  ctx: ViewerAppContext,
  layer: EffectLayer,
  point: CanvasMotionPathPoint,
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

export function createCanvasMotionPathUpdateActions(
  getContext: () => ViewerAppContext,
): Pick<
  CanvasMotionPathUpdateActions,
  | "updateCanvasMotionPathPointPosition"
  | "updateCanvasMotionPathTangent"
  | "canEditCanvasMotionPathPoint"
  | "getCanvasMotionPathPointEditBlockReason"
  | "reportCanvasMotionPathEditFailure"
> {
  return {
    updateCanvasMotionPathPointPosition: bindViewerAction(
      updateCanvasMotionPathPointPosition,
      getContext,
    ),
    updateCanvasMotionPathTangent: bindViewerAction(
      updateCanvasMotionPathTangent,
      getContext,
    ),
    canEditCanvasMotionPathPoint: bindViewerAction(
      canEditCanvasMotionPathPoint,
      getContext,
    ),
    getCanvasMotionPathPointEditBlockReason: bindViewerAction(
      getCanvasMotionPathPointEditBlockReason,
      getContext,
    ),
    reportCanvasMotionPathEditFailure: bindViewerAction(
      reportCanvasMotionPathEditFailure,
      getContext,
    ),
  };
}
