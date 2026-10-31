export const FRAME_OBSERVATION_ATTRIBUTE = "data-frame-observation";
export const OBSERVED_BINDINGS = [
  "controls",
  "phases",
  "tracks",
  "inputFrames",
  "layerGateReads",
  "primitivePaintReads",
] as const;
export type FrameObservation = {
  version: 1;
  templateId: string;
  sequence: number;
  generation: number;
  time: number;
  scale: number;
  assetBitmapTransfers: number;
  assetEnvelopeTransfers: number;
  bindings: Record<(typeof OBSERVED_BINDINGS)[number], string[]>;
};

export function parseFrameObservation(
  source: unknown,
): FrameObservation | null {
  if (typeof source !== "string" || source.length > 3_300_000) return null;
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return null;
  }
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.templateId !== "string" ||
    value.templateId.length === 0 ||
    value.templateId.length > 512 ||
    !natural(value.sequence) ||
    value.sequence === 0 ||
    !natural(value.generation) ||
    typeof value.time !== "number" ||
    !Number.isFinite(value.time) ||
    value.time < 0 ||
    typeof value.scale !== "number" ||
    !Number.isFinite(value.scale) ||
    value.scale <= 0 ||
    value.scale > 1 ||
    !natural(value.assetBitmapTransfers) ||
    !natural(value.assetEnvelopeTransfers) ||
    !isRecord(value.bindings)
  )
    return null;
  const bindings: FrameObservation["bindings"] = {
    controls: [],
    phases: [],
    tracks: [],
    inputFrames: [],
    layerGateReads: [],
    primitivePaintReads: [],
  };
  let ids = 0;
  let characters = 0;
  for (const key of OBSERVED_BINDINGS) {
    const list: unknown = value.bindings[key];
    if (!Array.isArray(list)) return null;
    const entries: unknown[] = list;
    for (const id of entries) {
      if (typeof id !== "string" || !id || id.length > 512) return null;
      ids += 1;
      characters += id.length;
      if (ids > 50_000 || characters > 3_000_000) return null;
      bindings[key].push(id);
    }
  }
  return {
    version: 1,
    templateId: value.templateId,
    sequence: value.sequence,
    generation: value.generation,
    time: value.time,
    scale: value.scale,
    assetBitmapTransfers: value.assetBitmapTransfers,
    assetEnvelopeTransfers: value.assetEnvelopeTransfers,
    bindings,
  };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function natural(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
