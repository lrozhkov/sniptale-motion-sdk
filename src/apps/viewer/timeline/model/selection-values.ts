import type { SelectionModifiers, ViewerSelection } from "./selection-model.js";

export function resolveSelectionValues(
  values: readonly string[],
  value: string,
  event: SelectionModifiers | null,
): string[] {
  return event?.shiftKey || event?.metaKey || event?.ctrlKey
    ? values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value]
    : [value];
}

export function resolvePrimarySelectionItem(
  type: "layer" | "clip" | "phase" | "scene",
  values: readonly string[],
): ViewerSelection {
  const primary = values.at(-1);
  if (!primary) return { type: "effect" };
  if (type === "phase") return { type, phaseId: primary };
  if (type === "scene") return { type, sceneId: primary };
  return { type, layerId: primary };
}
