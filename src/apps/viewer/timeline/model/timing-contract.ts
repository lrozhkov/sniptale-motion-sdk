import type { KeyframeIdTimeline } from "./keyframe-id.js";

export type TimelineEditableProperty = "label" | "start" | "duration";
export type TimelineEnabledToggleOptions = {
  enabled: boolean;
  id: string;
  title: string;
  type: "clip" | "layer" | "phase" | "scene" | "track";
};
export interface TimelineTimingActions {
  isTimelineItemEnabled(
    item: { enabled?: boolean } | null | undefined,
  ): boolean;
  toggleTimelineSceneEnabled(sceneId: string): void;
  toggleTimelineClipEnabled(layerId: string): void;
  toggleTimelinePhaseEnabled(phaseId: string): void;
  toggleTimelineTrackEnabled(trackId: string): void;
  toggleTimelineKeyframeEnabled(trackId: string, keyframeId: string): void;
  appendTimelineEnabledToggle(
    label: HTMLElement,
    options: TimelineEnabledToggleOptions,
  ): void;
  updatePhaseProperty(
    phaseId: string,
    property: TimelineEditableProperty,
    value: string | number,
  ): void;
  updateSceneProperty(
    sceneId: string,
    property: TimelineEditableProperty,
    value: string | number,
  ): void;
  createKeyframeId(
    timeline: KeyframeIdTimeline,
    trackId: string,
    label: string,
    time: number,
  ): string;
}
