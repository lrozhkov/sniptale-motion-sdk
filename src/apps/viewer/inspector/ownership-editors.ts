import { createOwnershipOptions } from "./ownership-options.js";
import { bindViewerAction } from "../app/bind-action.js";
import type { EditorTemplate } from "../templates/model.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type {
  EffectClip,
  TimelineKeyframe,
  TimelinePhase,
} from "../../../sdk/types.js";
import type { OwnershipSummary, OwnershipOption } from "./ownership-model.js";
import type { ViewerAppContext } from "../app/context.js";

function appendTimingOwnershipInspector(
  ctx: ViewerAppContext,
  summary: OwnershipSummary | null | undefined,
): void {
  if (!summary) {
    return;
  }
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = ctx.deps.t(
    "viewer.inspector.timingOwnership",
    "Timing ownership",
  );
  ctx.appendInspectorNode(heading);
  const box = document.createElement("div");
  box.className = "ownership-summary";
  for (const [label, value] of summary.rows) {
    const row = document.createElement("div");
    row.className = "ownership-summary-row";
    const name = document.createElement("span");
    name.textContent = label;
    const output = document.createElement("strong");
    output.textContent = value;
    row.append(name, output);
    box.append(row);
  }
  const note = document.createElement("p");
  note.textContent = summary.note;
  box.append(note);
  ctx.appendInspectorNode(box);
}

function appendClipOwnershipEditor(
  ctx: ViewerAppContext,
  clip: EffectClip,
  template: EditorTemplate,
): void {
  ctx.appendOwnershipHeading();
  ctx.appendInspectorSelectRow({
    dataset: { layerId: clip.layerId, ownershipProperty: "sceneId" },
    label: ctx.deps.t("viewer.inspector.fields.scene", "Scene"),
    onChange: (value) => ctx.updateClipOwnership(clip.layerId, value || null),
    options: ctx.createSceneOptions(
      template,
      ctx.deps.t("viewer.inspector.values.autoTime", "Auto / time window"),
    ),
    value: clip.sceneId ?? "",
  });
}

function appendPhaseOwnershipEditor(
  ctx: ViewerAppContext,
  phase: TimelinePhase,
  template: EditorTemplate,
): void {
  ctx.appendOwnershipHeading();
  ctx.appendInspectorSelectRow({
    dataset: { phaseId: phase.id, ownershipProperty: "sceneId" },
    label: ctx.deps.t("viewer.inspector.fields.scene", "Scene"),
    onChange: (value) => ctx.updatePhaseOwnership(phase.id, value || null),
    options: ctx.createSceneOptions(
      template,
      ctx.deps.t("viewer.inspector.values.autoTime", "Auto / time window"),
    ),
    value: phase.sceneId ?? "",
  });
}

function appendTrackOwnershipEditor(
  ctx: ViewerAppContext,
  track: MotionPathTrack,
  template: EditorTemplate,
): void {
  ctx.appendOwnershipHeading();
  ctx.appendInspectorSelectRow({
    dataset: { ownershipProperty: "phaseId", trackId: track.id },
    label: ctx.deps.t("viewer.inspector.fields.phase", "Phase"),
    onChange: (value) =>
      ctx.updateTrackOwnership(track.id, { phaseId: value || null }),
    options: ctx.createPhaseOptions(
      template,
      ctx.deps.t("viewer.inspector.values.autoNone", "Auto / none"),
    ),
    value: track.phaseId ?? "",
  });
  ctx.appendInspectorSelectRow({
    dataset: { ownershipProperty: "sceneId", trackId: track.id },
    label: ctx.deps.t("viewer.inspector.fields.scene", "Scene"),
    onChange: (value) =>
      ctx.updateTrackOwnership(track.id, { sceneId: value || null }),
    options: ctx.createSceneOptions(
      template,
      ctx.deps.t("viewer.inspector.values.autoTime", "Auto / time window"),
    ),
    value: track.sceneId ?? "",
  });
}

