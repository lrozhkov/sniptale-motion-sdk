import type {
  EffectClip,
  EffectScene,
  TimelineKeyframe,
  TimelinePhase,
} from "../../../../sdk/types.js";
import type { MotionPathTrack } from "../../../../shared/timeline/motion-path.js";
import type { EditorTemplate } from "../../templates/model.js";
import type { EditorTimeline } from "../../editor/model-types.js";
import type {
  TimelineWindow,
  ClipMovePlan,
  PhaseMovePlan,
  SceneMovePlan,
  MovePlanOptions,
} from "./move-plan-model.js";
import type {
  OwnershipLinks,
  SelectedTimelineRange,
} from "./ownership-model.js";

export interface TimelineModelActions {
  isTimeInsideAnyScene(time: number, windows: TimelineWindow[]): boolean;
  clipBelongsToScene(
    clip: EffectClip | null | undefined,
    scene: EffectScene,
  ): boolean;
  isGlobalTimelineClip(
    clip: EffectClip | null | undefined,
    scenes: EffectScene[],
  ): boolean;
  getGlobalTimelineLayerIds(
    template: EditorTemplate | null | undefined,
    scenes?: EffectScene[],
  ): Set<string>;
  phaseBelongsToScene(
    phase: TimelinePhase | null | undefined,
    scene: EffectScene,
  ): boolean;
  keyframeBelongsToScene(
    track: MotionPathTrack,
    keyframe: TimelineKeyframe<unknown>,
    scene: EffectScene,
    timeline?: EditorTimeline,
  ): boolean;
  timeBelongsToScene(time: number, scene: EffectScene): boolean;
  keyframeLinkKey(trackId: string, keyframeId: string): string;
  keyframeBelongsToSelectedPhase(
    keyframe: TimelineKeyframe<unknown>,
    track: MotionPathTrack,
    selectedPhaseIds: ReadonlySet<string>,
  ): boolean;
  timingBelongsToSelectedScene(
    item: {
      sceneId?: string | null;
    },
    fallbackTime: number,
    windows: TimelineWindow[],
    selectedSceneIds: ReadonlySet<string>,
    parentSceneId?: string | null,
  ): boolean;
  inferTrackProperty(track: MotionPathTrack | null | undefined): string | null;
  getPhaseTrackLayerIds(
    timeline: EditorTimeline | null | undefined,
    phaseId: string,
  ): Set<string>;
  isPhaseCompatibleWithLayer(
    timeline: EditorTimeline,
    phaseId: string | null | undefined,
    layerId: string | null | undefined,
  ): boolean;
  createClipMovePlan(
    effectiveTemplate: EditorTemplate | null | undefined,
    layerIds: string[],
    totalDuration: number,
    includeLinkedKeys?: boolean,
  ): ClipMovePlan;
  keyframeCanMoveWithClip(
    timeline: EditorTimeline | null | undefined,
    track: MotionPathTrack,
    keyframe: TimelineKeyframe<unknown>,
    clipOrWindow:
      | {
          sceneId?: string | null;
        }
      | null
      | undefined,
  ): boolean;
  keyframePhaseCanMoveWithClip(
    _timeline: EditorTimeline | null | undefined,
    track: MotionPathTrack,
    keyframe: TimelineKeyframe<unknown>,
    movablePhaseIds: ReadonlySet<string>,
  ): boolean;
  getClipMovablePhaseIds(
    timeline: EditorTimeline,
    clips: EffectClip[],
    selectedLayerIds: ReadonlySet<string>,
  ): Set<string>;
  applyClipMovePlan(
    template:
      | {
          id: string;
        }
      | null
      | undefined,
    plan: ClipMovePlan | null | undefined,
    deltaTime: number,
    options?: MovePlanOptions,
  ): void;
  createPhaseMovePlan(
    effectiveTemplate: EditorTemplate | null | undefined,
    phaseIds: string[],
    totalDuration: number,
    includeLinkedKeys?: boolean,
  ): PhaseMovePlan;
  applyPhaseMovePlan(
    template:
      | {
          id: string;
        }
      | null
      | undefined,
    plan: PhaseMovePlan | null | undefined,
    deltaTime: number,
    options?: MovePlanOptions,
  ): void;
  createSceneMovePlan(
    effectiveTemplate: EditorTemplate,
    sceneIds: string[],
    totalDuration: number,
    includeLinkedKeys?: boolean,
  ): SceneMovePlan;
  applySceneMovePlan(
    template:
      | {
          id: string;
        }
      | null
      | undefined,
    plan: SceneMovePlan | null | undefined,
    deltaTime: number,
    options?: MovePlanOptions,
  ): void;
  collectKeyframeParentLinks(
    template: EditorTemplate,
    trackId: string,
    keyframeId: string,
    links: OwnershipLinks,
  ): void;
  getKeyframeOwnershipSceneId(
    timeline: EditorTimeline | null | undefined,
    track: MotionPathTrack | null | undefined,
    keyframe: TimelineKeyframe<unknown> | null | undefined,
  ): string | null;
  markOwnershipLink(element: HTMLElement, linked: boolean): void;
  createEmptyOwnershipLinks(): OwnershipLinks;
  buildSelectedOwnershipLinks(
    template: EditorTemplate | null | undefined,
  ): OwnershipLinks;
  collectSceneOwnershipLinks(
    template: EditorTemplate,
    sceneIds: string[],
    links: OwnershipLinks,
  ): void;
  collectClipOwnershipLinks(
    template: EditorTemplate,
    layerIds: string[],
    links: OwnershipLinks,
  ): void;
  collectPhaseOwnershipLinks(
    template: EditorTemplate,
    phaseIds: string[],
    links: OwnershipLinks,
  ): void;
  collectTrackOwnershipLinks(
    template: EditorTemplate,
    trackId: string,
    links: OwnershipLinks,
  ): void;
  assignKeyframeOwnershipAtTime(
    keyframe: TimelineKeyframe<unknown>,
    track: MotionPathTrack,
    time: number,
  ): void;
  frameTimelineRange(start: number, end: number, duration: number): void;
  isTimeInsideRange(time: number, start: number, end: number): boolean;
  isRangeInsideScene(
    start: number,
    duration: number,
    scene: EffectScene | null | undefined,
  ): boolean;
  isPhaseSceneBoundaryInvalid(
    template: EditorTemplate,
    phase: TimelinePhase | null | undefined,
  ): boolean;
  isKeyframeTimingInvalid(
    template: EditorTemplate,
    track: MotionPathTrack,
    keyframe: TimelineKeyframe<unknown>,
  ): boolean;
  isTimeInsideBoundaryRange(time: number, start: number, end: number): boolean;
  isRangeInvalid(
    start: number,
    duration: number,
    totalDuration: number,
  ): boolean;
  hasInvalidTiming(template: EditorTemplate): boolean;
  createSelectedKeyframeSegmentRange(
    track: MotionPathTrack,
    visibleKeyframes: TimelineKeyframe<unknown>[],
    duration: number,
  ): HTMLDivElement | null;
  getSelectedTimelineRange(
    template: EditorTemplate,
  ): SelectedTimelineRange | null;
}
