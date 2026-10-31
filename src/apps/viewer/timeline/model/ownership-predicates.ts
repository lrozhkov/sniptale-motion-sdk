import { keyframeRefKey } from "./keyframe-reference.js";
import { bindViewerAction } from "../../app/bind-action.js";
import type { EditorTemplate } from "../../templates/model.js";
import type { EditorTimeline } from "../../editor/model-types.js";
import type { MotionPathTrack } from "../../../../shared/timeline/motion-path.js";
import type {
  TimelineKeyframe,
  EffectClip,
  EffectScene,
  TimelinePhase,
} from "../../../../sdk/types.js";
import type { TimelineWindow } from "./move-plan-model.js";
import type { ViewerAppContext } from "../../app/context.js";

function clipBelongsToScene(
  ctx: ViewerAppContext,
  clip: EffectClip | null | undefined,
  scene: EffectScene,
): boolean {
  if (typeof clip?.sceneId === "string") {
    return clip.sceneId === scene.id;
  }
  return ctx.timeBelongsToScene(Number(clip?.start) || 0, scene);
}

function isGlobalTimelineClip(
  ctx: ViewerAppContext,
  clip: EffectClip | null | undefined,
  scenes: EffectScene[],
): boolean {
  if (typeof clip?.sceneId === "string" || scenes.length <= 1) {
    return false;
  }
  const start = Number(clip?.start) || 0;
  const duration = Number(clip?.duration) || 0;
  return !scenes.some((scene) =>
    ctx.isRangeInsideScene(start, duration, scene),
  );
}

function getGlobalTimelineLayerIds(
  ctx: ViewerAppContext,
  template: EditorTemplate | null | undefined,
  scenes: EffectScene[] = ctx.normalizeScenes(
    template?.scenes ?? [],
    Number(template?.duration) || 0,
  ),
): Set<string> {
  return new Set<string>(
    (template?.clips ?? [])
      .filter((clip) => ctx.isGlobalTimelineClip(clip, scenes))
      .map((clip) => clip.layerId),
  );
}

function phaseBelongsToScene(
  ctx: ViewerAppContext,
  phase: TimelinePhase | null | undefined,
  scene: EffectScene,
): boolean {
  if (typeof phase?.sceneId === "string") {
    return phase.sceneId === scene.id;
  }
  return ctx.timeBelongsToScene(Number(phase?.start) || 0, scene);
}

function keyframeBelongsToScene(
  ctx: ViewerAppContext,
  track: MotionPathTrack,
  keyframe: TimelineKeyframe<unknown>,
  scene: EffectScene,
  timeline: EditorTimeline = ctx.getEffectiveTimeline(
    ctx.state.currentTemplate,
  ),
): boolean {
  const sceneId = ctx.getKeyframeOwnershipSceneId(timeline, track, keyframe);
  if (sceneId) {
    return sceneId === scene.id;
  }
  const time = Number(keyframe?.time) || 0;
  if (ctx.timeBelongsToScene(time, scene)) {
    return true;
  }
  const compositionEnd = ctx.getEffectiveDuration(ctx.state.currentTemplate);
  const sceneEnd = (Number(scene?.start) || 0) + Number(scene?.duration || 0);
  return (
    Math.abs(time - compositionEnd) < 0.0001 &&
    Math.abs(sceneEnd - compositionEnd) < 0.0001
  );
}

function timeBelongsToScene(
  _ctx: ViewerAppContext,
  time: number,
  scene: EffectScene,
): boolean {
  const sceneStart = Number(scene.start) || 0;
  const sceneEnd = sceneStart + Number(scene.duration || 0);
  return time >= sceneStart - 0.0001 && time < sceneEnd - 0.0001;
}

function keyframeLinkKey(
  _ctx: ViewerAppContext,
  trackId: string,
  keyframeId: string,
): string {
  return keyframeRefKey({ trackId, keyframeId });
}

