import { bindViewerAction } from "../app/bind-action.js";
import type { EditorTemplate } from "../templates/model.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type {
  EffectScene,
  EffectClip,
  TimelineKeyframe,
  TimelinePhase,
} from "../../../sdk/types.js";
import type { OwnershipSummary } from "./ownership-model.js";
import type { ViewerAppContext } from "../app/context.js";

function getSceneOwnershipSummary(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  scene: EffectScene,
): OwnershipSummary {
  const plan = ctx.createSceneMovePlan(template, [scene.id], template.duration);
  const t = (key: string, fallback: string) => ctx.deps.t(key, fallback);
  return {
    note: t(
      "viewer.inspector.ownershipDetails.sceneNote",
      "Dragging the body moves linked clips, phases, and keyframes. Edge handles only change scene boundaries.",
    ),
    rows: [
      [
        t("viewer.inspector.ownershipDetails.bodyMoves", "Body moves"),
        t(
          "viewer.inspector.ownershipDetails.sceneMoveCount",
          "{clips} clips · {phases} phases · {keys} keys",
        )
          .replace("{clips}", String(plan.clipItems.length))
          .replace("{phases}", String(plan.phaseItems.length))
          .replace("{keys}", String(plan.keyframeItems.length)),
      ],
      [
        t("viewer.inspector.ownershipDetails.selectionKey", "Selection key"),
        `sceneId:${scene.id}`,
      ],
      [
        t("viewer.inspector.ownershipDetails.separate", "Separate"),
        t("viewer.inspector.ownershipDetails.sceneTrim", "Scene edge handles"),
      ],
    ],
  };
}

function getClipOwnershipSummary(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  clip: EffectClip,
): OwnershipSummary {
  const plan = ctx.createClipMovePlan(
    template,
    [clip.layerId],
    template.duration,
  );
  const t = (key: string, fallback: string) => ctx.deps.t(key, fallback);
  return {
    note: t(
      "viewer.inspector.ownershipDetails.clipNote",
      "Dragging the body moves the clip, compatible layer keyframes, and their phases. Edge handles only change in/out.",
    ),
    rows: [
      [
        t("viewer.inspector.ownershipDetails.bodyMoves", "Body moves"),
        t(
          "viewer.inspector.ownershipDetails.clipMoveCount",
          "{keys} layer keys · {phases} phases",
        )
          .replace("{keys}", String(plan.keyframeItems.length))
          .replace("{phases}", String(plan.phaseItems.length)),
      ],
      [
        t("viewer.inspector.ownershipDetails.layerKey", "Layer key"),
        clip.layerId,
      ],
      [
        t("viewer.inspector.ownershipDetails.separate", "Separate"),
        t(
          "viewer.inspector.ownershipDetails.clipTrim",
          "Clip start/end handles",
        ),
      ],
    ],
  };
}

function getPhaseOwnershipSummary(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  phase: TimelinePhase,
): OwnershipSummary {
  const plan = ctx.createPhaseMovePlan(template, [phase.id], template.duration);
  const t = (key: string, fallback: string) => ctx.deps.t(key, fallback);
  return {
    note: t(
      "viewer.inspector.ownershipDetails.phaseNote",
      "Dragging the body moves the phase and its keyframes. Edge handles only resize the phase.",
    ),
    rows: [
      [
        t("viewer.inspector.ownershipDetails.bodyMoves", "Body moves"),
        t(
          "viewer.inspector.ownershipDetails.phaseMoveCount",
          "{keys} phase keys",
        ).replace("{keys}", String(plan.keyframeItems.length)),
      ],
      [
        t("viewer.inspector.ownershipDetails.selectionKey", "Selection key"),
        `phaseId:${phase.id}`,
      ],
      [
        t("viewer.inspector.ownershipDetails.separate", "Separate"),
        t(
          "viewer.inspector.ownershipDetails.phaseTrim",
          "Phase start/end handles",
        ),
      ],
    ],
  };
}

function getTrackOwnershipSummary(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  track: MotionPathTrack,
): OwnershipSummary {
  const layerId = ctx.getTrackLayerId(track);
  const clip = layerId
    ? (template.clips ?? []).find((item) => item.layerId === layerId)
    : null;
  const keyCount = track.keyframes?.length ?? 0;
  const t = (key: string, fallback: string) => ctx.deps.t(key, fallback);
  return {
    note: t(
      "viewer.inspector.ownershipDetails.trackNote",
      "Dragging a track moves every keyframe on this property. Individual keys can override phase or scene links.",
    ),
    rows: [
      [
        t("viewer.inspector.ownershipDetails.trackMoves", "Track moves"),
        t("viewer.inspector.ownershipDetails.keyCount", "{keys} keys").replace(
          "{keys}",
          String(keyCount),
        ),
      ],
      [
        t("viewer.inspector.ownershipDetails.layerClip", "Layer clip"),
        clip?.layerId ?? t("viewer.inspector.values.none", "None"),
      ],
      [
        t("viewer.inspector.ownershipDetails.defaultPhase", "Default phase"),
        track.phaseId ?? t("viewer.inspector.values.none", "None"),
      ],
      [
        t("viewer.inspector.ownershipDetails.defaultScene", "Default scene"),
        track.sceneId ??
          t("viewer.inspector.ownershipDetails.timeWindow", "Time window"),
      ],
    ],
  };
}

function getKeyframeOwnershipSummary(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  track: MotionPathTrack,
  keyframe: TimelineKeyframe<unknown>,
): OwnershipSummary {
  const layerId = ctx.getTrackLayerId(track);
  const clip = layerId
    ? (template.clips ?? []).find((item) => item.layerId === layerId)
    : null;
  const inferredSceneId = ctx
    .normalizeScenes(template.scenes ?? [], template.duration)
    .find((scene) =>
      ctx.isTimeInsideRange(
        Number(keyframe.time) || 0,
        scene.start,
        scene.start + scene.duration,
      ),
    )?.id;
  const t = (key: string, fallback: string) => ctx.deps.t(key, fallback);
  return {
    note: t(
      "viewer.inspector.ownershipDetails.keyframeNote",
      "Dragging a keyframe moves this key or the current multi-selection. Parent blocks show what can move it as a group.",
    ),
    rows: [
      [
        t("viewer.inspector.ownershipDetails.layerClip", "Layer clip"),
        clip?.layerId ?? t("viewer.inspector.values.none", "None"),
      ],
      [
        t("viewer.inspector.fields.phase", "Phase"),
        keyframe.phaseId ??
          track.phaseId ??
          t("viewer.inspector.values.none", "None"),
      ],
      [
        t("viewer.inspector.fields.scene", "Scene"),
        keyframe.sceneId ??
          track.sceneId ??
          inferredSceneId ??
          t("viewer.inspector.values.none", "None"),
      ],
    ],
  };
}

export function createOwnershipSummaryActions(
  getContext: () => ViewerAppContext,
) {
  return {
    getSceneOwnershipSummary: bindViewerAction(
      getSceneOwnershipSummary,
      getContext,
    ),
    getClipOwnershipSummary: bindViewerAction(
      getClipOwnershipSummary,
      getContext,
    ),
    getPhaseOwnershipSummary: bindViewerAction(
      getPhaseOwnershipSummary,
      getContext,
    ),
    getTrackOwnershipSummary: bindViewerAction(
      getTrackOwnershipSummary,
      getContext,
    ),
    getKeyframeOwnershipSummary: bindViewerAction(
      getKeyframeOwnershipSummary,
      getContext,
    ),
  };
}
