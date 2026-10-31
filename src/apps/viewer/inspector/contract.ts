import type { EditorTimelineSource } from "../editor/timeline-source.js";

export interface InspectorMotionPathActions {
  appendMotionPathPointInspector(
    template: EditorTimelineSource | null | undefined,
  ): boolean;
}
