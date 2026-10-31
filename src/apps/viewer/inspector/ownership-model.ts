export type OwnershipSummary = {
  note: string;
  rows: [label: string, value: string][];
};
export type OwnershipOption = { label: string; title: string; value: string };
export type OwnershipSelectRow = {
  dataset?: Record<string, string>;
  label: string;
  onChange: (value: string) => void | Promise<void>;
  options: OwnershipOption[];
  value: string | null | undefined;
};
export type TrackOwnershipPatch = {
  phaseId?: string | null;
  sceneId?: string | null;
};
