export const BINDING_READ_LIST_FIELDS = [
  "clips",
  "controls",
  "inputFrames",
  "layerGateReads",
  "layers",
  "primitivePaintReads",
  "phases",
  "tracks",
] as const;
export type BindingReadListField = (typeof BINDING_READ_LIST_FIELDS)[number];
export type PrimitiveBindingBounds = {
  height: number;
  layerId: string;
  width: number;
  x: number;
  y: number;
};
export type RendererBindingReads = Record<BindingReadListField, string[]> & {
  primitiveBounds: PrimitiveBindingBounds[];
};

export function createEmptyBindingReads(): RendererBindingReads {
  return {
    clips: [],
    controls: [],
    inputFrames: [],
    layerGateReads: [],
    layers: [],
    primitiveBounds: [],
    primitivePaintReads: [],
    phases: [],
    tracks: [],
  };
}

export function normalizeBindingReads(reads: unknown): RendererBindingReads {
  const safeReads = isRecord(reads) ? reads : {};
  return {
    clips: normalizeBindingReadList(safeReads.clips),
    controls: normalizeBindingReadList(safeReads.controls),
    inputFrames: normalizeBindingReadList(safeReads.inputFrames),
    layerGateReads: normalizeBindingReadList(safeReads.layerGateReads),
    layers: normalizeBindingReadList(safeReads.layers),
    primitiveBounds: normalizePrimitiveBounds(safeReads.primitiveBounds),
    primitivePaintReads: normalizeBindingReadList(
      safeReads.primitivePaintReads,
    ),
    phases: normalizeBindingReadList(safeReads.phases),
    tracks: normalizeBindingReadList(safeReads.tracks),
  };
}

export function formatBindingReadsTitle(reads: unknown): string {
  const normalized = normalizeBindingReads(reads);
  const groups: [string, string[]][] = [
    ["tracks", normalized.tracks],
    ["phases", normalized.phases],
    ["input frames", normalized.inputFrames],
    ["layer gates", normalized.layerGateReads],
    ["layers", normalized.layers],
    ["primitive paint", normalized.primitivePaintReads],
    [
      "primitive bounds",
      normalized.primitiveBounds.map((item) => item.layerId),
    ],
    ["clips", normalized.clips],
    ["controls", normalized.controls],
  ];
  const parts = groups
    .filter(([, ids]) => ids.length > 0)
    .map(([label, ids]) => `${label}: ${ids.join(", ")}`);
  return parts.length > 0
    ? `Renderer bindings\n${parts.join("\n")}`
    : "Renderer bindings: none";
}

function normalizePrimitiveBounds(value: unknown): PrimitiveBindingBounds[] {
  if (!Array.isArray(value)) return [];
  const entries: unknown[] = value;
  const bounds: PrimitiveBindingBounds[] = [];
  for (const item of entries) {
    if (!isRecord(item)) continue;
    const layerId = primitiveId(item.layerId);
    const x = primitiveNumber(item.x);
    const y = primitiveNumber(item.y);
    const width = primitiveNumber(item.width);
    const height = primitiveNumber(item.height);
    if (
      !layerId ||
      x === null ||
      y === null ||
      width === null ||
      height === null ||
      width <= 0 ||
      height <= 0
    )
      continue;
    bounds.push({ height, layerId, width, x, y });
  }
  return bounds.sort((a, b) => a.layerId.localeCompare(b.layerId));
}

function normalizeBindingReadList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const entries: unknown[] = value;
  return Array.from(new Set(entries.map(primitiveId).filter(Boolean))).sort();
}

function primitiveId(value: unknown): string {
  if (typeof value === "string") return value;
  return typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
    ? String(value)
    : "";
}

function primitiveNumber(value: unknown): number | null {
  if (
    value !== null &&
    typeof value !== "number" &&
    typeof value !== "string" &&
    typeof value !== "boolean"
  )
    return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
