import type { TimelineKeyframe } from "../../../sdk/types.js";
import type { TimelineOrderedRow } from "./virtualization/row-order.js";
import type { TimelineVirtualWindow } from "./virtualization/window.js";

export type KeyframeClipboardEntry = {
  keyframe: TimelineKeyframe<unknown>;
  trackId: string;
};

export type TimelineLayoutState = {
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
    keyframeClipboard: null,
    timelineAppliedOverlayHeight: null,
    timelineContentVisibleWidth: null,
    timelineLabelWidth: null,
    timelineTrackOverlayHeight: null,
    timelineVirtualRows: [],
    timelineVirtualWindow: null,
  };
}
