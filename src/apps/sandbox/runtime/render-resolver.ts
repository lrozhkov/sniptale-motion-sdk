import { evaluateTimelineKeyframes } from "../../../sdk/timeline/keyframe-value.js";
import { segment } from "./math.js";
import { resolveRuntimeMotionPathTrackValue } from "./render-motion-path.js";

type TimelineIndex = {
  activeKeyframesByTrack: Map<any, any[]>;
  phasesById: Map<string, any>;
  scenesById: Map<string, any>;
  tracksById: Map<string, any>;
};

const clipIndexes = new WeakMap<any[], Map<string, any[]>>();
const layerIndexes = new WeakMap<any[], Map<string, any>>();
const sceneIndexes = new WeakMap<any[], Map<string, any>>();
const timelineIndexes = new WeakMap<object, TimelineIndex>();

export function isLayerActive(
  clips: any[],
  layerId: string,
  time: number,
  scenes: any[] = [],
): boolean {
  const layerClips = getClipsByLayer(clips).get(layerId) ?? [];
  if (layerClips.length === 0) {
    return true;
  }
  return layerClips.some(
    (clip) =>
      clip.enabled !== false &&
      isSceneEnabled(scenes, clip.sceneId) &&
      time >= clip.start &&
      time <= clip.start + clip.duration,
  );
}

export function resolveLayerState(
  layers: any[],
  clips: any[],
  timeline: any,
  layerId: string,
  time: number,
): any {
  const layer = getLayersById(layers).get(layerId) ?? {
    id: layerId,
    opacity: 1,
    visible: true,
    x: 0,
    y: 0,
  };
  const clip =
    (getClipsByLayer(clips).get(layerId) ?? []).find(
      (item) =>
        item.layerId === layerId &&
        item.enabled !== false &&
        isSceneEnabled(timeline.scenes, item.sceneId) &&
        time >= item.start &&
        time <= item.start + item.duration,
    ) ?? null;
  const blur = resolveTrackValue(
    timeline,
    `${layerId}.blur`,
    time,
    layer.blur ?? 0,
  );
  const anchorX = resolveTrackValue(
    timeline,
    `${layerId}.anchorX`,
    time,
    layer.anchorX ?? 0,
  );
  const anchorY = resolveTrackValue(
    timeline,
    `${layerId}.anchorY`,
    time,
    layer.anchorY ?? 0,
  );
  const opacity = resolveTrackValue(
    timeline,
    `${layerId}.opacity`,
    time,
    layer.opacity ?? 1,
  );
  const rotation = resolveTrackValue(
    timeline,
    `${layerId}.rotation`,
    time,
    layer.rotation ?? 0,
  );
  const scaleX = resolveTrackValue(
    timeline,
    `${layerId}.scaleX`,
    time,
    layer.scaleX ?? 1,
  );
  const scaleY = resolveTrackValue(
    timeline,
    `${layerId}.scaleY`,
    time,
    layer.scaleY ?? 1,
  );
  const x = resolveTrackValue(timeline, `${layerId}.x`, time, layer.x ?? 0);
  const y = resolveTrackValue(timeline, `${layerId}.y`, time, layer.y ?? 0);
  return {
    ...layer,
    active:
      layer.visible !== false &&
      isLayerActive(clips, layerId, time, timeline.scenes),
    anchorX,
    anchorY,
    blur,
    clip,
    clipProgress: clip
      ? segment(time, clip.start, clip.start + clip.duration)
      : 1,
    localTime: clip ? Math.max(0, time - clip.start + clip.offset) : time,
    opacity,
    rotation,
    scaleX,
    scaleY,
    x,
    y,
  };
}

export function resolvePhaseProgress(
  timeline: any,
  phaseId: string,
  time: number,
): number {
  const phase = getTimelineIndex(timeline).phasesById.get(phaseId);
  if (
    !phase ||
    phase.enabled === false ||
    !isSceneEnabled(timeline.scenes, phase.sceneId)
  ) {
    return 0;
  }
  return segment(time, phase.start, phase.start + phase.duration);
}

