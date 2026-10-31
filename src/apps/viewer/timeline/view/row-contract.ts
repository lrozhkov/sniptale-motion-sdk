import type { EditorTemplate } from "../../templates/model.js";

import type { EditorTimeline } from "../../editor/model-types.js";
import type { MotionPathTrack } from "../../../../shared/timeline/motion-path.js";
import type { EffectClip, TimelineKeyframe } from "../../../../sdk/types.js";
import type {
  TimelineScene,
  TimelineSceneRow,
  TimelineLayerRow,
  TimelineLayerLeafRow,
  TimelineLayerGroupRow,
  TimelinePhaseRow,
  TimelineTrackRow,
} from "../model/row-tree-model.js";
import type { OwnershipLinks } from "../model/ownership-model.js";
import type {
  TimelineViewSource,
  TimelineLane,
  TimelineGroupLabelOptions,
  TimelineRenderParent,
  TimelineClipRow,
  TimelineClipInterval,
} from "./model.js";

export interface TimelineRowViewActions {
  getSceneClampedClipInterval(
    clip: EffectClip,
    scene: TimelineScene,
  ): TimelineClipInterval;
  createLayerIntervalBlock(
    _template: TimelineViewSource,
    scene: TimelineScene,
    clipRow: TimelineClipRow,
    ownershipLinks: OwnershipLinks,
    duration: number,
    inheritedDisabled?: boolean,
  ): HTMLButtonElement;
  renderSceneTracksGroup(
    template: TimelineViewSource,
    effectiveTemplate: EditorTemplate,
    timeline: EditorTimeline,
    sceneGroup: HTMLElement,
    scene: TimelineScene,
    tracks: TimelineTrackRow[],
    ownershipLinks: OwnershipLinks,
    duration: number,
  ): void;
  renderPhaseGroup(
    template: TimelineViewSource,
    effectiveTemplate: EditorTemplate,
    timeline: EditorTimeline,
    sceneGroup: HTMLElement,
    scene: TimelineScene,
    phaseRow: TimelinePhaseRow,
    ownershipLinks: OwnershipLinks,
    duration: number,
    inheritedDisabled?: boolean,
  ): void;
  decorateTimelineGroupLabel(
    lane: TimelineLane,
    options: TimelineGroupLabelOptions,
  ): void;
  renderPropertyTrackRows(
    template: TimelineViewSource,
    effectiveTemplate: EditorTemplate,
    timeline: EditorTimeline,
    sceneGroup: HTMLElement,
    scene: TimelineScene,
    trackRows: TimelineTrackRow[],
    ownershipLinks: OwnershipLinks,
    duration: number,
    inheritedDisabled?: boolean,
  ): void;
  renderTimelinePropertyTrackLane(
    template: TimelineViewSource,
    effectiveTemplate: EditorTemplate,
    timeline: EditorTimeline,
    scene: TimelineScene,
    track: MotionPathTrack,
    visibleKeyframes: TimelineKeyframe<unknown>[],
    ownershipLinks: OwnershipLinks,
    duration: number,
    parent: TimelineRenderParent,
  ): void;
  createTimelineKeyframePoint(
    _template: TimelineViewSource,
    effectiveTemplate: EditorTemplate,
    _timeline: EditorTimeline,
    track: MotionPathTrack,
    keyframe: TimelineKeyframe<unknown>,
    ownershipLinks: OwnershipLinks,
    duration: number,
  ): HTMLButtonElement;
  renderSceneTimelineGroup(
    template: TimelineViewSource,
    effectiveTemplate: EditorTemplate,
    timeline: EditorTimeline,
    sceneRow: TimelineSceneRow,
    ownershipLinks: OwnershipLinks,
    duration: number,
  ): void;
  renderTimelineLayerTree(
    template: TimelineViewSource,
    effectiveTemplate: EditorTemplate,
    timeline: EditorTimeline,
    sceneGroup: HTMLElement,
    scene: TimelineScene,
    layerRows: TimelineLayerRow[],
    ownershipLinks: OwnershipLinks,
    duration: number,
  ): void;
  renderLayerGroup(
    template: TimelineViewSource,
    effectiveTemplate: EditorTemplate,
    timeline: EditorTimeline,
    sceneGroup: HTMLElement,
    scene: TimelineScene,
    layerRow: TimelineLayerLeafRow,
    ownershipLinks: OwnershipLinks,
    duration: number,
  ): void;
  renderStructuralLayerGroup(
    template: TimelineViewSource,
    effectiveTemplate: EditorTemplate,
    timeline: EditorTimeline,
    sceneGroup: HTMLElement,
    scene: TimelineScene,
    groupRow: TimelineLayerGroupRow,
    ownershipLinks: OwnershipLinks,
    duration: number,
  ): void;
  renderGlobalTimelineGroup(
    template: TimelineViewSource,
    effectiveTemplate: EditorTemplate,
    timeline: EditorTimeline,
    globalScene: TimelineScene | null,
    layerRows: TimelineLayerRow[],
    ownershipLinks: OwnershipLinks,
    duration: number,
  ): void;
}
