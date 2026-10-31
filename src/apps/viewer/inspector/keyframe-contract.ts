import type { TimelineKeyframe } from "../../../sdk/types.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";
export type InspectorCurvePoint = { x: number; y: number };
export type InspectorCurveFieldOptions = {
  min?: number;
  max?: number;
  trackId?: string;
  keyframeId?: string;
  keyframeProperty?: string;
};
export type InspectorHandleProperty = keyof NonNullable<
  TimelineKeyframe<unknown>["handles"]
>;
export interface InspectorKeyframeActions {
  appendKeyframeSelectionInspector(template: EditorTimelineSource): boolean;
  appendKeyframeEditInspector(
    track: MotionPathTrack,
    keyframe: TimelineKeyframe<unknown>,
    totalDuration: number,
  ): void;
  appendKeyframeCurveInspector(
    track: MotionPathTrack,
    keyframe: TimelineKeyframe<unknown>,
    totalDuration: number,
  ): void;
  createCurveSvg(
    trackId: string,
    keyframeId: string,
    keyframe: TimelineKeyframe<unknown>,
  ): SVGSVGElement;
  createCurveHandle(
    trackId: string,
    keyframeId: string,
    handleName: "first" | "second",
    point: InspectorCurvePoint,
    start: InspectorCurvePoint,
    end: InspectorCurvePoint,
  ): SVGCircleElement;
  createCurveNumberField(
    label: string,
    value: number,
    onInput: (value: number) => void,
    options?: InspectorCurveFieldOptions,
  ): HTMLLabelElement;
  createEasingField(
    keyframe: TimelineKeyframe<unknown>,
    trackId?: string,
    keyframeId?: string,
  ): HTMLLabelElement;
  updateKeyframeEasing(
    easing: string,
    trackId?: string,
    keyframeId?: string,
  ): void;
  createCurveHandleNumberField(
    track: MotionPathTrack,
    keyframe: TimelineKeyframe<unknown>,
    label: string,
    property: InspectorHandleProperty,
    value: number,
  ): HTMLLabelElement;
  createKeyframeSegmentTools(
    track: MotionPathTrack,
    keyframe: TimelineKeyframe<unknown>,
    totalDuration: number,
  ): HTMLDivElement;
  createKeyframeSegmentField(
    label: string,
    trackId: string,
    fromKeyframeId: string,
    toKeyframeId: string,
    property: "start" | "end" | "duration",
    value: number,
    totalDuration: number,
  ): HTMLLabelElement;
  updateKeyframeSegmentTiming(
    trackId: string,
    fromKeyframeId: string,
    toKeyframeId: string,
    property: "start" | "end" | "duration",
    value: number,
  ): void;
  createKeyframeNavigationButton(
    direction: "prev" | "next",
    label: string,
    trackId: string,
    keyframe: TimelineKeyframe<unknown> | null | undefined,
  ): HTMLButtonElement;
}
