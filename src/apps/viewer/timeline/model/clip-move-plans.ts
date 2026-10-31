import { bindViewerAction } from "../../app/bind-action.js";
import type { EditorTemplate } from "../../templates/model.js";
import type { EditorTimeline } from "../../editor/model-types.js";
import type { MotionPathTrack } from "../../../../shared/timeline/motion-path.js";
import type {
  TimelineKeyframe,
  EffectClip,
  EffectScene,
} from "../../../../sdk/types.js";
import type {
  SceneMoveBounds,
  ClipMovePlan,
  MovePlanOptions,
  KeyframeMoveItem,
  PhaseMoveItem,
  TimelineWindow,
} from "./move-plan-model.js";
import type { ViewerAppContext } from "../../app/context.js";

function createClipMovePlan(
  ctx: ViewerAppContext,
  effectiveTemplate: EditorTemplate | null | undefined,
  layerIds: string[],
  totalDuration: number,
  includeLinkedKeys = true,
): ClipMovePlan {
  const selected = new Set(layerIds);
  const clips = ctx.deps.deepClone(effectiveTemplate?.clips ?? []);
  const timeline = ctx.deps.deepClone(
    effectiveTemplate?.timeline ?? {
      duration: totalDuration,
      phases: [],
      tracks: [],
    },
  );
  const movablePhaseIds = includeLinkedKeys
    ? ctx.getClipMovablePhaseIds(timeline, clips, selected)
    : new Set();
  const clipItems = clips
    .filter((clip) => selected.has(clip.layerId) && !clip.locked)
    .map((clip) => ({
      clip,
      duration: Number(clip.duration) || 0.05,
      layerId: clip.layerId,
      start: Number(clip.start) || 0,
    }));
  const windows = clipItems.map((item) => ({
    end: item.start + item.duration,
    layerId: item.layerId,
    sceneId: item.clip.sceneId ?? null,
    start: item.start,
  }));
  const scenesById = new Map<string, EffectScene>(
    (effectiveTemplate?.scenes ?? []).map((scene) => [scene.id, scene]),
  );
  const keyframeItems: KeyframeMoveItem[] = [];
  const phaseItems: PhaseMoveItem[] = [];
  const bounds: TimelineWindow[] = [];
  const sceneBounds = new Map<string, SceneMoveBounds>();
  const minDeltas: number[] = [];
  const maxDeltas: number[] = [];
  const addBound = (
    start: number,
    end = start,
    sceneId: string | null = null,
  ) => {
    bounds.push({ end, start });
    if (!sceneId) {
      return;
    }
    const scene = scenesById.get(sceneId);
    if (!scene) {
      return;
    }
    const sceneStart = Number(scene.start) || 0;
    const sceneEnd = sceneStart + (Number(scene.duration) || 0);
    const existing = sceneBounds.get(sceneId) ?? {
      maxEnd: end,
      minStart: start,
      sceneEnd,
      sceneStart,
    };
    existing.minStart = Math.min(existing.minStart, start);
    existing.maxEnd = Math.max(existing.maxEnd, end);
    sceneBounds.set(sceneId, existing);
  };
  clipItems.forEach((item) => {
    addBound(item.start, item.start + item.duration, item.clip.sceneId ?? null);
  });
  if (includeLinkedKeys) {
    const seenKeyframes = new Set();
    const seenPhases = new Set();
    (timeline.tracks ?? []).forEach((track) => {
      const layerId = ctx.getTrackLayerId(track);
      if (!layerId || !selected.has(layerId)) {
        return;
      }
      const window = windows.find((item) => item.layerId === layerId);
      (track.keyframes ?? []).forEach((keyframe) => {
        const time = Number(keyframe.time) || 0;
        const key = `${track.id}:${keyframe.id}`;
        if (
          seenKeyframes.has(key) ||
          (window && !ctx.isTimeInsideRange(time, window.start, window.end)) ||
          (window &&
            !ctx.keyframeCanMoveWithClip(timeline, track, keyframe, window))
        ) {
          return;
        }
        seenKeyframes.add(key);
        keyframeItems.push({
          keyframe,
          keyframeId: keyframe.id,
          time,
          track,
          trackId: track.id,
        });
        addBound(time, time, window?.sceneId ?? track.sceneId ?? null);
        const phaseId = keyframe.phaseId ?? track.phaseId;
        const phase = (timeline.phases ?? []).find(
          (item) => item.id === phaseId,
        );
        if (
          phase &&
          !phase.locked &&
          movablePhaseIds.has(phase.id) &&
          !seenPhases.has(phase.id)
        ) {
          seenPhases.add(phase.id);
          phaseItems.push({
            duration: Number(phase.duration) || 0.05,
            phase,
            phaseId: phase.id,
            start: Number(phase.start) || 0,
          });
          addBound(
            Number(phase.start) || 0,
            (Number(phase.start) || 0) + (Number(phase.duration) || 0),
            phase.sceneId ?? window?.sceneId ?? null,
          );
        }
      });
    });
  }
  sceneBounds.forEach((item) => {
    minDeltas.push(item.sceneStart - item.minStart);
    maxDeltas.push(item.sceneEnd - item.maxEnd);
  });
  const minStart = bounds.length
    ? Math.min(...bounds.map((item) => item.start))
    : 0;
  const maxEnd = bounds.length
    ? Math.max(...bounds.map((item) => item.end))
    : totalDuration;
  minDeltas.push(-minStart);
  maxDeltas.push(totalDuration - maxEnd);
  return {
    clipItems,
    clips,
    keyframeItems,
    maxDelta: Math.min(...maxDeltas),
    minDelta: Math.max(...minDeltas),
    phaseItems,
    timeline,
  };
}

