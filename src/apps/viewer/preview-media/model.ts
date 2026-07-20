export const PREVIEW_MEDIA_SLOTS = ["source", "from", "to"] as const;

export type PreviewMediaSlot = (typeof PREVIEW_MEDIA_SLOTS)[number];

export function resolvePreviewMediaSlots(template: any): PreviewMediaSlot[] {
  const kind = template?.effectV1?.kind;
  if (kind === "targetEffect") return ["source"];
  if (kind === "transition") return ["from", "to"];
  return [];
}
