import type { EffectDefinition } from "../types.js";
import type { EffectV1Document } from "./types.js";

export function normalizeEffectV1ToTemplate(
  document: EffectV1Document,
): EffectDefinition {
  return {
    assets: document.assets.map((asset) => asset.id),
    category: "effect-v1",
    clips: structuredClone(document.clips),
    controls: structuredClone(document.controls),
    ...(document.controlPresets
      ? {
          controlPresets: structuredClone(document.controlPresets),
          defaultControlPresetId: document.defaultControlPresetId,
        }
      : {}),
    ...(document.description !== undefined
      ? { description: structuredClone(document.description) }
      : {}),
    duration: document.duration,
    effectId: document.id,
    id: document.id,
    kind:
      document.kind === "transition"
        ? "transitionEffect"
        : document.kind === "targetEffect"
          ? "layerEffect"
          : "composition",
    label: structuredClone(document.label),
    layers: structuredClone(document.layers),
    moduleId: document.id,
    presets: structuredClone(document.presets ?? []),
    scenes: structuredClone(document.scenes),
    target:
      document.kind === "transition"
        ? "transitionBoundary"
        : document.kind === "targetEffect"
          ? "selectedTarget"
          : "scene",
    timeline: structuredClone(document.timeline),
    effectV1: structuredClone(document),
  };
}
