import type {
  EffectScene,
  EffectClip,
  TimelinePhase,
  TimelineKeyframe,
} from "../../../sdk/types.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type { RuntimeTimeline } from "./render-normalization.js";
import { evaluateTimelineKeyframes } from "../../../sdk/timeline/keyframe-value.js";
import { segment } from "./math.js";
import { resolveRuntimeMotionPathTrackValue } from "./render-motion-path.js";

export type RuntimeLayerSource = Record<string, unknown> & {
  id: string;
  visible?: boolean;
};
export type RuntimeResolvedLayer = RuntimeLayerSource & {
  active: boolean;
  anchorX: unknown;
  anchorY: unknown;
  blur: unknown;
  opacity: unknown;
  rotation: unknown;
  scaleX: unknown;
  scaleY: unknown;
  x: unknown;
  y: unknown;
  clip: EffectClip | null;
  clipProgress: number;
  localTime: number;
};

type TimelineIndex = {
  activeKeyframesByTrack: Map<MotionPathTrack, TimelineKeyframe<unknown>[]>;
  phasesById: Map<string, TimelinePhase>;
  scenesById: Map<string, EffectScene>;
  tracksById: Map<string, MotionPathTrack>;
};

const clipIndexes = new WeakMap<EffectClip[], Map<string, EffectClip[]>>();
const layerIndexes = new WeakMap<
  RuntimeLayerSource[],
  Map<string, RuntimeLayerSource>
>();
const sceneIndexes = new WeakMap<EffectScene[], Map<string, EffectScene>>();
const timelineIndexes = new WeakMap<object, TimelineIndex>();

export function isLayerActive(
  clips: EffectClip[],
  layerId: string,
  time: number,
  scenes: EffectScene[] = [],
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
  layers: RuntimeLayerSource[],
  clips: EffectClip[],
  timeline: RuntimeTimeline,
  layerId: string,
  time: number,
  onTrackRead?: (trackId: string) => void,
): RuntimeResolvedLayer {
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
  const readTrack = (property: string, fallback: unknown) => {
    const trackId = `${layerId}.${property}`;
    return resolveTrackValue(timeline, trackId, time, fallback, onTrackRead);
  };
  const blur = readTrack("blur", layer.blur ?? 0);
  const anchorX = readTrack("anchorX", layer.anchorX ?? 0);
  const anchorY = readTrack("anchorY", layer.anchorY ?? 0);
  const opacity = readTrack("opacity", layer.opacity ?? 1);
  const rotation = readTrack("rotation", layer.rotation ?? 0);
  const scaleX = readTrack("scaleX", layer.scaleX ?? 1);
  const scaleY = readTrack("scaleY", layer.scaleY ?? 1);
  const x = readTrack("x", layer.x ?? 0);
  const y = readTrack("y", layer.y ?? 0);
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
    localTime: clip
      ? Math.max(0, time - clip.start + (clip.offset ?? 0))
      : time,
    opacity,
    rotation,
    scaleX,
    scaleY,
    x,
    y,
  };
}

export function resolvePhaseProgress(
  timeline: RuntimeTimeline,
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
  timeline: RuntimeTimeline,
  trackId: string,
  time: number,
  fallback: unknown,
  onTrackRead?: (trackId: string) => void,
): unknown {
  const index = getTimelineIndex(timeline);
  const track = index.tracksById.get(trackId);
  if (track) onTrackRead?.(trackId);
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

function isSceneEnabled(
  scenes: EffectScene[] = [],
  sceneId: string | null = null,
) {
  if (!sceneId) {
    return true;
  }
  const scene = getScenesById(scenes).get(sceneId);
  return !scene || scene.enabled !== false;
}

function isPhaseEnabled(
  timeline: RuntimeTimeline,
  phaseId: string | null = null,
) {
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

function getTimelineIndex(timeline: RuntimeTimeline): TimelineIndex {
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

function getLayersById(
  layers: RuntimeLayerSource[],
): Map<string, RuntimeLayerSource> {
  let index = layerIndexes.get(layers);
  if (!index) {
    index = new Map(layers.map((layer) => [layer.id, layer]));
    layerIndexes.set(layers, index);
  }
  return index;
}

function getClipsByLayer(clips: EffectClip[]): Map<string, EffectClip[]> {
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

function getScenesById(scenes: EffectScene[]): Map<string, EffectScene> {
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