function keyframeBelongsToSelectedPhase(
  _ctx: ViewerAppContext,
  keyframe: TimelineKeyframe<unknown>,
  track: MotionPathTrack,
  selectedPhaseIds: ReadonlySet<string>,
): boolean {
  if (typeof keyframe?.phaseId === "string") {
    return selectedPhaseIds.has(keyframe.phaseId);
  }
  return (
    typeof track?.phaseId === "string" && selectedPhaseIds.has(track.phaseId)
  );
}

function timingBelongsToSelectedScene(
  ctx: ViewerAppContext,
  item: { sceneId?: string | null },
  fallbackTime: number,
  windows: TimelineWindow[],
  selectedSceneIds: ReadonlySet<string>,
  parentSceneId: string | null = null,
): boolean {
  const sceneId =
    typeof item?.sceneId === "string" ? item.sceneId : parentSceneId;
  if (sceneId) {
    return selectedSceneIds.has(sceneId);
  }
  return ctx.isTimeInsideAnyScene(Number(fallbackTime) || 0, windows);
}

function inferTrackProperty(
  _ctx: ViewerAppContext,
  track: Partial<Pick<MotionPathTrack, "id" | "property">> | null | undefined,
): string | null {
  if (typeof track?.property === "string") {
    return track.property;
  }
  if (typeof track?.id === "string" && track.id.includes(".")) {
    return track.id.split(".").slice(1).join(".");
  }
  return null;
}

function getPhaseTrackLayerIds(
  ctx: ViewerAppContext,
  timeline: EditorTimeline | null | undefined,
  phaseId: string,
): Set<string> {
  const owners = new Set<string>();
  for (const track of timeline?.tracks ?? []) {
    if (track?.phaseId === phaseId) {
      owners.add(ctx.getTrackLayerId(track) ?? "__scene__");
      continue;
    }
    if (
      (track?.keyframes ?? []).some((keyframe) => keyframe?.phaseId === phaseId)
    ) {
      owners.add(ctx.getTrackLayerId(track) ?? "__scene__");
    }
  }
  return owners;
}

function isPhaseCompatibleWithLayer(
  ctx: ViewerAppContext,
  timeline: EditorTimeline,
  phaseId: string | null | undefined,
  layerId: string | null | undefined,
): boolean {
  if (!phaseId) {
    return true;
  }
  const owners = ctx.getPhaseTrackLayerIds(timeline, phaseId);
  if (owners.size === 0) {
    return true;
  }
  return owners.has(layerId ?? "__scene__");
}

function isTimeInsideAnyScene(
  _ctx: ViewerAppContext,
  time: number,
  windows: TimelineWindow[],
): boolean {
  return windows.some(
    (window) => time >= window.start - 0.0001 && time < window.end - 0.0001,
  );
}

export function createTimelineOwnershipPredicates(
  getContext: () => ViewerAppContext,
) {
  return {
    isTimeInsideAnyScene: bindViewerAction(isTimeInsideAnyScene, getContext),
    clipBelongsToScene: bindViewerAction(clipBelongsToScene, getContext),
    isGlobalTimelineClip: bindViewerAction(isGlobalTimelineClip, getContext),
    getGlobalTimelineLayerIds: bindViewerAction(
      getGlobalTimelineLayerIds,
      getContext,
    ),
    phaseBelongsToScene: bindViewerAction(phaseBelongsToScene, getContext),
    keyframeBelongsToScene: bindViewerAction(
      keyframeBelongsToScene,
      getContext,
    ),
    timeBelongsToScene: bindViewerAction(timeBelongsToScene, getContext),
    keyframeLinkKey: bindViewerAction(keyframeLinkKey, getContext),
    keyframeBelongsToSelectedPhase: bindViewerAction(
      keyframeBelongsToSelectedPhase,
      getContext,
    ),
    timingBelongsToSelectedScene: bindViewerAction(
      timingBelongsToSelectedScene,
      getContext,
    ),
    inferTrackProperty: bindViewerAction(inferTrackProperty, getContext),
    getPhaseTrackLayerIds: bindViewerAction(getPhaseTrackLayerIds, getContext),
    isPhaseCompatibleWithLayer: bindViewerAction(
      isPhaseCompatibleWithLayer,
      getContext,
    ),
  };
}
