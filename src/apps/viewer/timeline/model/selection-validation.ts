import type { EffectLayer } from "../../../../sdk/types.js";
import type { MotionPathTrack } from "../../../../shared/timeline/motion-path.js";
import type {
  ViewerSelection,
  KeyframeSelectionRef,
} from "./selection-model.js";

type SelectionDocument = {
  layers?: readonly EffectLayer[];
  clips?: readonly { layerId: string }[];
  duration: number;
  scenes?: unknown;
  timeline?: {
    phases?: readonly { id: string }[];
    tracks?: readonly MotionPathTrack[];
  };
};

type SelectionIndexes = {
  layerIds: ReadonlySet<string>;
  clipLayerIds: ReadonlySet<string>;
  phaseIds: ReadonlySet<string>;
  sceneIds: ReadonlySet<string>;
  trackById: ReadonlyMap<string, MotionPathTrack>;
};

export function createSelectionIndexes(
  template: SelectionDocument,
  normalizeScenes: (
    scenes: unknown,
    duration: number,
  ) => readonly { id: string }[],
): SelectionIndexes {
  const layerIds = new Set(
    (template.layers ?? []).map((layer) => String(layer.id)),
  );
  const clipLayerIds = new Set(
    (template.clips ?? []).map((clip) => String(clip.layerId)),
  );
  const phaseIds = new Set(
    (template.timeline?.phases ?? []).map((phase) => String(phase.id)),
  );
  const scenes = normalizeScenes(template.scenes ?? [], template.duration);
  const sceneIds = new Set(scenes.map((scene) => String(scene.id)));
  const trackById = new Map(
    (template.timeline?.tracks ?? []).map((track) => [String(track.id), track]),
  );

  return { layerIds, clipLayerIds, phaseIds, sceneIds, trackById };
}

export function normalizePrimarySelectionItem(
  item: unknown,
  assets: ReadonlyMap<string, unknown> | null | undefined,
  indexes: SelectionIndexes,
): ViewerSelection | null {
  if (!isRecord(item)) {
    return null;
  }
  if (item.type === "effect") {
    return { type: "effect" };
  }
  if (
    item.type === "layer" &&
    typeof item.layerId === "string" &&
    indexes.layerIds.has(item.layerId)
  ) {
    return { layerId: item.layerId, type: "layer" };
  }
  if (
    item.type === "clip" &&
    typeof item.layerId === "string" &&
    indexes.clipLayerIds.has(item.layerId)
  ) {
    return { layerId: item.layerId, type: "clip" };
  }
  if (
    item.type === "phase" &&
    typeof item.phaseId === "string" &&
    indexes.phaseIds.has(item.phaseId)
  ) {
    return { phaseId: item.phaseId, type: "phase" };
  }
  if (
    item.type === "scene" &&
    typeof item.sceneId === "string" &&
    indexes.sceneIds.has(item.sceneId)
  ) {
    return { sceneId: item.sceneId, type: "scene" };
  }
  if (
    item.type === "track" &&
    typeof item.trackId === "string" &&
    indexes.trackById.has(item.trackId)
  ) {
    return { trackId: item.trackId, type: "track" };
  }
  if (
    item.type === "keyframe" &&
    typeof item.trackId === "string" &&
    typeof item.keyframeId === "string" &&
    hasKeyframe(indexes.trackById, item.trackId, item.keyframeId)
  ) {
    return {
      keyframeId: item.keyframeId,
      trackId: item.trackId,
      type: "keyframe",
    };
  }
  if (
    item.type === "asset" &&
    typeof item.assetId === "string" &&
    assets?.has(item.assetId)
  ) {
    return { assetId: item.assetId, type: "asset" };
  }
  return null;
}

export function filterSelectionIds(
  values: unknown,
  allowed: ReadonlySet<string>,
): string[] {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .filter((value) => typeof value === "string")
        .filter((value) => allowed.has(value)),
    ),
  ];
}

function hasKeyframe(
  trackById: ReadonlyMap<string, MotionPathTrack>,
  trackId: string,
  keyframeId: string,
): boolean {
  const track = trackById.get(String(trackId));
  return Boolean(
    track?.keyframes?.some(
      (keyframe) => String(keyframe.id) === String(keyframeId),
    ),
  );
}

export function parseKeyframeSelectionRef(
  value: unknown,
): KeyframeSelectionRef | null {
  if (
    !isRecord(value) ||
    typeof value.trackId !== "string" ||
    !value.trackId ||
    typeof value.keyframeId !== "string" ||
    !value.keyframeId
  )
    return null;
  return { trackId: value.trackId, keyframeId: value.keyframeId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
