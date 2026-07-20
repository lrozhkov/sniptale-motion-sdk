import {
  normalizeClips,
  normalizeLayers,
  normalizeScenes,
  normalizeTimeline,
} from "./render-model.js";

export const PREPARED_RENDER_MODEL = Symbol("preparedRenderModel");

type PreparedRenderModel = {
  clips: any[];
  duration: number;
  layers: any[];
  scenes: any[];
  timeline: any;
};

export function createRenderModelCache() {
  let current: { id: string; prepared: PreparedRenderModel } | null = null;

  return {
    clear() {
      current = null;
    },
    resolve(message: Record<string | symbol, any>) {
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
      message.clips = current.prepared.clips;
      message.duration = current.prepared.duration;
      message.layers = current.prepared.layers;
      message.scenes = current.prepared.scenes;
      message.timeline = current.prepared.timeline;
      message[PREPARED_RENDER_MODEL] = current.prepared;
      return message;
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
  const duration = Number(value.duration);
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

function parseTimeline(value: unknown): Record<string, any> {
  if (!isRecord(value)) {
    throw new Error("Expected render model timeline to be an object.");
  }
  const phases = parseRecordArray(value.phases, "timeline phases");
  const tracks = parseRecordArray(value.tracks, "timeline tracks");
  for (const track of tracks) {
    if (track.keyframes !== undefined) {
      parseRecordArray(
        track.keyframes,
        `keyframes for track ${track.id ?? ""}`,
      );
    }
  }
  return { ...value, phases, tracks };
}

function parseRecordArray(value: unknown, field: string): any[] {
  if (!Array.isArray(value) || value.some((item) => !isRecord(item))) {
    throw new Error(`Expected ${field} to be an array of objects.`);
  }
  return value;
}

function prepareRenderModel(model: {
  clips: any[];
  duration: number;
  layers: any[];
  scenes: any[];
  timeline: any;
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

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
