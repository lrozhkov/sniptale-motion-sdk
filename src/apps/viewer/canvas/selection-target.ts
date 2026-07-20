import type { ViewerAppContext } from "../app/context.js";
import { getLayerLeafIds, isLayerGroup } from "../layers/hierarchy.js";

type SelectionTargetInput = {
  getTrackLayerId: (track: any) => string | null;
  item: any;
  layers: any[];
  timeline: any;
};

export function resolveCanvasSelectionLayerId({
  getTrackLayerId,
  item,
  layers,
  timeline,
}: SelectionTargetInput): string | null {
  const layerIds = new Set(
    (layers ?? [])
      .map((layer) => layer?.id)
      .filter((id): id is string => typeof id === "string"),
  );
  if (
    (item?.type === "layer" || item?.type === "clip") &&
    layerIds.has(item.layerId)
  ) {
    return item.layerId;
  }
  if (item?.type === "track" || item?.type === "keyframe") {
    const track = (timeline?.tracks ?? []).find(
      (candidate) => candidate.id === item.trackId,
    );
    return resolveKnownTrackLayerId(track);
  }
  if (item?.type === "phase") {
    const owners = new Set<string>();
    for (const track of timeline?.tracks ?? []) {
      const ownsPhase =
        track?.phaseId === item.phaseId ||
        (track?.keyframes ?? []).some(
          (keyframe) => keyframe?.phaseId === item.phaseId,
        );
      const layerId = ownsPhase ? resolveKnownTrackLayerId(track) : null;
      if (layerId) {
        owners.add(layerId);
      }
    }
    return owners.size === 1 ? [...owners][0] : null;
  }
  return null;

  function resolveKnownTrackLayerId(track): string | null {
    const layerId = track ? getTrackLayerId(track) : null;
    return layerId && layerIds.has(layerId) ? layerId : null;
  }
}

function getCanvasSelectionLayerId(
  ctx: ViewerAppContext,
  template = ctx.getRenderTemplateSnapshot(ctx.state.currentTemplate),
) {
  if (!template) {
    return null;
  }
  return resolveCanvasSelectionLayerId({
    getTrackLayerId: (track) => ctx.getTrackLayerId(track),
    item: ctx.state.selectedItem,
    layers: template.layers ?? [],
    timeline: template.timeline ?? { phases: [], tracks: [] },
  });
}

function getCanvasSelectionTarget(
  ctx: ViewerAppContext,
  template = ctx.getRenderTemplateSnapshot(ctx.state.currentTemplate),
) {
  if (!template) {
    return null;
  }
  if (ctx.state.selectedItem?.type === "layer") {
    const hierarchy = ctx.getLayerHierarchy(template);
    const rootLayerIds = ctx.getSelectedLayerRootIds(template);
    if (rootLayerIds.length === 0) {
      return null;
    }
    const layerIds = getLayerLeafIds(hierarchy, rootLayerIds);
    const primaryLayerId =
      ctx.state.selectedItem.layerId ?? rootLayerIds.at(-1) ?? null;
    const primaryLayer = primaryLayerId
      ? hierarchy.byId.get(primaryLayerId)
      : null;
    return {
      kind:
        rootLayerIds.length > 1 || isLayerGroup(primaryLayer)
          ? "selection"
          : "layer",
      layerIds,
      primaryLayerId,
      related: false,
      rootLayerIds,
    };
  }
  const layerId = getCanvasSelectionLayerId(ctx, template);
  return layerId
    ? {
        kind: "layer",
        layerIds: [layerId],
        primaryLayerId: layerId,
        related: true,
        rootLayerIds: [layerId],
      }
    : null;
}

export function installCanvasSelectionTargetOwner(ctx: ViewerAppContext): void {
  ctx.getCanvasSelectionLayerId = (...args: any[]) =>
    (getCanvasSelectionLayerId as any)(ctx, ...args);
  ctx.getCanvasSelectionTarget = (...args: any[]) =>
    (getCanvasSelectionTarget as any)(ctx, ...args);
}
