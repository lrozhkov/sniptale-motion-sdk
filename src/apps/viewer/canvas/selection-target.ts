import type { EffectLayer } from "../../../sdk/types.js";
import type { TrackLayerSource } from "../layers/model.js";
import type { ViewerSelection } from "../timeline/model/selection-model.js";
import type { CanvasSelectionTarget } from "./path-contract.js";
import type { EditorTemplate } from "../templates/model.js";
export type CanvasSelectionTrack = TrackLayerSource & {
  phaseId?: string | null;
  keyframes?: readonly { phaseId?: string | null }[];
};
import { bindViewerAction } from "../app/bind-action.js";
import type { CanvasSelectionActions } from "./selection-contract.js";
import type { ViewerAppContext } from "../app/context.js";
import { getLayerLeafIds, isLayerGroup } from "../layers/hierarchy.js";

type SelectionTargetInput = {
  getTrackLayerId: (track: CanvasSelectionTrack) => string | null;
  item: ViewerSelection | null;
  layers: readonly Pick<EffectLayer, "id">[];
  timeline: { tracks: readonly CanvasSelectionTrack[] };
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
    return owners.size === 1 ? ([...owners][0] ?? null) : null;
  }
  return null;

  function resolveKnownTrackLayerId(
    track: CanvasSelectionTrack | undefined,
  ): string | null {
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
    timeline: template.timeline ?? { tracks: [] },
  });
}

function getCanvasSelectionTarget(
  ctx: ViewerAppContext,
  template: EditorTemplate | null = ctx.getRenderTemplateSnapshot(
    ctx.state.currentTemplate,
  ),
): CanvasSelectionTarget | null {
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

export function createCanvasSelectionTargetActions(
  getContext: () => ViewerAppContext,
): Pick<
  CanvasSelectionActions,
  "getCanvasSelectionLayerId" | "getCanvasSelectionTarget"
> {
  return {
    getCanvasSelectionLayerId: bindViewerAction(
      getCanvasSelectionLayerId,
      getContext,
    ),
    getCanvasSelectionTarget: bindViewerAction(
      getCanvasSelectionTarget,
      getContext,
    ),
  };
}
