import type {
  EffectClip,
  EffectScene,
  TimelineKeyframe,
  TimelinePhase,
} from "../../../../sdk/types.js";
import type { MotionPathTrack } from "../../../../shared/timeline/motion-path.js";
import type { EditorTimeline } from "../../editor/model-types.js";

export type TimelineWindow = {
  start: number;
  end: number;
  sceneId?: string | null;
};
export type KeyframeMoveItem = {
  keyframe: TimelineKeyframe<unknown>;
  keyframeId: string;
  time: number;
  track: MotionPathTrack;
  trackId: string;
};
export type PhaseMoveItem = {
  phase: TimelinePhase;
  phaseId: string;
  start: number;
  duration: number;
};
export type ClipMoveItem = {
  clip: EffectClip;
  layerId: string;
  start: number;
  duration: number;
};
export type PhaseMovePlan = {
  timeline: EditorTimeline;
  phaseItems: PhaseMoveItem[];
  keyframeItems: KeyframeMoveItem[];
  minDelta: number;
  maxDelta: number;
};
export type ClipMovePlan = PhaseMovePlan & {
  clips: EffectClip[];
  clipItems: ClipMoveItem[];
};
export type SceneMovePlan = ClipMovePlan & {
  scenes: EffectScene[];
  sceneItems: {
    scene: EffectScene;
    sceneId: string;
    start: number;
    duration: number;
  }[];
};
export type MovePlanOptions = { render?: boolean };
export type SceneMoveBounds = {
  minStart: number;
  maxEnd: number;
  sceneStart: number;
  sceneEnd: number;
};
