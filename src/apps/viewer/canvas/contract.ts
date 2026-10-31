import type { EditorTemplate } from "../templates/model.js";
import type { MotionPathPointRef } from "./motion-path-reference.js";
import type {
  MotionPathPointKind,
  MotionPathTangent,
} from "../../../shared/timeline/motion-path.js";
import type { CanvasMotionPathEditBlockReason } from "./motion-path-model.js";
import type { EffectLayer, TimelineKeyframe } from "../../../sdk/types.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type { EditorTimeline } from "../editor/model-types.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";
import type { SelectionModifiers } from "../timeline/model/selection-model.js";
import type {
  CanvasMotionPathModel,
  CanvasMotionPathPoint,
  CanvasMotionPathSelection,
  CanvasMotionPathTimeline,
} from "./motion-path-model.js";

export type CanvasPropertyUpdates = Readonly<Record<string, unknown>>;
export type CanvasUpdateOptions = {
  inspector?: boolean;
  keyframe?: boolean;
  motionPath?: boolean;
  render?: boolean;
  selection?: boolean;
  timeline?: boolean;
};
export type CanvasPropertyResolution = {
  time?: number | null;
  timeline?: EditorTimeline | null;
};
export interface CanvasPropertyActions {
  updatePathPoint(
    layerId: string,
    pointIndex: number,
    point: { x: number; y: number },
    options?: CanvasUpdateOptions,
  ): void;
  updateLayerPosition(
    layerId: string,
    x: number,
    y: number,
    options?: CanvasUpdateOptions,
  ): void;
  updateLayerPositionAtTime(
    layerId: string,
    time: number,
    x: number,
    y: number,
    options?: CanvasUpdateOptions,
  ): void;
  updateLayerPropertiesAtTime(
    layerId: string,
    time: number,
    properties: CanvasPropertyUpdates,
    options?: CanvasUpdateOptions,
  ): void;
  updateLayerPropertyBatchAtTime(
    time: number,
    updates: Readonly<Record<string, CanvasPropertyUpdates>>,
    options?: CanvasUpdateOptions,
  ): void;
  updateLayerDefinitionProperty(
    layerId: string,
    property: string,
    value: unknown,
  ): void;
  updateLayerClipProperty(
    layerId: string,
    property: "start" | "duration" | "offset",
    value: number | string,
  ): void;
  updateLayerProperty(
    layerId: string,
    property: string,
    value: unknown,
    options?: CanvasUpdateOptions,
  ): void;
  updateLayerPropertyAtTime(
    layerId: string,
    property: string,
    time: number,
    value: unknown,
    options?: CanvasUpdateOptions,
  ): void;
  nudgeSelectedLayer(dx: number, dy: number): unknown;
  upsertTrackKeyframe(
    timeline: EditorTimeline,
    layerId: string,
    property: string,
    value: unknown,
    atTime?: number,
  ): TimelineKeyframe<unknown>;
  getResolvedLayerProperty(
    layer: EffectLayer,
    property: string,
    resolution?: CanvasPropertyResolution,
  ): number;
  getDefaultLayerProperty(
    layer: Record<string, unknown>,
    property: string,
  ): number;
  resolveNumericTrack(
    track: MotionPathTrack | null | undefined,
    time: number,
    fallback: number,
    timeline?: CanvasMotionPathTimeline | null,
  ): number;
}
export interface CanvasMotionPathSelectionActions {
  getCanvasMotionPathModel(
    template: EditorTimelineSource | null | undefined,
    layerId: string,
  ): CanvasMotionPathModel;
  selectCanvasMotionPathPoint(
    layerId: string,
    xKeyframeId: string,
    yKeyframeId: string,
    event?: SelectionModifiers | null,
    options?: { preserveSelection?: boolean; sync?: boolean },
  ): CanvasMotionPathPoint | null;
  isCanvasMotionPathSelectionForLayer(
    template: EditorTimelineSource | null | undefined,
    layerId: string,
  ): boolean;
  getSelectedCanvasMotionPathPoints(
    template?: EditorTimelineSource | null,
  ): CanvasMotionPathSelection[];
  getFullySelectedCanvasMotionPathPoints(
    template?: EditorTimelineSource | null,
  ): CanvasMotionPathSelection[];
}

export type CanvasMotionPathUpdateOptions = Pick<
  CanvasUpdateOptions,
  "inspector" | "render" | "selection" | "timeline"
>;
export type CanvasMotionPathPositionUpdate = MotionPathPointRef & {
  position: { x: number; y: number };
};
export interface CanvasMotionPathUpdateActions {
  updateCanvasMotionPathPointPosition(
    layerId: string,
    xKeyframeId: string,
    yKeyframeId: string,
    position: { x: number; y: number },
    options?: CanvasMotionPathUpdateOptions,
  ): boolean;
  updateCanvasMotionPathPointPositions(
    updates: readonly CanvasMotionPathPositionUpdate[],
    options?: CanvasMotionPathUpdateOptions,
  ): boolean;
  updateCanvasMotionPathTangent(
    layerId: string,
    xKeyframeId: string,
    yKeyframeId: string,
    side: "in" | "out",
    tangent: MotionPathTangent,
    options?: CanvasMotionPathUpdateOptions,
  ): boolean;
  updateCanvasMotionPathPointKind(
    layerId: string,
    xKeyframeId: string,
    yKeyframeId: string,
    kind: MotionPathPointKind,
  ): boolean;
  updateCanvasMotionPathPointKinds(
    selections: readonly MotionPathPointRef[],
    kind: MotionPathPointKind,
  ): boolean;
  canEditCanvasMotionPathPoint(
    layer: EffectLayer,
    point: CanvasMotionPathPoint,
    template?: EditorTemplate | null,
  ): boolean;
  getCanvasMotionPathPointEditBlockReason(
    layer: EffectLayer,
    point: CanvasMotionPathPoint,
    template?: EditorTemplate | null,
  ): CanvasMotionPathEditBlockReason | null;
  reportCanvasMotionPathEditFailure(
    layer: EffectLayer,
    point: CanvasMotionPathPoint,
    template?: EditorTemplate | null,
    reason?: CanvasMotionPathEditBlockReason | null,
  ): void;
}
