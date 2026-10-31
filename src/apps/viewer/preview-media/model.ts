export const PREVIEW_MEDIA_SLOTS = ["source", "from", "to"] as const;

export type PreviewMediaSlot = (typeof PREVIEW_MEDIA_SLOTS)[number];

export function resolvePreviewMediaSlots(
  template: unknown,
): PreviewMediaSlot[] {
  const effect =
    template !== null && typeof template === "object" && "effectV1" in template
      ? template.effectV1
      : null;
  const kind =
    effect !== null && typeof effect === "object" && "kind" in effect
      ? effect.kind
      : null;
  if (kind === "targetEffect") return ["source"];
  if (kind === "transition") return ["from", "to"];
  return [];
}

export function parsePreviewMediaSlot(value: unknown): PreviewMediaSlot | null {
  return PREVIEW_MEDIA_SLOTS.find((slot) => slot === value) ?? null;
}
