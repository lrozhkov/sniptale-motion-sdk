import { bindViewerAction } from "../app/bind-action.js";
import type { ControlPanelActions } from "./contract.js";
import type {
  EditorControl,
  EditorTemplateSource,
} from "../templates/model.js";

import {
  createControlField,
  controlUnitLabel,
  type ControlField,
} from "./control-fields.js";
import { createControlGroupContainers } from "./control-groups.js";
import { resolveEffectV1ControlGroup } from "../../../sdk/effect-v1/control-presentation-model.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  renderControlPresetSelector,
  syncControlPresetSelection,
} from "./control-presets.js";

function renderControls(
  ctx: ViewerAppContext,
  template: EditorTemplateSource | null,
): void {
  ctx.refs.controlsPanel.innerHTML = "";
  if (!template) return;
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
  const groups = createControlGroupContainers(
    ctx.refs.controlsPanel,
    template,
    ctx.deps,
  );
  for (const control of controls) {
    const row = document.createElement("div");
    row.className = "control-row";
    const label = document.createElement("span");
    label.className = "control-row-label";
    label.textContent = ctx.deps.translateText(control.label, control.id);
    const field = createControlField(
      ctx.deps,
      control,
      ctx.state.controls[control.id] ?? control.defaultValue,
    );
    const input = field.element;
    const unit = controlUnitLabel(control, ctx.deps);
    nameControlInputs(
      ctx,
      input,
      `${ctx.deps.translateText(control.label, control.id)}${unit ? ` (${unit})` : ""}`,
    );
    row.dataset.controlId = control.id;
    input.dataset.controlId = control.id;
    let editSessionActive = false;
    const updateControl = () => {
      const value = readInputValue(field, control);
      if (typeof value === "number" && !Number.isFinite(value)) return;
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
    if (unit) {
      const suffix = document.createElement("span");
      suffix.className = "control-unit";
      suffix.textContent = unit;
      suffix.setAttribute("aria-hidden", "true");
      row.append(suffix);
    }
    const group =
      control.group && groups.has(control.group)
        ? control.group
        : (resolveEffectV1ControlGroup(control.group, template.controlGroups) ??
          "advanced");
    (groups.get(group) ?? ctx.refs.controlsPanel).append(row);
  }
}

function nameControlInputs(
  ctx: ViewerAppContext,
  root: HTMLElement,
  label: string,
): void {
  if (root.getAttribute("role") === "group")
    root.setAttribute("aria-label", label);
  const inputs = isValueInput(root)
    ? [root]
    : Array.from(root.querySelectorAll("input, select, textarea")).filter(
        isValueInput,
      );
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
function readInputValue(
  field: ControlField,
  control: EditorControl,
): string | number {
  const value = field.readValue();
  return control.kind === "number"
    ? value.trim() === ""
      ? NaN
      : Number(value)
    : value;
}

function isValueInput(
  element: Element,
): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  );
}

export function createControlPanelActions(
  getContext: () => ViewerAppContext,
): ControlPanelActions {
  return { renderControls: bindViewerAction(renderControls, getContext) };
}
