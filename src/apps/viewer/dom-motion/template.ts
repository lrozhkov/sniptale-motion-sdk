import { parseDomMotionDocument } from "../../../sdk/dom-motion/index.js";
import { translateText } from "../../../shared/i18n/index.js";
import type { EffectDefinition } from "../../../sdk/types.js";
import type { DomMotionDocument } from "../../../sdk/dom-motion/model.js";

export function createDomMotionTemplate(
  document: DomMotionDocument,
): EffectDefinition {
  const layers = [
    { id: "page", name: translateText(document.label, document.id) },
    ...document.bindings.map((b) => ({
      id: b.id,
      name: translateText(b.label, b.id),
    })),
  ].map((layer) => ({
    ...layer,
    type: "customDraw",
    visible: true,
    editor: {
      canvas: "none" as const,
      operations: [],
      properties: [],
      transform: [],
      keyframeProperties: document.timeline.tracks
        .filter((t) => t.target === layer.id)
        .map((t) => t.property!),
    },
  }));
  return {
    id: document.id,
    effectId: document.id,
    moduleId: `${document.id}-dom`,
    kind: "domScene",
    target: "dom",
    label: document.label,
    duration: document.duration,
    domMotion: document,
    assets: [],
    controls: [],
    scenes: [],
    layers,
    clips: layers.map((layer) => ({
      layerId: layer.id,
      start: 0,
      duration: document.duration,
    })),
    timeline: document.timeline,
  };
}
/** Parse the embedded document without asserting unrelated template fields. */
export function readDomMotionTemplateDocument(
  template: unknown,
): DomMotionDocument | null {
  if (
    !template ||
    typeof template !== "object" ||
    !("domMotion" in template) ||
    template.domMotion === undefined
  )
    return null;
  return parseDomMotionDocument(template.domMotion);
}
