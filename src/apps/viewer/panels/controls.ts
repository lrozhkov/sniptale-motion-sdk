import type { ViewerAppContext } from "../app/context.js";
import {
  renderControlPresetSelector,
  syncControlPresetSelection,
} from "./control-presets.js";
import { createCssColorField } from "../controls/css-color-field.js";

function renderControls(ctx: ViewerAppContext, template) {
  ctx.refs.controlsPanel.innerHTML = "";
  renderControlPresetSelector(ctx, template);
  const controls = [...(template.controls ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  if (controls.length === 0) {
    const empty = document.createElement("div");
    empty.className = "panel-empty-state";
    empty.textContent = ctx.deps.t(
      "viewer.controls.empty",
      "This composition has no custom controls.",
    );
    ctx.refs.controlsPanel.append(empty);
    return;
  }
  for (const control of controls) {
    const row = document.createElement("div");
    row.className = "control-row";
    const label = document.createElement("span");
    label.className = "control-row-label";
    label.textContent = ctx.deps.translateText(control.label, control.id);
    const input = ctx.createControlInput(
      control,
      ctx.state.controls[control.id] ?? control.defaultValue,
    );
    nameControlInputs(ctx, input, label.textContent);
    row.dataset.controlId = control.id;
    input.dataset.controlId = control.id;
    let editSessionActive = false;
    const updateControl = () => {
      const value = ctx.readInputValue(input, control);
      if (Object.is(ctx.state.controls[control.id], value)) {
        return;
      }
      if (!editSessionActive) {
        editSessionActive = true;
        ctx.beginEditorCommand({
          payload: { controlId: control.id },
          type: "updateControl",
        });
      }
      ctx.state.controls[control.id] = value;
      syncControlPresetSelection(ctx, template);
      ctx.markEditorChanged?.(`control:${control.id}`);
      void ctx.renderCurrentFrame();
    };
    const finishEditSession = () => {
      if (editSessionActive) {
        ctx.markEditorChanged?.(`control:${control.id}:end`, {
          immediate: true,
        });
      }
      editSessionActive = false;
    };
    input.addEventListener("input", updateControl);
    input.addEventListener("change", () => {
      updateControl();
      finishEditSession();
    });
    input.addEventListener("focusout", finishEditSession);
    input.addEventListener("pointercancel", finishEditSession);
    row.append(label, input);
    ctx.refs.controlsPanel.append(row);
  }
}

function nameControlInputs(ctx: ViewerAppContext, root, label: string) {
  const inputs = root.matches?.("input, select, textarea")
    ? [root]
    : Array.from(root.querySelectorAll?.("input, select, textarea") ?? []);
  for (const input of inputs) {
    const key =
      input.type === "range"
        ? "viewer.controls.sliderLabel"
        : input.dataset.cssColorRole === "picker"
          ? "viewer.controls.colorPickerLabel"
          : input.dataset.cssColorRole === "value"
            ? "viewer.controls.colorValueLabel"
            : inputs.length > 1
              ? "viewer.controls.valueLabel"
              : null;
    input.setAttribute(
      "aria-label",
      key ? ctx.deps.t(key, "{label}").replace("{label}", label) : label,
    );
  }
}
function createControlInput(
  ctx: ViewerAppContext,
  control,
  currentValue = control.defaultValue,
) {
  if (control.kind === "color") {
    return createCssColorField({
      invalidMessage: ctx.deps.t(
        "viewer.controls.invalidColor",
        "Enter a CSS color or none.",
      ),
      pickerLabel: ctx.deps.t("viewer.controls.colorPicker", "Color picker"),
      value: currentValue ?? control.defaultValue,
      valueLabel: ctx.deps.t("viewer.controls.colorValue", "CSS color value"),
    });
  }
  if (Array.isArray(control.options) && control.options.length > 0) {
    const select = document.createElement("select");
    for (const option of control.options) {
      const item = document.createElement("option");
      item.value = String(option.value);
      item.textContent = ctx.deps.translateText(
        option.label,
        String(option.value),
      );
      select.append(item);
    }
    select.value = String(currentValue ?? control.defaultValue);
    return select;
  }
  if (control.kind === "text") {
    const input = document.createElement("input");
    input.type = "text";
    input.value = String(currentValue ?? control.defaultValue);
    return input;
  }
  const wrap = document.createElement("div");
  wrap.className = "control-inline";
  const range = document.createElement("input");
  range.type = "range";
  range.min = String(control.min ?? 0);
  range.max = String(control.max ?? 1);
  range.step = String(control.step ?? 0.01);
  range.value = String(currentValue ?? control.defaultValue);
  const value = document.createElement("input");
  value.type = "number";
  value.min = range.min;
  value.max = range.max;
  value.step = range.step;
  value.value = range.value;
  range.addEventListener("input", () => {
    value.value = range.value;
  });
  value.addEventListener("input", () => {
    range.value = value.value;
  });
  wrap.append(range, value);
  Object.defineProperty(wrap, "value", {
    get() {
      return range.value;
    },
  });
  return wrap;
}
function readInputValue(ctx: ViewerAppContext, input, control) {
  if (control.kind === "number") {
    return Number(input.value);
  }
  return input.value;
}

export function installPanelsControlsOwner(ctx: ViewerAppContext): void {
  ctx.renderControls = (...args: any[]) =>
    (renderControls as any)(ctx, ...args);
  ctx.createControlInput = (...args: any[]) =>
    (createControlInput as any)(ctx, ...args);
  ctx.readInputValue = (...args: any[]) =>
    (readInputValue as any)(ctx, ...args);
}
