import type { EditorTemplate } from "../../templates/model.js";
import type { EditorTimelineSource } from "../../editor/timeline-source.js";
import type { EditorTimeline } from "../../editor/model-types.js";
import type { MotionPathTrack } from "../../../../shared/timeline/motion-path.js";

import type { TimelineScene } from "../model/row-tree-model.js";

import type {
  TimelineViewSource,
  TimelineLane,
  TimelineBlockOptions,
  TimelineSceneSummary,
  TimelineContentMetrics,
} from "./model.js";

export interface TimelineSurfaceActions {
  renderTimelineRuler(
    template: TimelineViewSource,
    timeline: EditorTimeline,
  ): void;
  decorateSceneLaneLabel(
    lane: TimelineLane,
    scene: TimelineScene,
    expanded: boolean,
    summary: TimelineSceneSummary | null | undefined,
  ): void;
  getSceneTimelineSummary(
    template: EditorTemplate,
    timeline: EditorTimeline,
    scene: TimelineScene,
  ): TimelineSceneSummary;
  toggleSceneExpansion(sceneId: string): void;
  isSceneExpanded(sceneId: string): boolean;
  createTimelineLane(labelText: string, kindText?: string): TimelineLane;
  decorateTimelineRowDepth(
    row: HTMLElement,
    depth?: number,
    rowIndex?: number | null,
  ): void;
  createTimelineBlock(options: TimelineBlockOptions): HTMLButtonElement;
  renderTimelineTracks(
    template: TimelineViewSource,
    timeline: EditorTimeline,
    options?: { reuseModel?: boolean },
  ): void;
  renderTimelineGridLines(
    template: TimelineViewSource,
    timeline: EditorTimeline,
    contentRect?: TimelineContentMetrics | null,
  ): void;
  renderTimelineModel(template?: EditorTimelineSource | null): void;
  renderTimelineStructure(template?: EditorTimelineSource | null): void;
  renderTimelineViewport(template?: EditorTimelineSource | null): void;
  getTimelineTrackDisplayLabel(
    track: MotionPathTrack | null | undefined,
  ): string;
}
