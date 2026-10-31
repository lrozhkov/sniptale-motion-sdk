import { bindViewerAction } from "../app/bind-action.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";
import type { CanvasMotionPathSelection } from "./motion-path-model.js";
import type { CanvasMotionPathSelectionActions } from "./contract.js";
import { keyframeRefKey } from "../timeline/model/keyframe-reference.js";
import type { ViewerAppContext } from "../app/context.js";
import { getMotionPathLayerProperty } from "../../../shared/timeline/motion-path.js";
import {
  createCanvasMotionPathModel,
  findCanvasMotionPathPoint,
  getCanvasMotionPathPointRefs,
  isCanvasMotionPathPointSelected,
} from "./motion-path-model.js";

function getCanvasMotionPathModel(
  ctx: ViewerAppContext,
  template: EditorTimelineSource | null | undefined,
  layerId: string,
) {
  return createCanvasMotionPathModel(
    ctx.getEffectiveTimeline(template),
    layerId,
  );
}

function selectCanvasMotionPathPoint(
  ctx: ViewerAppContext,
  layerId: string,
  xKeyframeId: string,
  yKeyframeId: string,
  event: Pick<PointerEvent, "ctrlKey" | "metaKey" | "shiftKey"> | null = null,
  options: { preserveSelection?: boolean; sync?: boolean } = {},
) {
  const template = ctx.state.currentTemplate;
  const model = getCanvasMotionPathModel(ctx, template, layerId);
  const point = findCanvasMotionPathPoint(model, xKeyframeId, yKeyframeId);
  if (!model.ok || !point) {
    return null;
  }
  const pair = getCanvasMotionPathPointRefs(model, point);
  const additive = Boolean(event?.shiftKey || event?.metaKey || event?.ctrlKey);
  const pairKeys = new Set(pair.map(keyframeRefKey));
  const current = ctx.getSelectedKeyframeRefs();
  const pairSelected = pair.every((ref) =>
    current.some(
      (candidate) => keyframeRefKey(candidate) === keyframeRefKey(ref),
    ),
  );
  const next = options.preserveSelection
    ? current
    : additive
      ? pairSelected
        ? current.filter((ref) => !pairKeys.has(keyframeRefKey(ref)))
        : [
            ...current.filter((ref) => !pairKeys.has(keyframeRefKey(ref))),
            ...pair,
          ]
      : pair;
  updateMotionPathContextLayerIds(ctx, template, layerId, additive);
  ctx.setSelectedKeyframes(next, {
    preserveMotionPathContext: true,
    render: false,
  });
  ctx.setSidebarGroup("inspect");
  if (options.sync !== false) {
    ctx.syncTimelineSelection(template);
  }
  return point;
}

function isCanvasMotionPathSelectionForLayer(
  ctx: ViewerAppContext,
  template: EditorTimelineSource | null | undefined,
  layerId: string,
): boolean {
  const model = getCanvasMotionPathModel(ctx, template, layerId);
  if (!model.ok) {
    return false;
  }
  const item = ctx.state.selectedItem;
  if (
    (item?.type === "track" || item?.type === "keyframe") &&
    (item.trackId === model.xTrack.id || item.trackId === model.yTrack.id)
  ) {
    return true;
  }
  return model.points.some((point) =>
    isCanvasMotionPathPointSelected(
      point,
      ctx.getSelectedKeyframeRefs(),
      model.xTrack.id,
      model.yTrack.id,
    ),
  );
}

function getSelectedCanvasMotionPathPoints(
  ctx: ViewerAppContext,
  template: EditorTimelineSource | null = ctx.state.currentTemplate,
) {
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (!effectiveTemplate) {
    return [];
  }
  const selected = ctx.getSelectedKeyframeRefs();
  const timeline = ctx.getEffectiveTimeline(template);
  const selectedTrackIds = new Set(selected.map((ref) => ref.trackId));
  const candidateLayerIds = new Set<string>();
  for (const track of timeline.tracks ?? []) {
    if (!selectedTrackIds.has(track.id)) {
      continue;
    }
    const owner = getMotionPathLayerProperty(track);
    if (owner && (owner.property === "x" || owner.property === "y")) {
      candidateLayerIds.add(owner.layerId);
    }
  }
  const layersById = new Map(
    (effectiveTemplate.layers ?? []).map((layer) => [layer.id, layer]),
  );
  const result: CanvasMotionPathSelection[] = [];
  for (const layerId of candidateLayerIds) {
    const layer = layersById.get(layerId);
    if (!layer) {
      continue;
    }
    const model = createCanvasMotionPathModel(timeline, layerId);
    if (!model.ok) {
      continue;
    }
    for (const point of model.points) {
      if (
        isCanvasMotionPathPointSelected(
          point,
          selected,
          model.xTrack.id,
          model.yTrack.id,
        )
      ) {
        result.push({ layer, model, point });
      }
    }
  }
  return result;
}

function getFullySelectedCanvasMotionPathPoints(
  ctx: ViewerAppContext,
  template: EditorTimelineSource | null = ctx.state.currentTemplate,
) {
  const selected = ctx.getSelectedKeyframeRefs();
  const selectedKeys = new Set(selected.map(keyframeRefKey));
  const points = getSelectedCanvasMotionPathPoints(ctx, template).filter(
    ({ model, point }) =>
      getCanvasMotionPathPointRefs(model, point).every((ref) =>
        selectedKeys.has(keyframeRefKey(ref)),
      ),
  );
  const pointKeys = new Set(
    points.flatMap(({ model, point }) =>
      getCanvasMotionPathPointRefs(model, point).map(keyframeRefKey),
    ),
  );
  return pointKeys.size === selectedKeys.size ? points : [];
}

function updateMotionPathContextLayerIds(
  ctx: ViewerAppContext,
  template: EditorTimelineSource | null | undefined,
  layerId: string,
  additive: boolean,
): void {
  const selectedLayerContext =
    ctx.state.selectedItem?.type === "layer"
      ? (ctx.getCanvasSelectionTarget(ctx.getRenderTemplateSnapshot(template))
          ?.layerIds ?? [])
      : [];
  const current = additive
    ? ctx.state.canvasMotionPathContextLayerIds
    : selectedLayerContext;
  ctx.state.canvasMotionPathContextLayerIds = [
    ...new Set([...(current ?? []), ...selectedLayerContext, layerId]),
  ];
}

export function createCanvasMotionPathSelectionActions(
  getContext: () => ViewerAppContext,
): CanvasMotionPathSelectionActions {
  return {
    getCanvasMotionPathModel: bindViewerAction(
      getCanvasMotionPathModel,
      getContext,
    ),
    selectCanvasMotionPathPoint: bindViewerAction(
      selectCanvasMotionPathPoint,
      getContext,
    ),
    isCanvasMotionPathSelectionForLayer: bindViewerAction(
      isCanvasMotionPathSelectionForLayer,
      getContext,
    ),
    getSelectedCanvasMotionPathPoints: bindViewerAction(
      getSelectedCanvasMotionPathPoints,
      getContext,
    ),
    getFullySelectedCanvasMotionPathPoints: bindViewerAction(
      getFullySelectedCanvasMotionPathPoints,
      getContext,
    ),
  };
}
