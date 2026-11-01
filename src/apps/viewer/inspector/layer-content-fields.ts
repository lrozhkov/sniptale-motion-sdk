import { parseSvgPartIdList } from "./svg-part-fields.js";
import { bindViewerAction } from "../app/bind-action.js";
import type { EffectLayer } from "../../../sdk/types.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  createCssColorField,
  type CssColorField,
} from "../controls/css-color-field.js";
import type { InspectorPropertyActions } from "./contract.js";
import {
  readInspectorNumber,
  type InspectorLayerField,
} from "./field-model.js";
import { getLayerContentFields } from "./layer-content-schema.js";

function createInspectorLayerField(
  ctx: ViewerAppContext,
  layer: EffectLayer,
  field: InspectorLayerField,
): HTMLElement {
  const row = document.createElement(field.kind === "color" ? "div" : "label");
  row.className = "inspector-row inspector-edit-row";
  row.classList.toggle("inspector-color-row", field.kind === "color");
  row.dataset.inspectorProperty = field.property;
  const name = document.createElement("span");
  name.textContent = field.label;
  const commit = (value: unknown) => {
    ctx.beginEditorCommand({
      payload: { layerId: layer.id, property: field.property, value },
      type: "updateLayerProperty",
    });
    ctx.updateLayerDefinitionProperty(layer.id, field.property, value);
    if (field.refreshInspector === true) ctx.renderInspector();
  };
  const input = createLayerFieldControl(ctx, layer, field, commit);
  input.dataset.layerId = layer.id;
  input.dataset.property = field.property;
  if (field.kind !== "color") input.setAttribute("aria-label", field.label);
  row.append(name, input);
  return row;
}

function createLayerFieldControl(
  ctx: ViewerAppContext,
  layer: EffectLayer,
  field: InspectorLayerField,
  commit: (value: unknown) => void,
): HTMLInputElement | HTMLSelectElement | CssColorField {
  const value = layer[field.property] ?? field.defaultValue;
  if (field.kind === "color") {
    const input = createCssColorField({
      invalidMessage: ctx.deps.t(
        "viewer.controls.invalidColor",
        "Enter a CSS color or none.",
      ),
      pickerLabel: ctx.deps
        .t("viewer.controls.colorPickerLabel", "{label} picker")
        .replace("{label}", field.label),
      value: typeof value === "string" ? value : field.defaultValue,
      valueLabel: ctx.deps
        .t("viewer.controls.colorValueLabel", "{label} CSS value")
        .replace("{label}", field.label),
    });
    input.addEventListener("change", () => commit(input.value));
    return input;
  }
  if (field.kind === "select") {
    const input = document.createElement("select");
    for (const optionValue of field.options) {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = ctx.deps.t(
        `viewer.inspector.layerOptions.${field.property}.${optionValue}`,
        ctx.toTitleLabel(optionValue),
      );
      input.append(option);
    }
    input.value =
      typeof value === "string" && field.options.includes(value)
        ? value
        : field.defaultValue;
    input.addEventListener("change", () => {
      if (field.options.includes(input.value)) commit(input.value);
    });
    return input;
  }
  const input = document.createElement("input");
  if (field.kind === "boolean") {
    input.type = "checkbox";
    input.checked = value === true || value === "true";
    input.className = "inspector-boolean-toggle";
    input.setAttribute("role", "switch");
    input.addEventListener("change", () => commit(input.checked));
  } else if (field.kind === "number") {
    input.type = "number";
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = String(field.step);
    input.value = String(ctx.roundInspectorNumber(value));
    input.addEventListener("change", () => {
      const next = readInspectorNumber(input.valueAsNumber, field);
      if (next === null) {
        input.value = String(
          ctx.roundInspectorNumber(layer[field.property] ?? field.defaultValue),
        );
        return;
      }
      input.value = String(ctx.roundInspectorNumber(next));
      commit(next);
    });
  } else {
    input.type = "text";
    input.value =
      field.property === "svgPartIds"
        ? parseSvgPartIdList(value).join(", ")
        : typeof value === "string"
          ? value
          : field.defaultValue;
    input.addEventListener("change", () =>
      commit(
        field.property === "svgPartIds"
          ? parseSvgPartIdList(input.value)
          : input.value,
      ),
    );
  }
  return input;
}

function appendInspectorLayerField(
  ctx: ViewerAppContext,
  layer: EffectLayer,
  field: InspectorLayerField,
  target: HTMLElement | null = null,
): HTMLElement {
  const row = createInspectorLayerField(ctx, layer, field);
  if (target) target.append(row);
  else ctx.appendInspectorNode(row);
  return row;
}

export function createInspectorLayerContentActions(
  getContext: () => ViewerAppContext,
): Pick<
  InspectorPropertyActions,
  | "getLayerContentFields"
  | "createInspectorLayerField"
  | "appendInspectorLayerField"
> {
  return {
    getLayerContentFields,
    createInspectorLayerField: bindViewerAction(
      createInspectorLayerField,
      getContext,
    ),
    appendInspectorLayerField: bindViewerAction(
      appendInspectorLayerField,
      getContext,
    ),
  };
}