function keyframeCanMoveWithClip(
  ctx: ViewerAppContext,
  timeline: EditorTimeline | null | undefined,
  track: MotionPathTrack,
  keyframe: TimelineKeyframe<unknown>,
  clipOrWindow: { sceneId?: string | null } | null | undefined,
): boolean {
  const clipSceneId = clipOrWindow?.sceneId ?? null;
  if (!clipSceneId) {
    return true;
  }
  const keySceneId = ctx.getKeyframeOwnershipSceneId(timeline, track, keyframe);
  return !keySceneId || keySceneId === clipSceneId;
}

function keyframePhaseCanMoveWithClip(
  _ctx: ViewerAppContext,
  _timeline: EditorTimeline | null | undefined,
  track: MotionPathTrack,
  keyframe: TimelineKeyframe<unknown>,
  movablePhaseIds: ReadonlySet<string>,
): boolean {
  const phaseId = keyframe?.phaseId ?? track?.phaseId;
  return !phaseId || movablePhaseIds.has(phaseId);
}

function getClipMovablePhaseIds(
  ctx: ViewerAppContext,
  timeline: EditorTimeline,
  clips: EffectClip[],
  selectedLayerIds: ReadonlySet<string>,
): Set<string> {
  const explicitPhaseIds = new Set(
    (timeline.phases ?? []).map((phase) => phase.id),
  );
  const phaseOwners = new Map<string, Set<string>>();
  for (const track of timeline.tracks ?? []) {
    const layerId = ctx.getTrackLayerId(track);
    for (const keyframe of track.keyframes ?? []) {
      const phaseId = keyframe.phaseId ?? track.phaseId;
      if (!phaseId || !explicitPhaseIds.has(phaseId)) {
        continue;
      }
      const owners = phaseOwners.get(phaseId) ?? new Set<string>();
      owners.add(layerId ?? "__scene__");
      phaseOwners.set(phaseId, owners);
    }
  }
  const movable = new Set<string>();
  for (const [phaseId, owners] of phaseOwners) {
    if ([...owners].every((owner) => selectedLayerIds.has(owner))) {
      movable.add(phaseId);
    }
  }
  for (const clip of clips ?? []) {
    if (selectedLayerIds.has(clip.layerId)) {
      const layerPhaseIds = [...phaseOwners.entries()]
        .filter(([, owners]) => owners.size === 1 && owners.has(clip.layerId))
        .map(([phaseId]) => phaseId);
      layerPhaseIds.forEach((phaseId) => movable.add(phaseId));
    }
  }
  return movable;
}

function applyClipMovePlan(
  ctx: ViewerAppContext,
  template: { id: string } | null | undefined,
  plan: ClipMovePlan | null | undefined,
  deltaTime: number,
  options: MovePlanOptions = {},
): void {
  if (!template || !plan) {
    return;
  }
  const totalDuration = ctx.getEffectiveDuration(template);
  const delta =
    ctx.snapDuration(Math.abs(deltaTime)) * Math.sign(deltaTime || 0);
  plan.clipItems.forEach((item) => {
    item.clip.start = ctx.snapTime(
      ctx.deps.clamp(item.start + delta, 0, totalDuration - item.duration),
    );
  });
  plan.keyframeItems.forEach((item) => {
    item.keyframe.time = ctx.snapTime(
      ctx.deps.clamp(item.time + delta, 0, totalDuration),
    );
  });
  plan.phaseItems?.forEach((item) => {
    item.phase.start = ctx.snapTime(
      ctx.deps.clamp(item.start + delta, 0, totalDuration - item.duration),
    );
  });
  (plan.timeline.tracks ?? []).forEach((track) => {
    track.keyframes = [...(track.keyframes ?? [])].sort(
      (a, b) => a.time - b.time,
    );
  });
  ctx.setEditorOverride({ clips: plan.clips });
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

export function createClipMoveActions(getContext: () => ViewerAppContext) {
  return {
    createClipMovePlan: bindViewerAction(createClipMovePlan, getContext),
    keyframeCanMoveWithClip: bindViewerAction(
      keyframeCanMoveWithClip,
      getContext,
    ),
    keyframePhaseCanMoveWithClip: bindViewerAction(
      keyframePhaseCanMoveWithClip,
      getContext,
    ),
    getClipMovablePhaseIds: bindViewerAction(
      getClipMovablePhaseIds,
      getContext,
    ),
    applyClipMovePlan: bindViewerAction(applyClipMovePlan, getContext),
  };
}
