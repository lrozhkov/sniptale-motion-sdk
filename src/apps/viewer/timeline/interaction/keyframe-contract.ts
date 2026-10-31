import type { EditorTimeline } from "../../editor/model-types.js";
import type { TimelineKeyframe } from "../../../../sdk/types.js";
import type { MotionPathTrack } from "../../../../shared/timeline/motion-path.js";

export type KeyframePatch = {
  time?: number;
  value?: unknown;
  easing?: string;
  phaseId?: string | null;
  sceneId?: string | null;
  handles?: Partial<NonNullable<TimelineKeyframe<unknown>["handles"]>>;
};
export type KeyframeMoveOptions = { coalesceKey?: string; type?: string };

export interface KeyframeEditActions {
  findSelectedKeyframe(timeline: EditorTimeline): {
    track: MotionPathTrack;
    keyframe: TimelineKeyframe<unknown>;
  } | null;
  updateSelectedKeyframe(
    patch: KeyframePatch,
    trackId?: string,
    keyframeId?: string,
    options?: { history?: boolean; render?: boolean; timeline?: boolean },
  ): Promise<void> | undefined;
  addKeyframeAtPlayhead(trackId: string): void;
  resolveTrackValueForNewKeyframe(
    track: MotionPathTrack,
    time: number,
    timeline?: EditorTimeline,
  ): unknown;
  moveSelectedKeyframesBySeconds(
    delta: number,
    options?: KeyframeMoveOptions,
  ): boolean;
  scaleSelectedKeyframeTimes(
    factor: number,
    pivot?: "center" | "end" | "start",
  ): boolean;
  setKeyframeSelectionRangeProperty(
    property: "duration" | "end" | "start",
    value: string | number,
  ): boolean;
  alignSelectedKeyframes(target: "end" | "playhead" | "start"): boolean;
  distributeSelectedKeyframes(): boolean;
  quantizeSelectedKeyframes(): boolean;
  copySelectedKeyframes(): boolean;
  pasteKeyframesAtPlayhead(): boolean;
  duplicateSelectedKeyframes(): boolean;
  deleteSelectedKeyframes(): boolean;
  updateSelectedKeyframesBatch(
    patch: Pick<KeyframePatch, "value" | "easing" | "handles">,
  ): boolean;
  nudgeSelectedKeyframesByFrames(
    direction: number,
    frames: number,
  ): boolean | undefined;
}
