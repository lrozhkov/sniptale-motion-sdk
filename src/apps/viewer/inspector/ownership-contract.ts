import type { EditorTemplate } from "../templates/model.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type {
  EffectScene,
  EffectClip,
  TimelineKeyframe,
  TimelinePhase,
} from "../../../sdk/types.js";
import type {
  OwnershipSummary,
  OwnershipSelectRow,
  OwnershipOption,
  TrackOwnershipPatch,
} from "./ownership-model.js";

export interface InspectorOwnershipActions {
  getSceneOwnershipSummary(
    template: EditorTemplate,
    scene: EffectScene,
  ): OwnershipSummary;
  getClipOwnershipSummary(
    template: EditorTemplate,
    clip: EffectClip,
  ): OwnershipSummary;
  getPhaseOwnershipSummary(
    template: EditorTemplate,
    phase: TimelinePhase,
  ): OwnershipSummary;
  getTrackOwnershipSummary(
    template: EditorTemplate,
    track: MotionPathTrack,
  ): OwnershipSummary;
  getKeyframeOwnershipSummary(
    template: EditorTemplate,
    track: MotionPathTrack,
    keyframe: TimelineKeyframe<unknown>,
  ): OwnershipSummary;
  updateClipOwnership(layerId: string, sceneId: string | null): void;
  updatePhaseOwnership(phaseId: string, sceneId: string | null): void;
  updateTrackOwnership(trackId: string, patch: TrackOwnershipPatch): void;
  appendTimingOwnershipInspector(
    summary: OwnershipSummary | null | undefined,
  ): void;
  appendClipOwnershipEditor(clip: EffectClip, template: EditorTemplate): void;
  appendPhaseOwnershipEditor(
    phase: TimelinePhase,
    template: EditorTemplate,
  ): void;
  appendTrackOwnershipEditor(
    track: MotionPathTrack,
    template: EditorTemplate,
  ): void;
  appendTrackKeyframeActions(track: MotionPathTrack): void;
  appendKeyframeOwnershipEditor(
    track: MotionPathTrack,
    keyframe: TimelineKeyframe<unknown>,
    template: EditorTemplate,
  ): void;
  appendOwnershipHeading(): void;
  createSceneOptions(
    template: EditorTemplate,
    emptyLabel: string,
  ): OwnershipOption[];
  createPhaseOptions(
    template: EditorTemplate,
    emptyLabel: string,
  ): OwnershipOption[];
  appendInspectorSelectRow(options: OwnershipSelectRow): void;
}
