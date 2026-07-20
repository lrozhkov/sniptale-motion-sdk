import type { ViewerAppContext } from "../app/context.js";
import {
  KEYFRAME_EASING_PRESETS,
  getKeyframeEasingLabel,
} from "./keyframe-labels.js";
import { createKeyframeSelectionInspectorModel } from "./keyframe-selection-model.js";

function appendKeyframeSelectionInspector(ctx: ViewerAppContext, template) {
  const model = createKeyframeSelectionInspectorModel(ctx, template);
  if (!model) {
    return false;
  }
  if (ctx.isInspectorSectionActive("summary")) {
    ctx.setInspectorAppendSection("summary");
    appendSelectionSummary(ctx, model);
  }
  if (ctx.isInspectorSectionActive("timing")) {
    ctx.setInspectorAppendSection("timing");
    appendSelectionRange(ctx, model);
    appendSelectionActions(ctx, model);
    appendSelectionProperties(ctx, model);
  }
  if (ctx.isInspectorSectionActive("ownership")) {
    ctx.setInspectorAppendSection("ownership");
    appendSelectionOwnership(ctx, model);
  }
  return true;
}

function appendSelectionSummary(ctx, model): void {
  ctx.appendInspectorRows(
    ctx.deps.t(
      "viewer.inspector.keyframeSelection.title",
      "Keyframe selection",
    ),
    [
      [
        ctx.deps.t("viewer.inspector.keyframeSelection.items", "Keyframes"),
        String(model.entries.length),
      ],
      [
        ctx.deps.t("viewer.inspector.keyframeSelection.tracks", "Tracks"),
        String(model.trackCount),
      ],
      [
        ctx.deps.t("viewer.inspector.fields.start", "Start"),
        ctx.formatSeconds(model.bounds.start),
      ],
      [
        ctx.deps.t("viewer.inspector.end", "End"),
        ctx.formatSeconds(model.bounds.end),
      ],
      [
        ctx.deps.t("viewer.inspector.fields.duration", "Duration"),
        ctx.formatSeconds(model.bounds.duration),
      ],
      [
        ctx.deps.t(
          "viewer.inspector.keyframeSelection.numeric",
          "Numeric values",
        ),
        `${model.numericCount}/${model.entries.length}`,
      ],
    ],
  );
}

function appendSelectionRange(ctx, model): void {
  const section = createInspectorGroup(
    ctx.deps.t("viewer.inspector.keyframeSelection.range", "Selection range"),
    "inspector-property-grid keyframe-selection-range",
  );
  for (const [property, label, value, disabled] of [
    [
      "start",
      ctx.deps.t("viewer.inspector.fields.start", "Start"),
      model.bounds.start,
      false,
    ],
    [
      "end",
      ctx.deps.t("viewer.inspector.end", "End"),
      model.bounds.end,
      model.bounds.duration <= 0,
    ],
    [
      "duration",
      ctx.deps.t("viewer.inspector.fields.duration", "Duration"),
      model.bounds.duration,
      model.bounds.duration <= 0,
    ],
  ]) {
    section.body.append(
      createNumberField(ctx, {
        disabled,
        label,
        onChange: (next) =>
          ctx.setKeyframeSelectionRangeProperty(property, next),
        value,
      }),
    );
  }
  ctx.appendInspectorNode(section.root);
}

