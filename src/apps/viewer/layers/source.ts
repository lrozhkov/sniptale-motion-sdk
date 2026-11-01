import {
  optional,
  isString,
  isBoolean,
  nullableString,
  isList,
  isRecord,
} from "../../../shared/validation/values.js";
import type { EffectLayer } from "../../../sdk/types.js";

export function isEditorLayer(value: unknown): value is EffectLayer {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    optional(value, "editor", isLayerEditor) &&
    optional(value, "name", isString) &&
    optional(value, "parentId", nullableString) &&
    optional(value, "visible", isBoolean) &&
    optional(value, "locked", isBoolean)
  );
}

function isLayerEditor(value: unknown): boolean {
  return (
    isRecord(value) &&
    optional(
      value,
      "canvas",
      (mode) => mode === "bounds" || mode === "fullFrame" || mode === "none",
    ) &&
    optional(
      value,
      "operations",
      (items) =>
        isList(items) &&
        items.every(
          (item) =>
            item === "delete" || item === "duplicate" || item === "reorder",
        ),
    ) &&
    optional(
      value,
      "transform",
      (items) =>
        isList(items) &&
        items.every((item) =>
          ["anchorX", "anchorY", "rotation", "scaleX", "scaleY", "x", "y"].some(
            (allowed) => allowed === item,
          ),
        ),
    ) &&
    ["properties", "keyframeProperties"].every((key) =>
      optional(value, key, (items) => isList(items) && items.every(isString)),
    )
  );
}
