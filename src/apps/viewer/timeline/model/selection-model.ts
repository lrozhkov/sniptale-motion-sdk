export type KeyframeSelectionRef = {
  keyframeId: string;
  trackId: string;
};

export type ViewerSelection =
  | { type: "effect" }
  | { type: "layer" | "clip"; layerId: string }
  | { type: "phase"; phaseId: string }
  | { type: "scene"; sceneId: string }
  | { type: "track"; trackId: string }
  | (KeyframeSelectionRef & { type: "keyframe" })
  | { type: "asset"; assetId: string };

export type ViewerSelectionState = {
  selectedClips: string[];
  selectedItem: ViewerSelection;
  selectedKeyframes: KeyframeSelectionRef[];
  selectedLayers: string[];
  selectedPhases: string[];
  selectedScenes: string[];
};

export function createViewerSelectionState(): ViewerSelectionState {
  return {
    selectedClips: [],
    selectedItem: { type: "effect" },
    selectedKeyframes: [],
    selectedLayers: [],
    selectedPhases: [],
    selectedScenes: [],
  };
}

export type SelectionModifiers = Partial<
  Pick<MouseEvent, "ctrlKey" | "metaKey" | "shiftKey">
>;
export type KeyframeSelectionOptions = {
  preserveMotionPathContext?: boolean;
  render?: boolean;
};
export type SelectionCollectionKind =
  | "clip"
  | "layer"
  | "phase"
  | "scene"
  | "keyframe"
  | "track";
export type TimelineNavigationItem = Exclude<
  ViewerSelection,
  { type: "effect" | "asset" }
> & { sceneId?: string | null };
export type InspectorFocusTab =
  | "transform"
  | "timing"
  | "ownership"
  | "summary";
