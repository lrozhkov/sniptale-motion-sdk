export const PROTOCOL_VERSION = "sniptale-effects-prototype-1";

export const MessageKind = Object.freeze({
  DISPOSE: "dispose",
  LOAD_EFFECT_DOCUMENT: "loadEffectDocument",
  LOAD_EFFECT_DOCUMENT_RESULT: "loadEffectDocumentResult",
  VALIDATE_EFFECT_DOCUMENT: "validateEffectDocument",
  VALIDATE_EFFECT_DOCUMENT_RESULT: "validateEffectDocumentResult",
  RENDER_FRAME: "renderFrame",
  RENDER_FRAME_PROGRESS: "renderFrameProgress",
  RENDER_FRAME_RESULT: "renderFrameResult",
  RUNTIME_READY: "runtimeReady",
});

export const EffectKind = Object.freeze({
  LAYER: "layerEffect",
  OVERLAY: "overlay",
  SCENE: "sceneEffect",
  TRANSITION: "transitionEffect",
});

export const ArtifactType = Object.freeze({
  ANIMATION: "animation",
  TRANSITION: "transition",
});

export const TARGET_ENGINE_VERSION = "2.0-prototype";

export const DEFAULT_RENDER_TIMEOUT_MS = 900;
export const DEFAULT_LOAD_TIMEOUT_MS = 1400;
export const MAX_MODULE_BYTES = 260_000;
export const MAX_ASSET_BYTES = 1_500_000;
export const MAX_RENDER_PIXELS = 3840 * 2160;

export function createRequestId(prefix) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}:${Date.now().toString(36)}:${random}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function easeOutCubic(t) {
  const p = clamp(t, 0, 1);
  return 1 - Math.pow(1 - p, 3);
}

export function easeInOutCubic(t) {
  const p = clamp(t, 0, 1);
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

export function readControlValue(controls, id, fallback) {
  const value = controls?.[id];
  return value === undefined || value === null || value === ""
    ? fallback
    : value;
}