export function resolveTrackValue(
  timeline: any,
  trackId: string,
  time: number,
  fallback: any,
): any {
  const index = getTimelineIndex(timeline);
  const track = index.tracksById.get(trackId);
  if (
    !track ||
    track.enabled === false ||
    !isSceneEnabled(timeline.scenes, track.sceneId) ||
    !isPhaseEnabled(timeline, track.phaseId)
  ) {
    return fallback;
  }
  const motionPathValue = resolveRuntimeMotionPathTrackValue(
    timeline,
    track,
    time,
  );
  if (motionPathValue !== null) {
    return motionPathValue;
  }
  const keyframes = index.activeKeyframesByTrack.get(track) ?? [];
  return evaluateTimelineKeyframes(keyframes, time, fallback);
}

function isSceneEnabled(scenes: any[] = [], sceneId: string | null = null) {
  if (!sceneId) {
    return true;
  }
  const scene = getScenesById(scenes).get(sceneId);
  return !scene || scene.enabled !== false;
}

function isPhaseEnabled(timeline: any, phaseId: string | null = null) {
  if (!phaseId) {
    return true;
  }
  const phase = getTimelineIndex(timeline).phasesById.get(phaseId);
  return Boolean(
    phase &&
    phase.enabled !== false &&
    isSceneEnabled(timeline.scenes, phase.sceneId),
  );
}

function getTimelineIndex(timeline: any): TimelineIndex {
  if (!timeline || typeof timeline !== "object") {
    return {
      activeKeyframesByTrack: new Map(),
      phasesById: new Map(),
      scenesById: new Map(),
      tracksById: new Map(),
    };
  }
  const cached = timelineIndexes.get(timeline);
  if (cached) {
    return cached;
  }
  const phases = Array.isArray(timeline.phases) ? timeline.phases : [];
  const scenes = Array.isArray(timeline.scenes) ? timeline.scenes : [];
  const tracks = Array.isArray(timeline.tracks) ? timeline.tracks : [];
  const index: TimelineIndex = {
    activeKeyframesByTrack: new Map(),
    phasesById: new Map(phases.map((phase) => [phase.id, phase])),
    scenesById: getScenesById(scenes),
    tracksById: new Map(tracks.map((track) => [track.id, track])),
  };
  timelineIndexes.set(timeline, index);
  for (const track of tracks) {
    index.activeKeyframesByTrack.set(
      track,
      (track.keyframes ?? []).filter(
        (keyframe) =>
          keyframe.enabled !== false &&
          isSceneEnabledFromIndex(index, keyframe.sceneId) &&
          isPhaseEnabledFromIndex(index, keyframe.phaseId),
      ),
    );
  }
  return index;
}

function getLayersById(layers: any[]): Map<string, any> {
  let index = layerIndexes.get(layers);
  if (!index) {
    index = new Map(layers.map((layer) => [layer.id, layer]));
    layerIndexes.set(layers, index);
  }
  return index;
}

function getClipsByLayer(clips: any[]): Map<string, any[]> {
  let index = clipIndexes.get(clips);
  if (!index) {
    index = new Map();
    for (const clip of clips) {
      const layerClips = index.get(clip.layerId) ?? [];
      layerClips.push(clip);
      index.set(clip.layerId, layerClips);
    }
    clipIndexes.set(clips, index);
  }
  return index;
}

function getScenesById(scenes: any[]): Map<string, any> {
  let index = sceneIndexes.get(scenes);
  if (!index) {
    index = new Map(scenes.map((scene) => [scene.id, scene]));
    sceneIndexes.set(scenes, index);
  }
  return index;
}

function isSceneEnabledFromIndex(
  index: TimelineIndex,
  sceneId: string | null = null,
): boolean {
  if (!sceneId) {
    return true;
  }
  const scene = index.scenesById.get(sceneId);
  return !scene || scene.enabled !== false;
}

function isPhaseEnabledFromIndex(
  index: TimelineIndex,
  phaseId: string | null = null,
): boolean {
  if (!phaseId) {
    return true;
  }
  const phase = index.phasesById.get(phaseId);
  return Boolean(
    phase &&
    phase.enabled !== false &&
    isSceneEnabledFromIndex(index, phase.sceneId),
  );
}
