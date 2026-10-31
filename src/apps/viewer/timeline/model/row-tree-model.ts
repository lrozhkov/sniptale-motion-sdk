import type {
  EffectClip,
  EffectLayer,
  EffectScene,
  TimelineKeyframe,
  TimelinePhase,
} from "../../../../sdk/types.js";
import type { MotionPathTrack } from "../../../../shared/timeline/motion-path.js";

export type TimelineScene = EffectScene & { isGlobalTimelineScope?: boolean };
export type TimelineTrackParent = {
  id: string;
  type: "phase" | "layer" | "layerPhase" | "scenePhase" | "scene" | "clip";
  layerId?: string | null;
  phaseId?: string | null;
};
export type TimelinePhaseParent = {
  id: string;
  type: "layerPhase" | "scenePhase";
};
export type TimelineTrackRow = {
  depth?: number;
  keyframes: TimelineKeyframe<unknown>[];
  parent: TimelineTrackParent;
  track: MotionPathTrack;
};
export type TimelinePhaseRow = {
  depth?: number;
  expansionId: string;
  parent: TimelinePhaseParent;
  phase: TimelinePhase;
  tracks: TimelineTrackRow[];
};
export type TimelineLayerLeafRow = {
  clip: EffectClip | null;
  depth?: number;
  directTracks: TimelineTrackRow[];
  expansionId: string;
  kind: "layer";
  layer: EffectLayer | null;
  layerId: string;
  phases: TimelinePhaseRow[];
};
export type TimelineLayerGroupRow = {
  allLeafIds: string[];
  children: TimelineLayerRow[];
  depth?: number;
  expansionId: string;
  kind: "group";
  layer: EffectLayer;
  layerId: string;
  leafIds: string[];
  parentId: string | null;
};
export type TimelineLayerRow = TimelineLayerLeafRow | TimelineLayerGroupRow;
export type TimelineSceneRow = {
  layers: TimelineLayerRow[];
  scene: TimelineScene;
  scenePhases: TimelinePhaseRow[];
  sceneTracks: TimelineTrackRow[];
};
export type TimelineRowTree = {
  globalLayers: TimelineLayerRow[];
  globalScene: TimelineScene | null;
  scenes: TimelineSceneRow[];
};

export type TimelineExpansionType =
  | "scene"
  | "group"
  | "layer"
  | "phase"
  | "scenePhase"
  | "sceneTracks";