function appendTrackKeyframeActions(
  ctx: ViewerAppContext,
  track: MotionPathTrack,
): void {
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = ctx.deps.t(
    "viewer.inspector.trackActions",
    "Track actions",
  );
  ctx.appendInspectorNode(heading);
  const row = document.createElement("div");
  row.className = "inspector-action-row";
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.inspectorAction = "add-track-keyframe";
  button.dataset.trackId = track.id;
  button.textContent = ctx.deps.t(
    "viewer.timeline.addKeyAtPlayhead",
    "Add key at playhead",
  );
  button.title = ctx.deps.t(
    "viewer.timeline.addKeyAtPlayheadTitle",
    "Create or update a keyframe on this track at the current playhead time. Shortcut: K",
  );
  button.addEventListener("click", () => ctx.addKeyframeAtPlayhead(track.id));
  row.append(button);
  ctx.appendInspectorNode(row);
}

function appendKeyframeOwnershipEditor(
  ctx: ViewerAppContext,
  track: MotionPathTrack,
  keyframe: TimelineKeyframe<unknown>,
  template: EditorTemplate,
): void {
  ctx.appendOwnershipHeading();
  ctx.appendInspectorSelectRow({
    dataset: {
      keyframeId: keyframe.id,
      ownershipProperty: "phaseId",
      trackId: track.id,
    },
    label: ctx.deps.t("viewer.inspector.fields.phase", "Phase"),
    onChange: (value) =>
      ctx.updateSelectedKeyframe(
        { phaseId: value || null },
        track.id,
        keyframe.id,
      ),
    options: ctx.createPhaseOptions(
      template,
      track.phaseId
        ? ctx.deps
            .t("viewer.inspector.values.inherit", "Inherit {value}")
            .replace("{value}", track.phaseId)
        : ctx.deps.t("viewer.inspector.values.autoNone", "Auto / none"),
    ),
    value: keyframe.phaseId ?? "",
  });
  ctx.appendInspectorSelectRow({
    dataset: {
      keyframeId: keyframe.id,
      ownershipProperty: "sceneId",
      trackId: track.id,
    },
    label: ctx.deps.t("viewer.inspector.fields.scene", "Scene"),
    onChange: (value) =>
      ctx.updateSelectedKeyframe(
        { sceneId: value || null },
        track.id,
        keyframe.id,
      ),
    options: ctx.createSceneOptions(
      template,
      track.sceneId
        ? ctx.deps
            .t("viewer.inspector.values.inherit", "Inherit {value}")
            .replace("{value}", track.sceneId)
        : ctx.deps.t("viewer.inspector.values.autoTime", "Auto / time window"),
    ),
    value: keyframe.sceneId ?? "",
  });
}

function appendOwnershipHeading(ctx: ViewerAppContext): void {
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = ctx.deps.t("viewer.inspector.ownership", "Ownership");
  ctx.appendInspectorNode(heading);
}

function createSceneOptions(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  emptyLabel: string,
): OwnershipOption[] {
  return createOwnershipOptions(
    ctx.normalizeScenes(template.scenes ?? [], template.duration),
    emptyLabel,
    ctx.deps.translateText,
  );
}

function createPhaseOptions(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  emptyLabel: string,
): OwnershipOption[] {
  return createOwnershipOptions(
    template.timeline?.phases ?? [],
    emptyLabel,
    ctx.deps.translateText,
  );
}

export function createOwnershipEditorActions(
  getContext: () => ViewerAppContext,
) {
  return {
    appendTimingOwnershipInspector: bindViewerAction(
      appendTimingOwnershipInspector,
      getContext,
    ),
    appendClipOwnershipEditor: bindViewerAction(
      appendClipOwnershipEditor,
      getContext,
    ),
    appendPhaseOwnershipEditor: bindViewerAction(
      appendPhaseOwnershipEditor,
      getContext,
    ),
    appendTrackOwnershipEditor: bindViewerAction(
      appendTrackOwnershipEditor,
      getContext,
    ),
    appendTrackKeyframeActions: bindViewerAction(
      appendTrackKeyframeActions,
      getContext,
    ),
    appendKeyframeOwnershipEditor: bindViewerAction(
      appendKeyframeOwnershipEditor,
      getContext,
    ),
    appendOwnershipHeading: bindViewerAction(
      appendOwnershipHeading,
      getContext,
    ),
    createSceneOptions: bindViewerAction(createSceneOptions, getContext),
    createPhaseOptions: bindViewerAction(createPhaseOptions, getContext),
  };
}
