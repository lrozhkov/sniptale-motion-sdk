export type TimelineAudioClip = {
  asset: Record<string, unknown>;
  duration: number;
  key: string;
  offset: number;
  start: number;
  volume: number;
};

export type AudioAssetsContext = {
  state: { assets: ReadonlyMap<string, unknown> };
};
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  if (
    value !== null &&
    typeof value !== "number" &&
    typeof value !== "string" &&
    typeof value !== "boolean"
  )
    return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isAudioLayer(layer: unknown): boolean {
  return (
    isRecord(layer) &&
    (layer?.type === "audio" ||
      layer?.kind === "audio" ||
      layer?.mediaType === "audio")
  );
}

function isAudioAsset(asset: unknown): asset is Record<string, unknown> {
  if (!isRecord(asset)) return false;
  const mimeType =
    typeof asset.mimeType === "string"
      ? asset.mimeType
      : asset.blob instanceof Blob
        ? asset.blob.type
        : "";
  return asset.kind === "audio" || mimeType.startsWith("audio/");
}

function getAudioAsset(
  ctx: AudioAssetsContext,
  layer: Record<string, unknown> | null | undefined,
  clip: Record<string, unknown>,
): unknown {
  const assetId =
    clip.assetId ?? layer?.assetId ?? layer?.audioAssetId ?? layer?.sourceId;
  return typeof assetId === "string" ? ctx.state.assets.get(assetId) : null;
}

function getClipVolume(
  layer: Record<string, unknown> | null | undefined,
  clip: Record<string, unknown>,
): number {
  const layerVolume = finiteNumber(layer?.volume, 1);
  const clipVolume = finiteNumber(clip?.volume, 1);
  return clampUnit(layerVolume * clipVolume);
}

export function collectTimelineAudioClips(
  ctx: AudioAssetsContext,
  template: unknown,
  duration: number,
): TimelineAudioClip[] {
  if (!isRecord(template)) return [];
  const layers: unknown[] = Array.isArray(template.layers)
    ? template.layers
    : [];
  const clips: unknown[] = Array.isArray(template.clips) ? template.clips : [];
  const layersById = new Map<string, Record<string, unknown>>();
  for (const layer of layers) {
    if (isRecord(layer) && typeof layer.id === "string")
      layersById.set(layer.id, layer);
  }
  const timelineClips =
    clips.length > 0
      ? clips
      : Array.from(layersById.keys(), (id) => ({
          duration,
          layerId: id,
          offset: 0,
          start: 0,
        }));
  const audioClips: TimelineAudioClip[] = [];
  for (const clip of timelineClips) {
    if (!isRecord(clip) || clip.enabled === false || clip.disabled === true) {
      continue;
    }
    const layer =
      typeof clip.layerId === "string" ? layersById.get(clip.layerId) : null;
    if (!isAudioLayer(layer) && !isAudioLayer(clip)) {
      continue;
    }
    if (layer?.visible === false || layer?.enabled === false) {
      continue;
    }
    const asset = getAudioAsset(ctx, layer, clip);
    if (!isAudioAsset(asset)) {
      continue;
    }
    const start = Math.max(0, finiteNumber(clip.start ?? layer?.start, 0));
    const clipDuration = Math.max(
      0,
      finiteNumber(clip.duration ?? layer?.duration, duration - start),
    );
    if (start >= duration || clipDuration <= 0) {
      continue;
    }
    const layerId =
      typeof clip.layerId === "string"
        ? clip.layerId
        : typeof layer?.id === "string"
          ? layer.id
          : "audio";
    const assetId = typeof asset.id === "string" ? asset.id : "asset";
    const offset = Math.max(0, finiteNumber(clip.offset ?? layer?.offset, 0));
    audioClips.push({
      asset,
      duration: Math.min(clipDuration, duration - start),
      key: `${layerId}:${assetId}:${start}:${offset}`,
      offset,
      start,
      volume: getClipVolume(layer, clip),
    });
  }
  return audioClips;
}
