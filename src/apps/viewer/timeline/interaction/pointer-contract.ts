import type { KeyframeSelectionRef } from "../model/selection-model.js";
import type { TimelinePlaybackRange } from "../viewport.js";
import type { TimelineRangeEditMode } from "../model/move-plan-model.js";
export type TimelineRect = Pick<
  DOMRectReadOnly,
  "left" | "right" | "top" | "bottom"
>;
export interface TimelinePointerActions {
  beginClipDrag(
    event: PointerEvent,
    layerId: string,
    mode: TimelineRangeEditMode,
    measureElement?: HTMLElement | null,
  ): void;
  beginPhaseDrag(
    event: PointerEvent,
    phaseId: string,
    mode: TimelineRangeEditMode,
  ): void;
  beginSceneDrag(
    event: PointerEvent,
    sceneId: string,
    mode: TimelineRangeEditMode,
  ): void;
  beginTrackDrag(
    event: PointerEvent,
    trackId: string,
    measureElement?: HTMLElement | null,
    sceneId?: string | null,
    keyframeIds?: readonly string[] | null,
  ): void;
  beginKeyframeDrag(
    event: PointerEvent,
    trackId: string,
    keyframeId: string,
  ): void;
  beginKeyframeSegmentDrag(
    event: PointerEvent,
    trackId: string,
    fromKeyframeId: string,
    toKeyframeId: string,
    mode: TimelineRangeEditMode,
  ): void;
  rectsIntersect(a: TimelineRect, b: TimelineRect): boolean;
  rectContainsRectCenter(
    a: TimelineRect,
    b: Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">,
  ): boolean;
}

export type MarqueeSelectionKind =
  | "auto"
  | "clips"
  | "phases"
  | "scenes"
  | "keyframes";
export type MarqueeSelection = {
  clips: string[];
  phases: string[];
  scenes: string[];
  keyframes: KeyframeSelectionRef[];
};
export type MarqueeSelectionOptions = {
  additive?: boolean;
  previousSelection?: MarqueeSelection;
  selectionKind?: MarqueeSelectionKind;
};
export interface TimelineSelectionGestureActions {
  beginTimelineMarqueeSelection(
    event: PointerEvent,
    options?: { allowBlockStart?: boolean },
  ): void;
  updateMarqueeTimelineSelection(
    rect: TimelineRect,
    options?: MarqueeSelectionOptions,
  ): void;
  addKeyframeAtPlayheadForSelection(): void;
  beginRulerScrub(event: PointerEvent): void;
  getActivePlaybackRange(): TimelinePlaybackRange | null;
  setPlaybackRange(
    range: Partial<TimelinePlaybackRange> | null | undefined,
  ): void;
  clearPlaybackRange(): void;
  updateTimelinePlaybackRangeOverlay(): void;
}

export interface TimelineLayerGestureActions {
  appendTimelineLayerDragGrip(label: HTMLElement, layerId: string): void;
  beginTimelineLayerReparent(event: PointerEvent, layerId: string): boolean;
}