function appendSelectionActions(ctx, model): void {
  const section = createInspectorGroup(
    ctx.deps.t("viewer.inspector.keyframeSelection.arrange", "Arrange in time"),
    "keyframe-selection-actions",
  );
  for (const [label, disabled, action] of [
    [
      ctx.deps.t(
        "viewer.inspector.keyframeSelection.alignStart",
        "Align start",
      ),
      false,
      () => ctx.alignSelectedKeyframes("start"),
    ],
    [
      ctx.deps.t(
        "viewer.inspector.keyframeSelection.alignPlayhead",
        "Align to playhead",
      ),
      false,
      () => ctx.alignSelectedKeyframes("playhead"),
    ],
    [
      ctx.deps.t("viewer.inspector.keyframeSelection.alignEnd", "Align end"),
      false,
      () => ctx.alignSelectedKeyframes("end"),
    ],
    [
      ctx.deps.t("viewer.inspector.keyframeSelection.distribute", "Distribute"),
      !model.canDistribute,
      () => ctx.distributeSelectedKeyframes(),
    ],
    [
      ctx.deps.t(
        "viewer.inspector.keyframeSelection.quantize",
        "Quantize to frames",
      ),
      false,
      () => ctx.quantizeSelectedKeyframes(),
    ],
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary compact";
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener("click", action);
    section.body.append(button);
  }
  ctx.appendInspectorNode(section.root);
}

function appendSelectionProperties(ctx, model): void {
  const section = createInspectorGroup(
    ctx.deps.t(
      "viewer.inspector.keyframeSelection.common",
      "Common properties",
    ),
    "inspector-property-grid keyframe-selection-properties",
  );
  section.body.append(
    createNumberField(ctx, {
      disabled: !model.canEditValue,
      label: ctx.deps.t("viewer.fields.value", "Value"),
      mixed: model.value?.mixed ?? true,
      onChange: (value) =>
        ctx.updateSelectedKeyframesBatch({ value: Number(value) }),
      value: model.value?.value ?? null,
    }),
    createEasingField(ctx, model),
  );
  if (!model.canEditEasing || !model.canEditValue) {
    const note = document.createElement("p");
    note.className = "inspector-capability-note";
    note.textContent = !model.canEditValue
      ? ctx.deps.t(
          "viewer.inspector.keyframeSelection.valueUnavailable",
          "Value editing requires every selected keyframe to contain a numeric value.",
        )
      : ctx.deps.t(
          "viewer.inspector.keyframeSelection.easingUnavailable",
          "Easing requires an outgoing segment for every selected keyframe.",
        );
    section.root.append(note);
  }
  ctx.appendInspectorNode(section.root);
}

function createEasingField(ctx, model) {
  const row = document.createElement("label");
  row.className = "inspector-row inspector-edit-row";
  const label = document.createElement("span");
  label.textContent = ctx.deps.t("viewer.fields.easing", "Easing");
  const select = document.createElement("select");
  select.disabled = !model.canEditEasing;
  if (model.easing.mixed) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = ctx.deps.t(
      "viewer.inspector.keyframeSelection.mixed",
      "—",
    );
    select.append(option);
  }
  for (const easing of KEYFRAME_EASING_PRESETS) {
    const option = document.createElement("option");
    option.value = easing;
    option.textContent = getKeyframeEasingLabel(ctx, easing);
    select.append(option);
  }
  select.value = model.easing.mixed ? "" : model.easing.value;
  select.addEventListener("change", () => {
    if (select.value) {
      ctx.updateSelectedKeyframesBatch({ easing: select.value });
    }
  });
  row.append(label, select);
  return row;
}

function appendSelectionOwnership(ctx, model): void {
  ctx.appendInspectorRows(
    ctx.deps.t("viewer.inspector.ownership", "Ownership"),
    [
      [
        ctx.deps.t("viewer.inspector.fields.scene", "Scene"),
        formatOwnershipValues(ctx, model.ownership.scenes),
      ],
      [
        ctx.deps.t("viewer.inspector.fields.phase", "Phase"),
        formatOwnershipValues(ctx, model.ownership.phases),
      ],
    ],
  );
}

function formatOwnershipValues(ctx, values): string {
  if (values.length === 0) {
    return ctx.deps.t("viewer.inspector.values.none", "None");
  }
  if (values.length === 1) {
    return values[0];
  }
  return ctx.deps
    .t("viewer.inspector.keyframeSelection.mixedCount", "{count} values")
    .replace("{count}", String(values.length));
}

function createNumberField(
  ctx,
  { disabled = false, label, mixed = false, onChange, value },
) {
  const row = document.createElement("label");
  row.className = "inspector-row inspector-edit-row";
  row.classList.toggle("mixed", mixed);
  const name = document.createElement("span");
  name.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.disabled = disabled;
  input.step = "0.01";
  input.placeholder = mixed
    ? ctx.deps.t("viewer.inspector.keyframeSelection.mixed", "—")
    : "";
  input.value =
    value === null || value === undefined
      ? ""
      : String(ctx.roundInspectorNumber(value));
  input.addEventListener("change", () => onChange(input.value));
  row.append(name, input);
  return row;
}

function createInspectorGroup(label, bodyClass) {
  const root = document.createElement("section");
  root.className = "inspector-property-group";
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = label;
  const body = document.createElement("div");
  body.className = bodyClass;
  root.append(heading, body);
  return { body, root };
}

export function installInspectorKeyframeSelectionOwner(
  ctx: ViewerAppContext,
): void {
  ctx.appendKeyframeSelectionInspector = (...args: any[]) =>
    (appendKeyframeSelectionInspector as any)(ctx, ...args);
}
