import { bindViewerAction } from "../app/bind-action.js";
import type {
  EffectClip,
  EffectScene,
  TimelinePhase,
  TimelineKeyframe,
} from "../../../sdk/types.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type {
  InspectorFieldActions,
  InspectorTimingField,
  InspectorRowValue,
} from "./fields-contract.js";
import {
  readInspectorNumber,
  type InspectorNumberField,
} from "./field-model.js";
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

function setInspectorAppendSection(ctx: ViewerAppContext, section: string) {
  ctx.state.inspectorAppendSection = section;
}

export function isInspectorSectionActive(
  ctx: ViewerAppContext,
  section: string,
): boolean {
  return ctx.state.activeInspectorTab === section;
}

function getInspectorAppendTarget(ctx: ViewerAppContext) {
  const target = ctx.refs.inspectorPanel.querySelector(
    `[data-inspector-section="${ctx.state.inspectorAppendSection ?? "summary"}"]`,
  );
  return target instanceof HTMLElement ? target : ctx.refs.inspectorPanel;
}

function appendInspectorNode(
  ctx: ViewerAppContext,
  ...nodes: (Node | string)[]
) {
  ctx.getInspectorAppendTarget().append(...nodes);
}

function appendInspectorRows(
  ctx: ViewerAppContext,
  title: string,
  rows: readonly (readonly [string, InspectorRowValue])[],
) {
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
  track: MotionPathTrack,
  keyframe: TimelineKeyframe<unknown>,
  field: InspectorNumberField<"time" | "value">,
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
    const value = readInspectorNumber(input.valueAsNumber, field);
    if (value === null) {
      input.value = String(ctx.roundInspectorNumber(keyframe[field.property]));
      return;
    }
    input.value = String(ctx.roundInspectorNumber(value));
    void ctx.updateSelectedKeyframe(
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
  track: MotionPathTrack,
  keyframe: TimelineKeyframe<unknown>,
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
  select.addEventListener("change", () => {
    const easing = KEYFRAME_EASING_PRESETS.find(
      (value) => value === select.value,
    );
    if (easing)
      void ctx.updateSelectedKeyframe({ easing }, track.id, keyframe.id);
  });
  row.append(name, select);
  ctx.appendInspectorNode(row);
}

function appendInspectorSceneField(
  ctx: ViewerAppContext,
  scene: EffectScene,
  field: InspectorTimingField,
) {
  const row = document.createElement("label");
  row.className = "inspector-row inspector-edit-row";
  const name = document.createElement("span");
  name.textContent = field.label;
  const input = document.createElement("input");
  input.type = field.kind === "text" ? "text" : "number";
  input.value =
    field.kind === "text"
      ? ctx.deps.translateText(scene.label, scene.id)
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
    const value =
      field.kind === "number"
        ? readInspectorNumber(input.valueAsNumber, field)
        : input.value;
    if (value === null) {
      input.value =
        field.kind === "number"
          ? String(ctx.roundInspectorNumber(scene[field.property]))
          : ctx.deps.translateText(scene.label, scene.id);
      return;
    }
    ctx.updateSceneProperty(scene.id, field.property, value);
  });
  row.append(name, input);
  ctx.appendInspectorNode(row);
}

function appendInspectorPhaseField(
  ctx: ViewerAppContext,
  phase: TimelinePhase,
  field: InspectorTimingField,
) {
  const row = document.createElement("label");
  row.className = "inspector-row inspector-edit-row";
  const name = document.createElement("span");
  name.textContent = field.label;
  const input = document.createElement("input");
  input.type = field.kind === "text" ? "text" : "number";
  input.value =
    field.kind === "text"
      ? ctx.deps.translateText(phase.label, phase.id)
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
    const value =
      field.kind === "number"
        ? readInspectorNumber(input.valueAsNumber, field)
        : input.value;
    if (value === null) {
      input.value =
        field.kind === "number"
          ? String(ctx.roundInspectorNumber(phase[field.property]))
          : ctx.deps.translateText(phase.label, phase.id);
      return;
    }
    ctx.updatePhaseProperty(phase.id, field.property, value);
  });
  row.append(name, input);
  ctx.appendInspectorNode(row);
}

function appendInspectorClipField(
  ctx: ViewerAppContext,
  clip: EffectClip,
  field: InspectorNumberField<"start" | "duration" | "offset">,
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
  input.value = String(ctx.roundInspectorNumber(clip[field.property]));
  input.dataset.layerId = clip.layerId;
  input.dataset.clipProperty = field.property;
  input.addEventListener("change", () => {
    const value = readInspectorNumber(input.valueAsNumber, field);
    if (value === null) {
      input.value = String(ctx.roundInspectorNumber(clip[field.property]));
      return;
    }
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

export function createInspectorFieldActions(
  getContext: () => ViewerAppContext,
): Pick<
  InspectorFieldActions,
  | "prepareInspectorSections"
  | "setInspectorAppendSection"
  | "isInspectorSectionActive"
  | "getInspectorAppendTarget"
  | "appendInspectorNode"
  | "appendInspectorRows"
  | "appendInspectorKeyframeNumberField"
  | "appendInspectorKeyframeEasingField"
  | "appendInspectorSceneField"
  | "appendInspectorPhaseField"
  | "appendInspectorClipField"
> {
  return {
    prepareInspectorSections: bindViewerAction(
      prepareInspectorSections,
      getContext,
    ),
    setInspectorAppendSection: bindViewerAction(
      setInspectorAppendSection,
      getContext,
    ),
    isInspectorSectionActive: bindViewerAction(
      isInspectorSectionActive,
      getContext,
    ),
    getInspectorAppendTarget: bindViewerAction(
      getInspectorAppendTarget,
      getContext,
    ),
    appendInspectorNode: bindViewerAction(appendInspectorNode, getContext),
    appendInspectorRows: bindViewerAction(appendInspectorRows, getContext),
    appendInspectorKeyframeNumberField: bindViewerAction(
      appendInspectorKeyframeNumberField,
      getContext,
    ),
    appendInspectorKeyframeEasingField: bindViewerAction(
      appendInspectorKeyframeEasingField,
      getContext,
    ),
    appendInspectorSceneField: bindViewerAction(
      appendInspectorSceneField,
      getContext,
    ),
    appendInspectorPhaseField: bindViewerAction(
      appendInspectorPhaseField,
      getContext,
    ),
    appendInspectorClipField: bindViewerAction(
      appendInspectorClipField,
      getContext,
    ),
  };
}
