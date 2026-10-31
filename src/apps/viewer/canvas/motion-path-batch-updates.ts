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

export type CanvasMotionPathPointPositionUpdate = {
  layerId: string;
  position: { x: number; y: number };
  xKeyframeId: string;
  yKeyframeId: string;
};

export function updateCanvasMotionPathPointPositions(
  ctx: ViewerAppContext,
  sourceUpdates: CanvasMotionPathPointPositionUpdate[],
  options: {
    inspector?: boolean;
    render?: boolean;
    selection?: boolean;
    timeline?: boolean;
  } = {},
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

function dedupePositionUpdates(
  updates: CanvasMotionPathPointPositionUpdate[],
): CanvasMotionPathPointPositionUpdate[] {
  const byPoint = new Map<string, CanvasMotionPathPointPositionUpdate>();
  for (const update of updates) {
    byPoint.set(motionPathPointKey(update), update);
  }
  return [...byPoint.values()];
}

export function installCanvasMotionPathBatchUpdatesOwner(
  ctx: ViewerAppContext,
): void {
  ctx.updateCanvasMotionPathPointPositions =
    updateCanvasMotionPathPointPositions.bind(undefined, ctx);
}
