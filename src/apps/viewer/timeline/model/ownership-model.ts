export type OwnershipLinks = {
  clipLayerIds: Set<string>;
  keyframes: Set<string>;
  phaseIds: Set<string>;
  sceneIds: Set<string>;
  trackIds: Set<string>;
};

export type SelectedTimelineRange = {
  start: number;
  end: number;
  sceneId: string | null;
  selector: string | null;
};
