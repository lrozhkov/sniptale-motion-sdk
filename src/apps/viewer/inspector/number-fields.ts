import { bindViewerAction } from "../app/bind-action.js";
import type { EffectLayer } from "../../../sdk/types.js";
import type { InspectorPropertyActions } from "./contract.js";
import {
  readInspectorNumber,
  type InspectorNumberField,
} from "./field-model.js";
import type { ViewerAppContext } from "../app/context.js";

function createInspectorNumberField(
  ctx: ViewerAppContext,
  layer: EffectLayer,
  field: InspectorNumberField,
) {
  const row = document.createElement("label");
  row.className = "inspector-row inspector-edit-row inspector-transform-row";
  row.dataset.inspectorProperty = field.property;
  const name = document.createElement("span");
  name.textContent = field.label;
  const canKeyframe = ctx.canKeyframeLayerProperty(layer, field.property);
  const keyButton = canKeyframe
    ? createLayerKeyframeButton(ctx, layer, field)
    : null;
  row.classList.toggle("without-keyframe", !canKeyframe);
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(field.min);
  input.max = String(field.max);
  input.step = String(field.step);
  input.value = String(
    ctx.roundInspectorNumber(
      ctx.getResolvedLayerProperty(layer, field.property),
    ),
  );
  input.setAttribute("aria-label", field.label);
  input.dataset.layerId = layer.id;
  input.dataset.property = field.property;
  input.addEventListener("change", () => {
    const value = readInspectorNumber(input.valueAsNumber, field);
    if (value === null) {
      input.value = String(
        ctx.roundInspectorNumber(
          ctx.getResolvedLayerProperty(layer, field.property),
        ),
      );
      return;
    }
    input.value = String(ctx.roundInspectorNumber(value));
    ctx.beginEditorCommand({
      payload: { layerId: layer.id, property: field.property, value },
      type: "updateLayerProperty",
    });
    ctx.updateLayerProperty(layer.id, field.property, value);
  });
  row.append(name, ...(keyButton ? [keyButton] : []), input);
  return row;
}

function createLayerKeyframeButton(
  ctx: ViewerAppContext,
  layer: EffectLayer,
  field: InspectorNumberField,
) {
  const keyButton = document.createElement("button");
  keyButton.type = "button";
  keyButton.className = `inspector-key-button${ctx.hasLayerPropertyKeyframeAtCurrentTime(layer.id, field.property) ? " active" : ""}`;
  keyButton.dataset.layerId = layer.id;
  keyButton.dataset.property = field.property;
  keyButton.textContent = ctx.deps.t("viewer.timeline.keyframeIcon", "◆");
  keyButton.title = keyButton.classList.contains("active")
    ? ctx.deps.t(
        "viewer.timeline.removeKeyframeAtCurrentTime",
        "Remove keyframe at current time",
      )
    : ctx.deps.t(
        "viewer.timeline.addKeyframeAtCurrentTime",
        "Add keyframe at current time",
      );
  keyButton.setAttribute("aria-label", keyButton.title);
  keyButton.setAttribute(
    "aria-pressed",
    String(keyButton.classList.contains("active")),
  );
  keyButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    ctx.toggleLayerPropertyKeyframe(layer.id, field.property);
  });
  return keyButton;
}

function appendInspectorNumberField(
  ctx: ViewerAppContext,
  layer: EffectLayer,
  field: InspectorNumberField,
  target: HTMLElement | null = null,
) {
  const row = createInspectorNumberField(ctx, layer, field);
  if (target) {
    target.append(row);
  } else {
    ctx.appendInspectorNode(row);
  }
  return row;
}

export function roundInspectorNumber(value: unknown) {
  const numeric =
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  const scaled = numeric * 1000;
  return Number.isFinite(scaled) ? Math.round(scaled) / 1000 : numeric;
}

export function syncInspectorLayerPropertyState(
  ctx: ViewerAppContext,
  layerId: string,
  properties: Readonly<Record<string, unknown>>,
): void {
  const propertyNames = new Set(Object.keys(properties));
  if (propertyNames.size === 0) {
    return;
  }
  const inputs = ctx.refs.inspectorPanel.querySelectorAll(
    "input[data-layer-id][data-property]",
  );
  for (const input of inputs) {
    if (!(input instanceof HTMLInputElement)) continue;
    const property = input.dataset.property;
    if (
      !property ||
      input.dataset.layerId !== layerId ||
      !propertyNames.has(property) ||
      document.activeElement === input
    ) {
      continue;
    }
    input.value = String(ctx.roundInspectorNumber(properties[property]));
  }
  const keyButtons = ctx.refs.inspectorPanel.querySelectorAll(
    ".inspector-key-button[data-layer-id][data-property]",
  );
  for (const button of keyButtons) {
    if (!(button instanceof HTMLButtonElement)) continue;
    const property = button.dataset.property ?? "";
    if (button.dataset.layerId !== layerId || !propertyNames.has(property)) {
      continue;
    }
    const active = ctx.hasLayerPropertyKeyframeAtCurrentTime(layerId, property);
    const title = active
      ? ctx.deps.t(
          "viewer.timeline.removeKeyframeAtCurrentTime",
          "Remove keyframe at current time",
        )
      : ctx.deps.t(
          "viewer.timeline.addKeyframeAtCurrentTime",
          "Add keyframe at current time",
        );
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", title);
    button.title = title;
  }
}

export function createInspectorNumberFieldActions(
  getContext: () => ViewerAppContext,
): Pick<
  InspectorPropertyActions,
  | "createInspectorNumberField"
  | "appendInspectorNumberField"
  | "roundInspectorNumber"
  | "syncInspectorLayerPropertyState"
> {
  return {
    createInspectorNumberField: bindViewerAction(
      createInspectorNumberField,
      getContext,
    ),
    appendInspectorNumberField: bindViewerAction(
      appendInspectorNumberField,
      getContext,
    ),
    roundInspectorNumber,
    syncInspectorLayerPropertyState: bindViewerAction(
      syncInspectorLayerPropertyState,
      getContext,
    ),
  };
}
