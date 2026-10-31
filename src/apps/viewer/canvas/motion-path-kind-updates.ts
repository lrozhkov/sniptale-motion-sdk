import { bindViewerAction } from "../app/bind-action.js";
import type { MotionPathPointRef } from "./motion-path-reference.js";
import type {
  CanvasMotionPathModel,
  CanvasMotionPathPoint,
} from "./motion-path-model.js";
import type { CanvasMotionPathUpdateActions } from "./contract.js";
import type { ViewerAppContext } from "../app/context.js";
import type {
  MotionPathPointKind,
  MotionPathTangent,
} from "../../../shared/timeline/motion-path.js";
import {
  createCanvasMotionPathModel,
  findCanvasMotionPathPoint,
} from "./motion-path-model.js";
import {
  canCreateSpatialMotionPath,
  ensureSpatialMotionPath,
  reportSpatialMotionPathFailure,
} from "./motion-path-updates.js";

function updateCanvasMotionPathPointKind(
  ctx: ViewerAppContext,
  layerId: string,
  xKeyframeId: string,
  yKeyframeId: string,
  kind: MotionPathPointKind,
): boolean {
  return updateCanvasMotionPathPointKinds(
    ctx,
    [{ layerId, xKeyframeId, yKeyframeId }],
    kind,
  );
}

function updateCanvasMotionPathPointKinds(
  ctx: ViewerAppContext,
  selections: readonly MotionPathPointRef[],
  kind: MotionPathPointKind,
): boolean {
  const template = ctx.state.currentTemplate;
  if (!template || selections.length === 0) {
    return false;
  }
  const timeline = ctx.getEffectiveTimeline(template);
  const resolved: {
    model: Extract<CanvasMotionPathModel, { ok: true }>;
    point: CanvasMotionPathPoint;
  }[] = [];
  for (const selection of selections) {
    const model = createCanvasMotionPathModel(timeline, selection.layerId);
    const point = findCanvasMotionPathPoint(
      model,
      selection.xKeyframeId,
      selection.yKeyframeId,
    );
    if (!model.ok || !point || !canCreateSpatialMotionPath(model)) {
      reportSpatialMotionPathFailure(ctx);
      return false;
    }
    const layer = ctx
      .getEffectiveTemplate(template)
      ?.layers.find((item) => item.id === selection.layerId);
    if (!layer || !ctx.canEditCanvasMotionPathPoint(layer, point)) {
      if (layer) {
        ctx.reportCanvasMotionPathEditFailure(layer, point);
      }
      return false;
    }
    resolved.push({ model, point });
  }
  ctx.beginEditorCommand({
    payload: { kind, points: selections },
    type: "updateMotionPathPoints",
  });
  for (const { model, point } of resolved) {
    const path = ensureSpatialMotionPath(timeline, model);
    const target = path.points.find(
      (candidate) =>
        candidate.xKeyframeId === point.xKeyframeId &&
        candidate.yKeyframeId === point.yKeyframeId,
    );
    if (!target) {
      continue;
    }
    target.kind = kind;
    if (kind === "linear") {
      target.inTangent = { x: 0, y: 0 };
      target.outTangent = { x: 0, y: 0 };
    } else if (
      tangentLength(target.inTangent) < 0.0001 &&
      tangentLength(target.outTangent) < 0.0001
    ) {
      const defaults = createDefaultPointTangents(model, point);
      target.inTangent = defaults.inTangent;
      target.outTangent = defaults.outTangent;
    }
  }
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
  );
  if (ctx.renderTimelineModel) {
    ctx.renderTimelineModel(template);
  } else {
    ctx.renderTimelineEditor(template);
  }
  ctx.renderInspector();
  ctx.updateCanvasSelectionBox();
  void ctx.renderCurrentFrame();
  return true;
}

function createDefaultPointTangents(
  model: Extract<CanvasMotionPathModel, { ok: true }>,
  point: CanvasMotionPathPoint,
) {
  const index = model.points.indexOf(point);
  const previous = index > 0 ? model.points[index - 1] : null;
  const next =
    index >= 0 && index < model.points.length - 1
      ? model.points[index + 1]
      : null;
  const direction = normalizeTangent({
    x: (next?.x ?? point.x) - (previous?.x ?? point.x),
    y: (next?.y ?? point.y) - (previous?.y ?? point.y),
  });
  return {
    inTangent: previous
      ? scaleTangent(direction, -distance(point, previous) / 3)
      : { x: 0, y: 0 },
    outTangent: next
      ? scaleTangent(direction, distance(point, next) / 3)
      : { x: 0, y: 0 },
  };
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

function distance(left: MotionPathTangent, right: MotionPathTangent): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

export function createCanvasMotionPathKindActions(
  getContext: () => ViewerAppContext,
): Pick<
  CanvasMotionPathUpdateActions,
  "updateCanvasMotionPathPointKind" | "updateCanvasMotionPathPointKinds"
> {
  return {
    updateCanvasMotionPathPointKind: bindViewerAction(
      updateCanvasMotionPathPointKind,
      getContext,
    ),
    updateCanvasMotionPathPointKinds: bindViewerAction(
      updateCanvasMotionPathPointKinds,
      getContext,
    ),
  };
}
