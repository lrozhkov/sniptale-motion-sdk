import type { EditorText } from "../templates/model.js";
import type { LocaleText } from "../../../sdk/types.js";
export type ControlPresetOption = {
  id: string;
  label: EditorText;
  theme: { id: string; label: EditorText };
  values: Record<string, string | number>;
};

/** Read only selector fields; the SDK validates the complete document before applying a preset. */
export function readControlPresetOptions(
  value: unknown,
): ControlPresetOption[] {
  if (!Array.isArray(value)) return [];
  const entries: unknown[] = value;
  return entries.flatMap((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      !isRecord(entry.theme) ||
      typeof entry.theme.id !== "string"
    )
      return [];
    const values = readValues(entry.values);
    return values
      ? [
          {
            id: entry.id,
            label: readLabel(entry.label),
            theme: { id: entry.theme.id, label: readLabel(entry.theme.label) },
            values,
          },
        ]
      : [];
  });
}

function readValues(value: unknown): Record<string, string | number> | null {
  if (!isRecord(value)) return null;
  const values: Record<string, string | number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (
      typeof entry !== "string" &&
      (typeof entry !== "number" || !Number.isFinite(entry))
    )
      return null;
    Object.defineProperty(values, key, {
      value: entry,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return values;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readLabel(value: unknown): EditorText {
  if (value === null) return null;
  if (typeof value === "string") return value;
  if (!isRecord(value)) return null;
  const label: LocaleText = {};
  for (const [key, text] of Object.entries(value)) {
    if (text !== undefined && typeof text !== "string") return null;
    Object.defineProperty(label, key, { value: text, enumerable: true });
  }
  return label;
}
