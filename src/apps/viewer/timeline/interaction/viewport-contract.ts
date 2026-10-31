import type {
  TimelineContentMetrics,
  TimelineContentRect,
} from "../view/model.js";
import type { TimelineViewport } from "../viewport.js";

export interface TimelineViewportActions {
  getTimelineViewport(duration?: number): TimelineViewport;
  getVisibleTimelineTicks(duration: number): number[];
  handleTimelineWheel(event: WheelEvent): void;
  panTimeline(deltaSeconds: number): void;
  seekFromTimelineEvent(event: MouseEvent): void;
  seekToTime(time: number): void;
  setTimelineZoom(nextZoom: number, anchorTime?: number | null): void;
  snapTime(time: number): number;
  timelineContentPixel(
    time: number,
    duration: number,
    element: HTMLElement,
    contentRect?: TimelineContentMetrics | null,
  ): number;
  timelinePercent(time: number, duration: number): number;
  timelineTimeFromEvent(
    event: Pick<MouseEvent, "clientX">,
    element: HTMLElement,
  ): number;
  timelineRawTimeFromEvent(
    event: Pick<MouseEvent, "clientX">,
    element: HTMLElement,
  ): number;
  updateTimelineViewportLabel(duration?: number): void;
  getTimelineContentMetrics(element: HTMLElement): TimelineContentMetrics;
  getTimelineContentRect(element: HTMLElement): TimelineContentRect;
  getTimelineHorizontalOverflowWidth(duration?: number): number;
  getTimelineScrollableContentWidth(duration?: number): number;
  getTimelineTrackOverlayHeight(): number;
  getTimelineVisibleContentWidth(): number;
  handleTimelineTracksScroll(): void;
  observeTimelineContentMetrics(): void;
  showTimelineSnapIndicator(time: number): void;
  updateTimelineHorizontalScrollSpacer(
    duration: number,
    contentRect?: TimelineContentMetrics | null,
  ): void;
  updateTimelinePlayhead(): void;
  updateTimelineTrackOverlayHeights(): void;
}
