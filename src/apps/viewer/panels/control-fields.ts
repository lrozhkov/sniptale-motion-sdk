import type { EditorControl, EditorText } from "../templates/model.js";
import { createCssColorField } from "../controls/css-color-field.js";
import { createControlIcon } from "./control-icons.js";

export type ControlField = { element: HTMLElement; readValue(): string };
export type ControlPresentationLocale = {
  t(key: string, fallback?: string): string;
  translateText(text: EditorText | undefined, fallback: string): string;
};

export function controlUnitLabel(
  control: EditorControl,
  locale: ControlPresentationLocale,
): string {
  const unit = control.unit;
  if (!unit) return "";
  if (unit === "count") return locale.t("viewer.controls.units.count");
  if (unit === "s" || unit === "ms")
    return locale.t(`viewer.controls.units.${unit}`);
  return unit === "percent"
    ? "%"
    : unit === "deg"
      ? "°"
      : unit === "ratio"
        ? "×"
        : "px";
}

export function createControlField(
  locale: ControlPresentationLocale,
  control: EditorControl,
  currentValue: unknown = control.defaultValue,
): ControlField {
  if (control.kind === "color") {
    const element = createCssColorField({
      invalidMessage: locale.t("viewer.controls.invalidColor"),
      pickerLabel: locale.t("viewer.controls.colorPicker"),
      value: controlValueText(currentValue),
      valueLabel: locale.t("viewer.controls.colorValue"),
    });
    return { element, readValue: () => element.value };
  }
  if (control.options?.length) {
    if (
      control.presentation === "segmented" ||
      control.presentation === "toggle"
    )
      return createOptionButtons(locale, control, currentValue);
    const select = document.createElement("select");
    for (const option of control.options) {
      const item = document.createElement("option");
      item.value = String(option.value);
      item.textContent = locale.translateText(
        option.label,
        String(option.value),
      );
      select.append(item);
    }
    select.value = controlValueText(currentValue);
    return { element: select, readValue: () => select.value };
  }
  if (control.kind === "text") {
    const input =
      control.presentation === "textarea"
        ? document.createElement("textarea")
        : document.createElement("input");
    input.value = controlValueText(currentValue);
    return { element: input, readValue: () => input.value };
  }
  const value = document.createElement("input");
  value.type = "number";
  if (control.min !== undefined) value.min = String(control.min);
  if (control.max !== undefined) value.max = String(control.max);
  value.step = String(control.step ?? 0.01);
  value.value = controlValueText(currentValue);
  if (control.presentation === "number")
    return { element: value, readValue: () => value.value };
  const wrap = document.createElement("div");
  wrap.className = "control-inline";
  const range = document.createElement("input");
  range.type = "range";
  range.min = String(control.min ?? 0);
  range.max = String(control.max ?? 1);
  range.step = value.step;
  range.value = value.value;
  range.addEventListener("input", () => {
    value.value = range.value;
  });
  value.addEventListener("input", () => {
    range.value = value.value;
  });
  wrap.append(range, value);
  // Read the editable numeric value without browser range rounding or clamping.
  return { element: wrap, readValue: () => value.value };
}

function createOptionButtons(
  locale: ControlPresentationLocale,
  control: EditorControl,
  currentValue: unknown,
): ControlField {
  const element = document.createElement("div");
  element.className = "control-options";
  element.setAttribute("role", "group");
  element.setAttribute(
    "aria-label",
    locale.translateText(control.label, control.id),
  );
  let selected = controlValueText(currentValue);
  const buttons: HTMLButtonElement[] = [];
  for (const option of control.options ?? []) {
    const button = document.createElement("button");
    button.type = "button";
    button.value = String(option.value);
    button.setAttribute("aria-pressed", String(selected === button.value));
    if (option.icon) button.append(createControlIcon(option.icon));
    button.append(
      document.createTextNode(locale.translateText(option.label, button.value)),
    );
    button.addEventListener("click", () => {
      selected = button.value;
      for (const item of buttons)
        item.setAttribute("aria-pressed", String(item.value === selected));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
    buttons.push(button);
    element.append(button);
  }
  return { element, readValue: () => selected };
}

function controlValueText(value: unknown): string {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? String(value)
    : "";
}
