import type { EditorTimeline } from "../editor/model-types.js";
import type { GraphEditorModel } from "./model-types.js";
import type { GraphEditorViewport } from "./state.js";

export type GraphZoomOptions = {
  timeAnchor?: number;
  valueAnchor?: number;
  zoomTime?: boolean;
  zoomValue?: boolean;
};
export interface GraphRuntimeActions {
  toggleGraphEditor(enabled?: boolean): void;
  fitGraphEditor(mode?: "all" | "selection"): boolean;
  zoomGraphEditor(factor: number, options?: GraphZoomOptions): boolean;
  setGraphEditorViewport(
    viewport: GraphEditorViewport,
    options?: { render?: boolean },
  ): void;
  setGraphEditorLinkedHandles(linked: boolean): void;
  renderCurveEditor(timeline: EditorTimeline): void;
  updateGraphEditorPlayhead(time: number): void;
  handleGraphEditorWheel(event: WheelEvent, model: GraphEditorModel): void;
  beginGraphEditorPan(event: PointerEvent, model: GraphEditorModel): void;
  beginGraphKeyframeDrag(
    event: PointerEvent,
    model: GraphEditorModel,
    trackId: string,
    keyframeId: string,
  ): void;
  beginGraphBezierHandleDrag(
    event: PointerEvent,
    model: GraphEditorModel,
    trackId: string,
    keyframeId: string,
    handle: "first" | "second",
  ): void;
  beginGraphSelectionScale(
    event: PointerEvent,
    model: GraphEditorModel,
    edge: "start" | "end",
  ): void;
}
export interface GraphEditorActions extends Omit<
  GraphRuntimeActions,
  "toggleGraphEditor" | "fitGraphEditor" | "zoomGraphEditor"
> {
  toggleGraphEditor(enabled?: boolean): Promise<void>;
  fitGraphEditor(mode?: "all" | "selection"): Promise<boolean>;
  zoomGraphEditor(factor: number, options?: GraphZoomOptions): Promise<boolean>;
}
