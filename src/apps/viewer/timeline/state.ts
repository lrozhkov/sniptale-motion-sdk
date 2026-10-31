import type { EditorTemplate } from "../templates/model.js";
import type { EditorTimeline } from "../editor/model-types.js";
import type { TimelineRowTree } from "./model/row-tree-model.js";
import type { TimelineKeyframe } from "../../../sdk/types.js";
import type { TimelineOrderedRow } from "./virtualization/row-order-model.js";
import type { TimelineVirtualWindow } from "./virtualization/window.js";

export type KeyframeClipboardEntry = {
  keyframe: TimelineKeyframe<unknown>;
  trackId: string;
};

export type TimelineRenderSnapshot = {
  sourceTemplate: object;
  editorOverride: unknown;
  timelineOverride: unknown;
  duration: number;
  effectiveTemplate: EditorTemplate;
  templateId: string;
  timeline: EditorTimeline;
  tree: TimelineRowTree;
};

export type TimelineLayoutState = {
  timelineRenderSnapshot: TimelineRenderSnapshot | null;
  keyframeClipboard: KeyframeClipboardEntry[] | null;
  timelineAppliedOverlayHeight: number | null;
  timelineContentVisibleWidth: number | null;
  timelineLabelWidth: number | null;
  timelineTrackOverlayHeight: number | null;
  timelineVirtualRows: TimelineOrderedRow[];
  timelineVirtualWindow: TimelineVirtualWindow | null;
};

export function createTimelineLayoutState(): TimelineLayoutState {
  return {
    timelineRenderSnapshot: null,
    keyframeClipboard: null,
    timelineAppliedOverlayHeight: null,
    timelineContentVisibleWidth: null,
    timelineLabelWidth: null,
    timelineTrackOverlayHeight: null,
    timelineVirtualRows: [],
    timelineVirtualWindow: null,
  };
}
