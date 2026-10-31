import type { TimelineExpansionType } from "../model/row-tree-model.js";

export type TimelineRowScope =
  | { globalScope: true; sceneId?: never }
  | { globalScope: false; sceneId: string };
export type TimelineOrderedRow = TimelineRowScope &
  (
    | { kind: "layer"; layerId: string }
    | { kind: "phase"; phaseId: string }
    | { kind: "track"; trackId: string }
    | { kind: "scene" | "sceneTracks"; globalScope: false; sceneId: string }
  );
export type TimelineOrderingTrack = { track: { id: string } };
export type TimelineOrderingPhase = {
  expansionId: string;
  phase: { id: string };
  tracks: readonly TimelineOrderingTrack[];
};
export type TimelineOrderingLayer = { expansionId: string; layerId: string } & (
  | { kind: "group"; children: readonly TimelineOrderingLayer[] }
  | {
      kind: "layer";
      phases: readonly TimelineOrderingPhase[];
      directTracks: readonly TimelineOrderingTrack[];
    }
);
export type TimelineOrderingTree = {
  globalLayers?: readonly TimelineOrderingLayer[];
  scenes: readonly {
    scene: { id: string };
    layers: readonly TimelineOrderingLayer[];
    scenePhases: readonly TimelineOrderingPhase[];
    sceneTracks: readonly TimelineOrderingTrack[];
  }[];
};
export type TimelineExpansionReader = {
  isRowExpanded: (type: TimelineExpansionType, id: string) => boolean;
  isSceneExpanded: (sceneId: string) => boolean;
};
export type TimelineLayerRowTarget = {
  globalScope?: boolean;
  layerId: string;
  sceneId?: string | null;
};
export type TimelineItemRowTarget = {
  keyframeId?: string;
  layerId?: string;
  phaseId?: string;
  sceneId?: string | null;
  trackId?: string;
  type?: string;
};
