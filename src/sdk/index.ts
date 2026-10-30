export const EFFECT_FILE_SCHEMA = "sniptale.effect.v1";
export const ENGINE_VERSION = "2.0-prototype";
export const PROTOCOL_VERSION = "sniptale-effects-prototype-1";
export { ArtifactType } from "./protocol";

export type {
  ControlDefinition,
  EffectControlPreset,
  EffectArtifactType,
  EffectClip,
  EffectDefinition,
  EffectLayer,
  EffectLayerGroup,
  EffectLayerEditorCanvasMode,
  EffectLayerEditorDefinition,
  EffectLayerEditorOperation,
  EffectLayerEditorTransformProperty,
  EffectRenderer,
  EffectScene,
  EffectTimeline,
  LocaleText,
  RenderFrameContext,
  TimelineKeyframe,
  TimelinePhase,
  TimelineTrack,
} from "./types";
export * from "./effect-v1/index.js";

export * from "./dom-motion/index.js";
