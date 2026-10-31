import type { TimelineOrderedRow } from "./virtualization/row-order.js";
import type { TimelineVirtualWindow } from "./virtualization/window.js";

export type TimelineLayoutState = {
  timelineAppliedOverlayHeight: number | null;
  timelineContentVisibleWidth: number | null;
  timelineLabelWidth: number | null;
  timelineTrackOverlayHeight: number | null;
  timelineVirtualRows: TimelineOrderedRow[];
  timelineVirtualWindow: TimelineVirtualWindow | null;
};

export function createTimelineLayoutState(): TimelineLayoutState {
  return {
    timelineAppliedOverlayHeight: null,
    timelineContentVisibleWidth: null,
    timelineLabelWidth: null,
    timelineTrackOverlayHeight: null,
    timelineVirtualRows: [],
    timelineVirtualWindow: null,
  };
}
