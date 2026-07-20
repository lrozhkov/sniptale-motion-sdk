import type { ViewerAppContext } from "../app/context.js";
import {
  getKeyframeEasingLabel,
  KEYFRAME_EASING_PRESETS,
} from "./keyframe-labels.js";

function prepareInspectorSections(ctx: ViewerAppContext) {
  ctx.refs.inspectorPanel.innerHTML = "";
  for (const section of ["summary", "timing", "transform", "ownership"]) {
    const panel = document.createElement("div");
    panel.className = "inspector-section";
    panel.id = `inspector-${section}-panel`;
    panel.setAttribute("aria-labelledby", `inspector-${section}-tab`);
    panel.setAttribute("role", "tabpanel");
    panel.dataset.inspectorSection = section;
    panel.hidden = ctx.state.activeInspectorTab !== section;
    ctx.refs.inspectorPanel.append(panel);
  }
  ctx.state.inspectorAppendSection = "summary";
}

function setInspectorAppendSection(ctx: ViewerAppContext, section) {
  ctx.state.inspectorAppendSection = section;
}

export function isInspectorSectionActive(
  ctx: ViewerAppContext,
  section: string,
): boolean {
  return ctx.state.activeInspectorTab === section;
}

function getInspectorAppendTarget(ctx: ViewerAppContext) {
  return (
    ctx.refs.inspectorPanel.querySelector(
      `[data-inspector-section="${ctx.state.inspectorAppendSection ?? "summary"}"]`,
    ) ?? ctx.refs.inspectorPanel
  );
}

function appendInspectorNode(ctx: ViewerAppContext, ...nodes) {
  ctx.getInspectorAppendTarget().append(...nodes);
}

function appendInspectorRows(ctx: ViewerAppContext, title, rows) {
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = title;
  ctx.appendInspectorNode(heading);
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.className = "inspector-row";
    const name = document.createElement("span");
    name.textContent = label;
    const output = document.createElement("strong");
    output.textContent = String(value ?? "");
    output.title = String(value ?? "");
    row.append(name, output);
    ctx.appendInspectorNode(row);
  }
}

function appendInspectorKeyframeNumberField(
  ctx: ViewerAppContext,
  track,
  keyframe,
  field,
) {
  const row = document.createElement("label");
  row.className = "inspector-row inspector-edit-row";
  const name = document.createElement("span");
  name.textContent = field.label;
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(field.min);
  input.max = String(field.max);
  input.step = String(field.step);
  input.value = String(ctx.roundInspectorNumber(keyframe[field.property]));
  input.dataset.trackId = track.id;
  input.dataset.keyframeId = keyframe.id;
  input.dataset.keyframeProperty = field.property;
  input.addEventListener("change", () => {
    const value = ctx.deps.clamp(Number(input.value), field.min, field.max);
    input.value = String(ctx.roundInspectorNumber(value));
    ctx.updateSelectedKeyframe(
      { [field.property]: value },
      track.id,
      keyframe.id,
    );
  });
  row.append(name, input);
  ctx.appendInspectorNode(row);
}

function appendInspectorKeyframeEasingField(
  ctx: ViewerAppContext,
  track,
  keyframe,
) {
  const row = document.createElement("label");
  row.className = "inspector-row inspector-edit-row";
  const name = document.createElement("span");
  name.textContent = ctx.deps.t("viewer.fields.easing", "Easing");
  const select = document.createElement("select");
  select.dataset.trackId = track.id;
  select.dataset.keyframeId = keyframe.id;
  select.dataset.keyframeProperty = "easing";
  for (const easing of KEYFRAME_EASING_PRESETS) {
    const option = document.createElement("option");
    option.value = easing;
    option.textContent = getKeyframeEasingLabel(ctx, easing);
    select.append(option);
  }
  select.value = keyframe.easing ?? "linear";
  select.addEventListener("change", () =>
    ctx.updateSelectedKeyframe({ easing: select.value }, track.id, keyframe.id),
  );
  row.append(name, select);
  ctx.appendInspectorNode(row);
}

