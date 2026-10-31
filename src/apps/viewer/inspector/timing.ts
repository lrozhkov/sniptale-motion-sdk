import { bindViewerAction } from "../app/bind-action.js";
import type {
  EffectClip,
  EffectScene,
  TimelinePhase,
} from "../../../sdk/types.js";
import type { InspectorFieldActions } from "./fields-contract.js";
import type { InspectorNumberField } from "./field-model.js";
import type { ViewerAppContext } from "../app/context.js";

function appendPhaseTimingInspector(
  ctx: ViewerAppContext,
  phase: TimelinePhase,
  totalDuration: number,
) {
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = ctx.deps.t(
    "viewer.inspector.phaseTiming",
    "Phase Timing",
  );
  ctx.appendInspectorNode(heading);
  ctx.appendInspectorPhaseField(phase, {
    kind: "text",
    label: ctx.deps.t("viewer.fields.label", "Label"),
    property: "label",
  });
  ctx.appendInspectorPhaseField(phase, {
    kind: "number",
    label: ctx.deps.t("viewer.fields.start", "Start"),
    max: totalDuration,
    min: 0,
    property: "start",
    step: 0.01,
  });
  ctx.appendInspectorPhaseField(phase, {
    kind: "number",
    label: ctx.deps.t("viewer.fields.duration", "Duration"),
    max: totalDuration,
    min: 0.05,
    property: "duration",
    step: 0.01,
  });
}

function appendSceneTimingInspector(
  ctx: ViewerAppContext,
  scene: EffectScene,
  totalDuration: number,
) {
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = ctx.deps.t(
    "viewer.inspector.sceneTiming",
    "Scene Timing",
  );
  ctx.appendInspectorNode(heading);
  ctx.appendInspectorSceneField(scene, {
    kind: "text",
    label: ctx.deps.t("viewer.fields.label", "Label"),
    property: "label",
  });
  ctx.appendInspectorSceneField(scene, {
    kind: "number",
    label: ctx.deps.t("viewer.fields.start", "Start"),
    max: totalDuration,
    min: 0,
    property: "start",
    step: 0.01,
  });
  ctx.appendInspectorSceneField(scene, {
    kind: "number",
    label: ctx.deps.t("viewer.fields.duration", "Duration"),
    max: totalDuration,
    min: 0.05,
    property: "duration",
    step: 0.01,
  });
}

function appendClipTimingInspector(
  ctx: ViewerAppContext,
  clip: EffectClip,
  totalDuration: number,
) {
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = ctx.deps.t(
    "viewer.inspector.clipTiming",
    "Clip Timing",
  );
  ctx.appendInspectorNode(heading);
  const fields: readonly InspectorNumberField<
    "start" | "duration" | "offset"
  >[] = [
    {
      label: ctx.deps.t("viewer.fields.start", "Start"),
      max: totalDuration,
      min: 0,
      property: "start",
      step: 0.01,
    },
    {
      label: ctx.deps.t("viewer.fields.duration", "Duration"),
      max: totalDuration,
      min: 0.05,
      property: "duration",
      step: 0.01,
    },
    {
      label: ctx.deps.t("viewer.fields.offset", "Offset"),
      max: totalDuration,
      min: 0,
      property: "offset",
      step: 0.01,
    },
  ];
  for (const field of fields) {
    ctx.appendInspectorClipField(clip, field);
  }
}

export function createInspectorTimingActions(
  getContext: () => ViewerAppContext,
): Pick<
  InspectorFieldActions,
  | "appendPhaseTimingInspector"
  | "appendSceneTimingInspector"
  | "appendClipTimingInspector"
> {
  return {
    appendPhaseTimingInspector: bindViewerAction(
      appendPhaseTimingInspector,
      getContext,
    ),
    appendSceneTimingInspector: bindViewerAction(
      appendSceneTimingInspector,
      getContext,
    ),
    appendClipTimingInspector: bindViewerAction(
      appendClipTimingInspector,
      getContext,
    ),
  };
}
