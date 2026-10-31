import {
  readInspectorNumber,
  type InspectorNumberField,
} from "./field-model.js";
import type { LayerSelectionInspectorModel } from "./layer-selection-model.js";
import type { CanvasPropertyUpdates } from "../canvas/contract.js";
import type { ViewerAppContext } from "../app/context.js";

export function appendSelectionCommonProperties(
  ctx: ViewerAppContext,
  model: LayerSelectionInspectorModel,
): void {
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

function appendCommonFields(
  ctx: ViewerAppContext,
  model: LayerSelectionInspectorModel,
  body: HTMLElement,
  fields: LayerSelectionInspectorModel["commonFields"],
): void {
  for (const field of fields) {
    const first = field.values[0];
    const mixed =
      first === undefined ||
      !Number.isFinite(first) ||
      field.values.some(
        (value) => !Number.isFinite(value) || Math.abs(value - first) > 0.0001,
      );
    body.append(
      createSelectionNumberField(ctx, {
        disabled: !model.propertyEditable,
        field,
        label: field.label,
        mixed,
        onChange: (value) =>
          updateSelectionCommonProperty(ctx, model, field.property, value),
        value: mixed ? null : (first ?? null),
      }),
    );
  }
}

function updateSelectionCommonProperty(
  ctx: ViewerAppContext,
  model: LayerSelectionInspectorModel,
  property: string,
  requestedValue: number,
): void {
  const value = requestedValue;
  if (!Number.isFinite(value)) {
    return;
  }
  ctx.beginEditorCommand({
    payload: { layerIds: model.layerIds, property, value },
    type: "updateLayerProperty",
  });
  ctx.updateLayerPropertyBatchAtTime(
    model.time,
    Object.fromEntries<CanvasPropertyUpdates>(
      model.layerIds.map(
        (layerId) => [layerId, { [property]: value }] as const,
      ),
    ),
    { keyframe: true },
  );
}

export function createSelectionNumberField(
  ctx: ViewerAppContext,
  {
    disabled,
    field = null,
    label,
    mixed = false,
    onChange,
    value,
  }: {
    disabled: boolean;
    field?: InspectorNumberField | null;
    label: string;
    mixed?: boolean;
    onChange: (value: number) => void;
    value: number | null;
  },
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
  if (field) input.dataset.selectionProperty = field.property;
  if (field) {
    input.min = String(field.min);
    input.max = String(field.max);
  }
  input.setAttribute("aria-label", label);
  input.addEventListener("change", () => {
    const next = readInspectorNumber(
      input.valueAsNumber,
      field ?? { min: -Infinity, max: Infinity },
    );
    if (next === null) {
      input.value =
        value === null ? "" : String(ctx.roundInspectorNumber(value));
      return;
    }
    onChange(next);
  });
  row.append(name, input);
  return row;
}

function createInspectorPropertyGroup(label: string, bodyClass: string) {
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