function appendInspectorSceneField(ctx: ViewerAppContext, scene, field) {
  const row = document.createElement("label");
  row.className = "inspector-row inspector-edit-row";
  const name = document.createElement("span");
  name.textContent = field.label;
  const input = document.createElement("input");
  input.type = field.kind === "text" ? "text" : "number";
  input.value =
    field.kind === "text"
      ? String(scene.label ?? scene.id)
      : String(ctx.roundInspectorNumber(scene[field.property]));
  input.dataset.sceneId = scene.id;
  input.dataset.sceneProperty = field.property;
  input.disabled = Boolean(scene.locked);
  if (field.kind === "number") {
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = String(field.step);
  }
  input.addEventListener("change", () => {
    const value = field.kind === "number" ? Number(input.value) : input.value;
    ctx.updateSceneProperty(scene.id, field.property, value);
  });
  row.append(name, input);
  ctx.appendInspectorNode(row);
}

function appendInspectorPhaseField(ctx: ViewerAppContext, phase, field) {
  const row = document.createElement("label");
  row.className = "inspector-row inspector-edit-row";
  const name = document.createElement("span");
  name.textContent = field.label;
  const input = document.createElement("input");
  input.type = field.kind === "text" ? "text" : "number";
  input.value =
    field.kind === "text"
      ? String(phase.label ?? phase.id)
      : String(ctx.roundInspectorNumber(phase[field.property]));
  input.dataset.phaseId = phase.id;
  input.dataset.phaseProperty = field.property;
  input.disabled = Boolean(phase.locked);
  if (field.kind === "number") {
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = String(field.step);
  }
  input.addEventListener("change", () => {
    const value = field.kind === "number" ? Number(input.value) : input.value;
    ctx.updatePhaseProperty(phase.id, field.property, value);
  });
  row.append(name, input);
  ctx.appendInspectorNode(row);
}

function appendInspectorClipField(ctx: ViewerAppContext, clip, field) {
  const row = document.createElement("label");
  row.className = "inspector-row inspector-edit-row";
  const name = document.createElement("span");
  name.textContent = field.label;
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(field.min);
  input.max = String(field.max);
  input.step = String(field.step);
  input.value = String(ctx.roundInspectorNumber(clip[field.property]));
  input.dataset.layerId = clip.layerId;
  input.dataset.clipProperty = field.property;
  input.addEventListener("change", () => {
    const value = ctx.deps.clamp(Number(input.value), field.min, field.max);
    input.value = String(ctx.roundInspectorNumber(value));
    ctx.beginEditorCommand({
      payload: { layerId: clip.layerId, property: field.property, value },
      type: "moveClip",
    });
    ctx.updateLayerClipProperty(clip.layerId, field.property, value);
  });
  row.append(name, input);
  ctx.appendInspectorNode(row);
}

export function installInspectorFieldsOwner(ctx: ViewerAppContext): void {
  ctx.prepareInspectorSections = (...args: any[]) =>
    (prepareInspectorSections as any)(ctx, ...args);
  ctx.setInspectorAppendSection = (...args: any[]) =>
    (setInspectorAppendSection as any)(ctx, ...args);
  ctx.isInspectorSectionActive = (...args: any[]) =>
    (isInspectorSectionActive as any)(ctx, ...args);
  ctx.getInspectorAppendTarget = (...args: any[]) =>
    (getInspectorAppendTarget as any)(ctx, ...args);
  ctx.appendInspectorNode = (...args: any[]) =>
    (appendInspectorNode as any)(ctx, ...args);
  ctx.appendInspectorRows = (...args: any[]) =>
    (appendInspectorRows as any)(ctx, ...args);
  ctx.appendInspectorKeyframeNumberField = (...args: any[]) =>
    (appendInspectorKeyframeNumberField as any)(ctx, ...args);
  ctx.appendInspectorKeyframeEasingField = (...args: any[]) =>
    (appendInspectorKeyframeEasingField as any)(ctx, ...args);
  ctx.appendInspectorSceneField = (...args: any[]) =>
    (appendInspectorSceneField as any)(ctx, ...args);
  ctx.appendInspectorPhaseField = (...args: any[]) =>
    (appendInspectorPhaseField as any)(ctx, ...args);
  ctx.appendInspectorClipField = (...args: any[]) =>
    (appendInspectorClipField as any)(ctx, ...args);
}
