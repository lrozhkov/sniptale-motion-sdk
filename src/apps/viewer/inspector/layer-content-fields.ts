import type { ViewerAppContext } from "../app/context.js";
import { createCssColorField } from "../controls/css-color-field.js";
import { getLayerContentFields } from "./layer-content-schema.js";

function createInspectorLayerField(ctx: ViewerAppContext, layer, field) {
  const row = document.createElement(field.kind === "color" ? "div" : "label");
  row.className = "inspector-row inspector-edit-row";
  row.classList.toggle("inspector-color-row", field.kind === "color");
  row.dataset.inspectorProperty = field.property;
  const name = document.createElement("span");
  name.textContent = field.label;
  const input: any =
    field.kind === "color"
      ? createCssColorField({
          invalidMessage: ctx.deps.t(
            "viewer.controls.invalidColor",
            "Enter a CSS color or none.",
          ),
          pickerLabel: ctx.deps
            .t("viewer.controls.colorPickerLabel", "{label} picker")
            .replace("{label}", field.label),
          value:
            layer[field.property] ?? field.defaultValue ?? field.options?.[0],
          valueLabel: ctx.deps
            .t("viewer.controls.colorValueLabel", "{label} CSS value")
            .replace("{label}", field.label),
        })
      : field.kind === "select"
        ? document.createElement("select")
        : document.createElement("input");
  if (field.kind === "select") {
    for (const optionValue of field.options ?? []) {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = ctx.deps.t(
        `viewer.inspector.layerOptions.${field.property}.${optionValue}`,
        ctx.toTitleLabel(optionValue),
      );
      input.append(option);
    }
  } else if (field.kind !== "color") {
    input.type =
      field.kind === "text"
        ? "text"
        : field.kind === "boolean"
          ? "checkbox"
          : "number";
  }
  if (field.kind === "boolean") {
    input.checked =
      layer[field.property] === true || layer[field.property] === "true";
    input.className = "inspector-boolean-toggle";
    input.setAttribute("role", "switch");
  } else if (field.kind !== "color") {
    input.value = String(
      field.kind === "number"
        ? ctx.roundInspectorNumber(
            layer[field.property] ?? field.defaultValue ?? 0,
          )
        : (layer[field.property] ??
            field.defaultValue ??
            field.options?.[0] ??
            ""),
    );
  }
  if (field.kind !== "color") {
    input.setAttribute("aria-label", field.label);
  }
  input.dataset.layerId = layer.id;
  input.dataset.property = field.property;
  if (field.kind === "number") {
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = String(field.step);
  }
  input.addEventListener("change", () => {
    const value =
      field.kind === "number"
        ? ctx.deps.clamp(Number(input.value), field.min, field.max)
        : field.kind === "boolean"
          ? input.checked
          : input.value;
    if (field.kind === "number") {
      input.value = String(ctx.roundInspectorNumber(value));
    }
    ctx.beginEditorCommand({
      payload: { layerId: layer.id, property: field.property, value },
      type: "updateLayerProperty",
    });
    ctx.updateLayerDefinitionProperty(layer.id, field.property, value);
    if (field.refreshInspector === true) {
      ctx.renderInspector();
    }
  });
  row.append(name, input);
  return row;
}

function appendInspectorLayerField(
  ctx: ViewerAppContext,
  layer,
  field,
  target = null,
) {
  const row = createInspectorLayerField(ctx, layer, field);
  if (target) {
    target.append(row);
  } else {
    ctx.appendInspectorNode(row);
  }
  return row;
}

export function installInspectorLayerContentFieldsOwner(
  ctx: ViewerAppContext,
): void {
  ctx.getLayerContentFields = getLayerContentFields.bind(undefined);
  ctx.createInspectorLayerField = createInspectorLayerField.bind(
    undefined,
    ctx,
  );
  ctx.appendInspectorLayerField = appendInspectorLayerField.bind(
    undefined,
    ctx,
  );
}
