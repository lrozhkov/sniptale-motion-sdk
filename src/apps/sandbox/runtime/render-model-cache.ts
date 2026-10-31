import {
  normalizeClips,
  normalizeLayers,
  normalizeScenes,
  normalizeTimeline,
} from "./render-model.js";

export const PREPARED_RENDER_MODEL = Symbol("preparedRenderModel");

export type PreparedRenderModel = {
  clips: ReturnType<typeof normalizeClips>;
  duration: number;
  layers: ReturnType<typeof normalizeLayers>;
  scenes: ReturnType<typeof normalizeScenes>;
  timeline: ReturnType<typeof normalizeTimeline>;
};

export function createRenderModelCache() {
  let current: { id: string; prepared: PreparedRenderModel } | null = null;

  return {
    clear() {
      current = null;
    },
    resolve(
      message: Record<string | symbol, unknown>,
    ): Record<string | symbol, unknown> {
      if (message.renderModelId === undefined) {
        return message;
      }
      const id = parseRenderModelId(message.renderModelId);
      if (message.renderModel !== undefined) {
        current = {
          id,
          prepared: prepareRenderModel(parseRenderModel(message.renderModel)),
        };
      }
      if (!current || current.id !== id) {
        throw new Error(`Missing cached render model ${id}.`);
      }
      return Object.assign(message, {
        clips: current.prepared.clips,
        duration: current.prepared.duration,
        layers: current.prepared.layers,
        scenes: current.prepared.scenes,
        timeline: current.prepared.timeline,
        [PREPARED_RENDER_MODEL]: current.prepared,
      });
    },
  };
}

function parseRenderModelId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) {
    throw new Error("Expected a valid render model id.");
  }
  return value;
}

function parseRenderModel(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("Expected render model to be an object.");
  }
  const duration = typeof value.duration === "number" ? value.duration : NaN;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Expected render model duration to be positive.");
  }
  const timeline = parseTimeline(value.timeline);
  return {
    clips: parseRecordArray(value.clips, "clips"),
    duration,
    layers: parseRecordArray(value.layers, "layers"),
    scenes: parseRecordArray(value.scenes, "scenes"),
    timeline,
  };
}

function parseTimeline(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("Expected render model timeline to be an object.");
  }
  const phases = parseRecordArray(value.phases, "timeline phases");
  const tracks = parseRecordArray(value.tracks, "timeline tracks");
  for (const track of tracks) {
    if (track.keyframes !== undefined) {
      parseRecordArray(
        track.keyframes,
        `keyframes for track ${typeof track.id === "string" ? track.id : "(invalid)"}`,
      );
    }
  }
  return { ...value, phases, tracks };
}

function parseRecordArray(
  value: unknown,
  field: string,
): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error(`Expected ${field} to be an array of objects.`);
  }
  return value;
}

function prepareRenderModel(model: {
  clips: Record<string, unknown>[];
  duration: number;
  layers: Record<string, unknown>[];
  scenes: Record<string, unknown>[];
  timeline: Record<string, unknown>;
}): PreparedRenderModel {
  const scenes = normalizeScenes(model.scenes, model.duration);
  return {
    clips: normalizeClips(model.clips, model.duration),
    duration: model.duration,
    layers: normalizeLayers(model.layers),
    scenes,
    timeline: normalizeTimeline(model.timeline, model.duration, scenes),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
