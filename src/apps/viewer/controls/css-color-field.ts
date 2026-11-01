export interface CssColorFieldOptions {
  invalidMessage: string;
  pickerLabel: string;
  value: unknown;
  valueLabel: string;
}

export type CssColorField = HTMLDivElement & { value: string };

const HEX_COLOR = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_COLOR =
  /^rgba?\(\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+))(?:\s*,\s*(?:[+-]?(?:\d+\.?\d*|\.\d+)%?))?\s*\)$/i;
let canvasColorContext: CanvasRenderingContext2D | null | undefined;

export function createCssColorField(
  options: CssColorFieldOptions,
): CssColorField {
  const root = document.createElement("div") as CssColorField;
  root.className = "css-color-field";

  const picker = document.createElement("label");
  picker.className = "css-color-picker";
  picker.title = options.pickerLabel;
  const preview = document.createElement("span");
  preview.className = "css-color-preview";
  preview.setAttribute("aria-hidden", "true");
  const pickerInput = document.createElement("input");
  pickerInput.type = "color";
  pickerInput.dataset.cssColorRole = "picker";
  pickerInput.setAttribute("aria-label", options.pickerLabel);
  picker.append(preview, pickerInput);

  const valueInput = document.createElement("input");
  valueInput.type = "text";
  valueInput.className = "css-color-value";
  valueInput.dataset.cssColorRole = "value";
  valueInput.autocomplete = "off";
  valueInput.spellcheck = false;
  valueInput.setAttribute("aria-label", options.valueLabel);

  let committedValue = (
    typeof options.value === "string" ? options.value : ""
  ).trim();
  let committedValid = isValidCssPaint(committedValue);

  const syncVisuals = (value: string) => {
    const normalized = value.trim();
    const isNone = normalized.toLowerCase() === "none";
    preview.dataset.paintInvalid = "false";
    preview.dataset.paintEmpty = String(isNone);
    preview.style.setProperty(
      "--css-color-preview",
      isNone ? "transparent" : normalized,
    );
    pickerInput.value = toOpaqueHex(normalized, pickerInput.value || "#000000");
  };

  const showInvalidPreview = () => {
    preview.dataset.paintEmpty = "false";
    preview.dataset.paintInvalid = "true";
    preview.style.setProperty("--css-color-preview", "transparent");
  };

  const setValidity = (valid: boolean) => {
    valueInput.setCustomValidity(valid ? "" : options.invalidMessage);
    valueInput.setAttribute("aria-invalid", String(!valid));
    valueInput.title = valid ? valueInput.value : options.invalidMessage;
  };

  const restoreCommittedValue = () => {
    valueInput.value = committedValue;
    setValidity(committedValid);
    if (committedValid) {
      syncVisuals(committedValue);
    } else {
      showInvalidPreview();
    }
  };

  const emitCommit = () => {
    root.dispatchEvent(new Event("input"));
    root.dispatchEvent(new Event("change"));
  };

  valueInput.value = committedValue;
  setValidity(committedValid);
  if (committedValid) {
    syncVisuals(committedValue);
  } else {
    showInvalidPreview();
  }

  valueInput.addEventListener("input", (event) => {
    event.stopPropagation();
    const valid = isValidCssPaint(valueInput.value);
    setValidity(valid);
    if (valid) {
      syncVisuals(valueInput.value);
    } else {
      showInvalidPreview();
    }
  });
  valueInput.addEventListener("change", (event) => {
    event.stopPropagation();
    const nextValue = valueInput.value.trim();
    if (!isValidCssPaint(nextValue)) {
      setValidity(false);
      showInvalidPreview();
      return;
    }
    if (nextValue === committedValue) {
      restoreCommittedValue();
      return;
    }
    committedValue = nextValue;
    committedValid = true;
    valueInput.value = committedValue;
    setValidity(true);
    syncVisuals(committedValue);
    emitCommit();
  });
  valueInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      restoreCommittedValue();
      valueInput.blur();
    }
  });
  pickerInput.addEventListener("input", (event) => {
    event.stopPropagation();
    committedValue = pickerInput.value;
    committedValid = true;
    valueInput.value = committedValue;
    setValidity(true);
    syncVisuals(committedValue);
    root.dispatchEvent(new Event("input"));
  });
  pickerInput.addEventListener("change", (event) => {
    event.stopPropagation();
    root.dispatchEvent(new Event("change"));
  });

  Object.defineProperty(root, "value", {
    get() {
      return committedValue;
    },
  });
  root.append(picker, valueInput);
  return root;
}

export function isValidCssPaint(value: unknown): boolean {
  const text = (typeof value === "string" ? value : "").trim();
  if (!text) {
    return false;
  }
  if (text.toLowerCase() === "none") {
    return true;
  }
  if (HEX_COLOR.test(text) || RGB_COLOR.test(text)) {
    return true;
  }
  return resolveCanvasColor(text) !== null;
}

export function toOpaqueHex(value: unknown, fallback = "#000000"): string {
  const text = (typeof value === "string" ? value : "").trim();
  const hex = parseHexColor(text);
  if (hex) {
    return hex;
  }
  const rgb = text.match(RGB_COLOR);
  if (rgb) {
    return rgbPartsToHex(rgb.slice(1, 4));
  }
  const resolved = resolveCanvasColor(text);
  if (resolved && resolved !== text) {
    return toOpaqueHex(resolved, fallback);
  }
  return parseHexColor(fallback) ?? "#000000";
}

function parseHexColor(value: string): string | null {
  const match = value.match(HEX_COLOR);
  if (!match) {
    return null;
  }
  const digits = match[1];
  if (!digits) return null;
  if (digits.length === 3 || digits.length === 4) {
    return `#${digits
      .slice(0, 3)
      .split("")
      .map((character) => character + character)
      .join("")}`.toLowerCase();
  }
  return `#${digits.slice(0, 6)}`.toLowerCase();
}

function rgbPartsToHex(parts: string[]): string {
  return `#${parts
    .map((part) =>
      Math.max(0, Math.min(255, Math.round(Number(part))))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function resolveCanvasColor(value: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  if (canvasColorContext === undefined) {
    canvasColorContext = document.createElement("canvas").getContext("2d");
  }
  const context = canvasColorContext;
  if (!context) {
    return null;
  }
  context.fillStyle = "#010203";
  if (String(context.fillStyle) !== "#010203") return null;
  context.fillStyle = value;
  const first = String(context.fillStyle);
  context.fillStyle = "#040506";
  if (String(context.fillStyle) !== "#040506") return null;
  context.fillStyle = value;
  const second = String(context.fillStyle);
  return first === second ? first : null;
}
