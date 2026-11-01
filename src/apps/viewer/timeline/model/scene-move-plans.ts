import { applyLinkedTimelineMove } from "./linked-move.js";
import { keyframeRefKey } from "./keyframe-reference.js";
import { bindViewerAction } from "../../app/bind-action.js";
import type { EditorTemplate } from "../../templates/model.js";

import type {
  SceneMovePlan,
  MovePlanOptions,
  KeyframeMoveItem,
  PhaseMoveItem,
  ClipMoveItem,
  TimelineWindow,
} from "./move-plan-model.js";
import type { ViewerAppContext } from "../../app/context.js";

function createSceneMovePlan(
  ctx: ViewerAppContext,
  effectiveTemplate: EditorTemplate,
  sceneIds: string[],
  totalDuration: number,
  includeLinkedKeys = true,
): SceneMovePlan {
  const scenes = ctx.normalizeScenes(
    effectiveTemplate.scenes ?? [],
    totalDuration,
  );
  const selected = new Set(sceneIds);
  const sceneItems = scenes
    .filter((scene) => selected.has(scene.id) && !scene.locked)
    .map((scene) => ({
      duration: scene.duration,
      scene,
      sceneId: scene.id,
      start: scene.start,
    }));
  const windows = sceneItems.map((item) => ({
    end: item.start + item.duration,
    sceneId: item.sceneId,
    start: item.start,
  }));
  const clips = ctx.deps.deepClone(effectiveTemplate.clips ?? []);
  const timeline = ctx.deps.deepClone(
    effectiveTemplate.timeline ?? {
      duration: totalDuration,
      phases: [],
      tracks: [],
    },
  );
  const globalLayerIds = ctx.getGlobalTimelineLayerIds(
    effectiveTemplate,
    scenes,
  );
  const clipItems: ClipMoveItem[] = [];
  const phaseItems: PhaseMoveItem[] = [];
  const keyframeItems: KeyframeMoveItem[] = [];
  const bounds: TimelineWindow[] = [];
  const addBound = (start: number, end = start) => {
    bounds.push({ end, start });
  };
  sceneItems.forEach((item) =>
    addBound(item.start, item.start + item.duration),
  );
  if (includeLinkedKeys) {
    clips.forEach((clip) => {
      if (
        !globalLayerIds.has(clip.layerId) &&
        ctx.timingBelongsToSelectedScene(clip, clip.start, windows, selected)
      ) {
        clipItems.push({
          clip,
          duration: Number(clip.duration) || 0.05,
          layerId: clip.layerId,
          start: Number(clip.start) || 0,
        });
        addBound(
          Number(clip.start) || 0,
          (Number(clip.start) || 0) + (Number(clip.duration) || 0),
        );
      }
    });
    (timeline.phases ?? []).forEach((phase) => {
      const phaseLayerIds = ctx.getPhaseTrackLayerIds(timeline, phase.id);
      if (
        ![...phaseLayerIds].some((layerId) => globalLayerIds.has(layerId)) &&
        ctx.timingBelongsToSelectedScene(
          phase,
          phase.start,
          windows,
          selected,
        ) &&
        !phase.locked
      ) {
        phaseItems.push({
          duration: Number(phase.duration) || 0.05,
          phase,
          phaseId: phase.id,
          start: Number(phase.start) || 0,
        });
        addBound(
          Number(phase.start) || 0,
          (Number(phase.start) || 0) + (Number(phase.duration) || 0),
        );
      }
    });
    const seenKeyframes = new Set();
    (timeline.tracks ?? []).forEach((track) => {
      const trackLayerId = ctx.getTrackLayerId(track);
      if (trackLayerId !== null && globalLayerIds.has(trackLayerId)) {
        return;
      }
      (track.keyframes ?? []).forEach((keyframe) => {
        const time = Number(keyframe.time) || 0;
        const key = keyframeRefKey({
          trackId: track.id,
          keyframeId: keyframe.id,
        });
        if (
          !seenKeyframes.has(key) &&
          ctx.timingBelongsToSelectedScene(
            keyframe,
            time,
            windows,
            selected,
            track.sceneId,
          )
        ) {
          seenKeyframes.add(key);
          keyframeItems.push({
            keyframe,
            keyframeId: keyframe.id,
            time,
            track,
            trackId: track.id,
          });
          addBound(time);
        }
      });
    });
  }
  const minStart = bounds.length
    ? Math.min(...bounds.map((item) => item.start))
    : 0;
  const maxEnd = bounds.length
    ? Math.max(...bounds.map((item) => item.end))
    : totalDuration;
  return {
    clipItems,
    clips,
    keyframeItems,
    maxDelta: totalDuration - maxEnd,
    minDelta: -minStart,
    phaseItems,
    sceneItems,
    scenes,
    timeline,
  };
}

function applySceneMovePlan(
  ctx: ViewerAppContext,
  template: { id: string } | null | undefined,
  plan: SceneMovePlan | null | undefined,
  deltaTime: number,
  options: MovePlanOptions = {},
): void {
  if (!template || !plan) {
    return;
  }
  const totalDuration = ctx.getEffectiveDuration(template);
  const delta =
    ctx.snapDuration(Math.abs(deltaTime)) * Math.sign(deltaTime || 0);
  plan.sceneItems.forEach((item) => {
    item.scene.start = ctx.snapTime(
      ctx.deps.clamp(item.start + delta, 0, totalDuration - item.duration),
    );
  });
  plan.clipItems.forEach((item) => {
    item.clip.start = ctx.snapTime(
      ctx.deps.clamp(item.start + delta, 0, totalDuration - item.duration),
    );
  });
  applyLinkedTimelineMove(ctx, plan, delta, totalDuration);
  ctx.setEditorOverride({ clips: plan.clips, scenes: plan.scenes });
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(plan.timeline, totalDuration),
  );
  if (options.render === false) {
    return;
  }
  ctx.renderTimelineEditor(template);
  void ctx.renderCurrentFrame();
}

export function createSceneMoveActions(getContext: () => ViewerAppContext) {
  return {
    createSceneMovePlan: bindViewerAction(createSceneMovePlan, getContext),
    applySceneMovePlan: bindViewerAction(applySceneMovePlan, getContext),
  };
}
