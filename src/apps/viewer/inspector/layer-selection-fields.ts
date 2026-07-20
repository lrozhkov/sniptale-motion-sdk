import type { ViewerAppContext } from "../app/context.js";

export function appendSelectionCommonProperties(ctx, model): void {
  const primary = model.commonFields.filter((field) => !field.advanced);
  const advanced = model.commonFields.filter((field) => field.advanced);
  if (primary.length > 0) {
    const group = createInspectorPropertyGroup(
      ctx.deps.t("viewer.inspector.selection.common", "Common properties"),
      "inspector-property-grid paired",
    );
    appendCommonFields(ctx, model, group.body, primary);
    ctx.appendInspectorNode(group.root);
  }
  if (advanced.length > 0) {
    const details = document.createElement("details");
    details.className =
      "inspector-property-group inspector-property-disclosure";
    const summary = document.createElement("summary");
    summary.textContent = ctx.deps.t("viewer.inspector.advanced", "Advanced");
    const body = document.createElement("div");
    body.className = "inspector-property-grid";
    appendCommonFields(ctx, model, body, advanced);
    details.append(summary, body);
    ctx.appendInspectorNode(details);
  }
}

function appendCommonFields(ctx, model, body, fields): void {
  for (const field of fields) {
    const first = Number(field.values[0]) || 0;
    const mixed = field.values.some(
      (value) => Math.abs((Number(value) || 0) - first) > 0.0001,
    );
    body.append(
      createSelectionNumberField(ctx, {
        disabled: !model.propertyEditable,
        field,
        label: field.label,
        mixed,
        onChange: (value) =>
          updateSelectionCommonProperty(ctx, model, field.property, value),
        value: mixed ? null : first,
      }),
    );
  }
}

function updateSelectionCommonProperty(
  ctx,
  model,
  property,
  requestedValue,
): void {
  const value = Number(requestedValue);
  if (!Number.isFinite(value)) {
    return;
  }
  ctx.beginEditorCommand({
    payload: { layerIds: model.layerIds, property, value },
    type: "updateLayerProperty",
  });
  ctx.updateLayerPropertyBatchAtTime(
    model.time,
    Object.fromEntries(
      model.layerIds.map((layerId) => [layerId, { [property]: value }]),
    ),
    { keyframe: true },
  );
}

export function createSelectionNumberField(
  ctx,
  { disabled, field = null, label, mixed = false, onChange, value },
) {
  const row = document.createElement("label");
  row.className = "inspector-row inspector-edit-row without-keyframe";
  row.classList.toggle("mixed", mixed);
  const name = document.createElement("span");
  name.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.disabled = disabled;
  input.placeholder = mixed ? "—" : "";
  input.value =
    value === null || value === undefined
      ? ""
      : String(ctx.roundInspectorNumber(value));
  input.step = String(field?.step ?? 0.1);
  if (field) {
    input.min = String(field.min);
    input.max = String(field.max);
  }
  input.setAttribute("aria-label", label);
  input.addEventListener("change", () => onChange(input.value));
  row.append(name, input);
  return row;
}

function createInspectorPropertyGroup(label, bodyClass) {
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
