import type { ViewerAppContext } from "../app/context.js";

function appendPhaseTimingInspector(
  ctx: ViewerAppContext,
  phase,
  totalDuration,
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
  scene,
  totalDuration,
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

function appendClipTimingInspector(ctx: ViewerAppContext, clip, totalDuration) {
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = ctx.deps.t(
    "viewer.inspector.clipTiming",
    "Clip Timing",
  );
  ctx.appendInspectorNode(heading);
  const fields = [
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

export function installInspectorTimingOwner(ctx: ViewerAppContext): void {
  ctx.appendPhaseTimingInspector = appendPhaseTimingInspector.bind(
    undefined,
    ctx,
  );
  ctx.appendSceneTimingInspector = appendSceneTimingInspector.bind(
    undefined,
    ctx,
  );
  ctx.appendClipTimingInspector = appendClipTimingInspector.bind(
    undefined,
    ctx,
  );
}
