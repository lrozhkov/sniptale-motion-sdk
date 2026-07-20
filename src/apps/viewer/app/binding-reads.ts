export function createEmptyBindingReads() {
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

export function normalizeBindingReads(reads: any) {
  const safeReads = reads && typeof reads === "object" ? reads : {};
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

export function formatBindingReadsTitle(reads: any) {
  const normalized = normalizeBindingReads(reads);
  const parts = [
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
  ]
    .filter(([, ids]) => ids.length > 0)
    .map(([label, ids]) => `${label}: ${(ids as any[]).join(", ")}`);
  return parts.length > 0
    ? `Renderer bindings\n${(parts as any[]).join("\n")}`
    : "Renderer bindings: none";
}

function normalizePrimitiveBounds(value: any) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => ({
      height: Number(item?.height),
      layerId: String(item?.layerId ?? ""),
      width: Number(item?.width),
      x: Number(item?.x),
      y: Number(item?.y),
    }))
    .filter(
      (item) =>
        item.layerId &&
        Number.isFinite(item.x) &&
        Number.isFinite(item.y) &&
        Number.isFinite(item.width) &&
        Number.isFinite(item.height) &&
        item.width > 0 &&
        item.height > 0,
    )
    .sort((a, b) => a.layerId.localeCompare(b.layerId));
}

function normalizeBindingReadList(value: any) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(value.map((item) => String(item)).filter(Boolean)),
  ).sort();
}
