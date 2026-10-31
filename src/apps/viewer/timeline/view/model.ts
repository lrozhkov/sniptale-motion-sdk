import type { EffectClip, EffectLayer } from "../../../../sdk/types.js";
import type { TimelineTrackParent } from "../model/row-tree-model.js";
export type TimelineViewSource = { id: string; duration?: number };
export type TimelineLane = {
  row: HTMLDivElement;
  label: HTMLDivElement;
  body: HTMLDivElement;
};
export type TimelineBlockOptions = {
  className: string;
  id: string;
  invalid: boolean;
  label: string;
  left: number;
  locked: boolean;
  width: number;
};
export type TimelineGroupLabelOptions = {
  count: number;
  countText?: string;
  expanded: boolean;
  id: string;
  label: string;
  metadata?: string;
  scope?: string | null;
  type: string;
};
export type TimelineRenderParent = {
  group: HTMLElement;
  id: string;
  layerId: string;
  phaseId: string | null;
  type: TimelineTrackParent["type"];
  depth?: number;
  inheritedDisabled: boolean;
};
export type TimelineClipRow = { clip: EffectClip; layer: EffectLayer | null };
export type TimelineClipInterval = {
  rawStart: number;
  rawEnd: number;
  effectiveStart: number;
  effectiveEnd: number;
  invalid: boolean;
};
export type TimelineSceneSummary = { compact: string; full: string };
export type TimelineContentMetrics = {
  offsetLeft: number;
  width: number;
  visibleWidth?: number;
};
export type TimelineSurfaceOptions = {
  curve?: boolean;
  reuseModel?: boolean;
  ruler?: boolean;
  selectionCrumb?: boolean;
  tracks?: boolean;
};
