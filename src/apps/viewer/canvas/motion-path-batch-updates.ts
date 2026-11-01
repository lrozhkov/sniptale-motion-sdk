import { commitCanvasMotionPathUpdate } from "./motion-path-commit.js";
import { bindViewerAction } from "../app/bind-action.js";
import type {
  CanvasMotionPathUpdateActions,
  CanvasMotionPathPositionUpdate,
  CanvasMotionPathUpdateOptions,
} from "./contract.js";
import { motionPathPointKey } from "./motion-path-reference.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  createCanvasMotionPathModel,
  findCanvasMotionPathPoint,
  type CanvasMotionPathPoint,
} from "./motion-path-model.js";
import {
  getCanvasMotionPathPointEditBlockReason,
  reportCanvasMotionPathEditFailure,
} from "./motion-path-updates.js";

export function updateCanvasMotionPathPointPositions(
  ctx: ViewerAppContext,
  sourceUpdates: readonly CanvasMotionPathPositionUpdate[],
  options: CanvasMotionPathUpdateOptions = {},
): boolean {
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (!template || !effectiveTemplate || sourceUpdates.length === 0) {
    return false;
  }
  const updates = dedupePositionUpdates(sourceUpdates);
  const timeline = ctx.getEffectiveTimeline(template);
  const models = new Map<
    string,
    ReturnType<typeof createCanvasMotionPathModel>
  >();
  const resolved: Array<{
    point: CanvasMotionPathPoint;
    position: { x: number; y: number };
  }> = [];
  for (const update of updates) {
    if (
      !Number.isFinite(update.position.x) ||
      !Number.isFinite(update.position.y)
    ) {
      return false;
    }
    const model =
      models.get(update.layerId) ??
      createCanvasMotionPathModel(timeline, update.layerId);
    models.set(update.layerId, model);
    const point = findCanvasMotionPathPoint(
      model,
      update.xKeyframeId,
      update.yKeyframeId,
    );
    const layer = effectiveTemplate.layers.find(
      (candidate) => candidate.id === update.layerId,
    );
    if (!model.ok || !point || !layer) {
      return false;
    }
    const blockReason = getCanvasMotionPathPointEditBlockReason(
      ctx,
      layer,
      point,
      effectiveTemplate,
    );
    if (blockReason) {
      reportCanvasMotionPathEditFailure(
        ctx,
        layer,
        point,
        effectiveTemplate,
        blockReason,
      );
      return false;
    }
    resolved.push({ point, position: update.position });
  }
  for (const { point, position } of resolved) {
    point.xKeyframe.value = position.x;
    point.yKeyframe.value = position.y;
  }
  commitCanvasMotionPathUpdate(ctx, template, timeline, options);
  return true;
}

function dedupePositionUpdates(
  updates: readonly CanvasMotionPathPositionUpdate[],
): readonly CanvasMotionPathPositionUpdate[] {
  const byPoint = new Map<string, CanvasMotionPathPositionUpdate>();
  for (const update of updates) {
    byPoint.set(motionPathPointKey(update), update);
  }
  return [...byPoint.values()];
}

export function createCanvasMotionPathBatchActions(
  getContext: () => ViewerAppContext,
): Pick<CanvasMotionPathUpdateActions, "updateCanvasMotionPathPointPositions"> {
  return {
    updateCanvasMotionPathPointPositions: bindViewerAction(
      updateCanvasMotionPathPointPositions,
      getContext,
    ),
  };
}
