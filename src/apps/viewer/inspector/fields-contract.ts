import type {
  EffectClip,
  EffectScene,
  TimelineKeyframe,
  TimelinePhase,
} from "../../../sdk/types.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type { InspectorNumberField } from "./field-model.js";
export type InspectorTimingField =
  | { kind: "text"; label: string; property: "label" }
  | (InspectorNumberField<"start" | "duration"> & { kind: "number" });
export type InspectorRowValue = string | number | boolean | null | undefined;
export interface InspectorFieldActions {
  prepareInspectorSections(): void;
  setInspectorAppendSection(section: string): void;
  isInspectorSectionActive(section: string): boolean;
  getInspectorAppendTarget(): HTMLElement;
  appendInspectorNode(...nodes: (Node | string)[]): void;
  appendInspectorRows(
    title: string,
    rows: readonly (readonly [string, InspectorRowValue])[],
  ): void;
  appendInspectorKeyframeNumberField(
    track: MotionPathTrack,
    keyframe: TimelineKeyframe<unknown>,
    field: InspectorNumberField<"time" | "value">,
  ): void;
  appendInspectorKeyframeEasingField(
    track: MotionPathTrack,
    keyframe: TimelineKeyframe<unknown>,
  ): void;
  appendInspectorSceneField(
    scene: EffectScene,
    field: InspectorTimingField,
  ): void;
  appendInspectorPhaseField(
    phase: TimelinePhase,
    field: InspectorTimingField,
  ): void;
  appendInspectorClipField(
    clip: EffectClip,
    field: InspectorNumberField<"start" | "duration" | "offset">,
  ): void;
  appendPhaseTimingInspector(phase: TimelinePhase, totalDuration: number): void;
  appendSceneTimingInspector(scene: EffectScene, totalDuration: number): void;
  appendClipTimingInspector(clip: EffectClip, totalDuration: number): void;
}
