import type { EditorTimeline } from "../editor/model-types.js";
import type { EditorTemplateSource } from "../templates/model.js";
import type { TimelineKeyframe } from "../../../sdk/types.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type {
  ResolvedKeyframeSelection,
  getKeyframeSelectionBounds,
} from "../timeline/model/keyframe-selection.js";
import type { GraphEditorViewport } from "./state.js";
import type { LayerNumericPropertyRange } from "../layers/property-range-model.js";

export type GraphCoordinates = { time: number; value: number };
export type GraphHandles = NonNullable<TimelineKeyframe<unknown>["handles"]>;
export type GraphPoint = GraphCoordinates & {
  id: string;
  selected: boolean;
  easing: string;
  handles: GraphHandles;
};
export type GraphTrack = {
  id: string;
  colorIndex: number;
  curvePoints: GraphCoordinates[] | null;
  label: string;
  points: GraphPoint[];
  source: MotionPathTrack;
  spatialMotionPath: boolean;
  valueRange: LayerNumericPropertyRange | null;
};
export type GraphEditorModel = {
  canEditEasing: boolean;
  linkedHandles: boolean;
  multiTrack: boolean;
  primary: ResolvedKeyframeSelection | null;
  selection: ResolvedKeyframeSelection[];
  selectionBounds: ReturnType<typeof getKeyframeSelectionBounds>;
  template: EditorTemplateSource;
  timeline: EditorTimeline;
  tracks: GraphTrack[];
  viewport: GraphEditorViewport;
};
export type GraphFitTrack = {
  id: string;
  points: readonly (GraphCoordinates & { id: string })[];
  curvePoints?: readonly GraphCoordinates[] | null;
};
export type GraphCurve = {
  points: readonly (GraphCoordinates & {
    easing?: string;
    handles?: GraphHandles;
  })[];
  curvePoints?: readonly GraphCoordinates[] | null;
};
