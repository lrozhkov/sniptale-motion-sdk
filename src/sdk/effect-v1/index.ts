export { createEffectV1Diagnostics } from "./diagnostics.js";
export {
  assertEffectV1AssetSignature,
  decodeEffectV1EmbeddedAsset,
  sha256EffectV1Bytes,
} from "./asset-integrity.js";
export { resolveEffectV1InputContract } from "./input-contract.js";
export { resolveEffectV1ObjectLayout } from "./object-layout.js";
export {
  resolveEffectV1ObjectRenderBounds,
  mapEffectV1ScenePoint,
  mapEffectV1ObjectPoint,
} from "./object-handles.js";
export { normalizeEffectV1ToTemplate } from "./normalization.js";
export { EFFECT_V1_JSON_SCHEMA } from "./schema.js";
export { parseEffectV1Source, validateEffectV1Document } from "./validation.js";
export {
  EFFECT_V1_COMMAND_OPS,
  EFFECT_V1_EXPRESSION_OPS,
  EFFECT_V1_KINDS,
  EFFECT_V1_SCHEMA,
} from "./types.js";
export type {
  EffectV1Asset,
  EffectV1Command,
  EffectV1CommandOp,
  EffectV1Diagnostic,
  EffectV1Document,
  EffectV1Expression,
  EffectV1ExpressionOp,
  EffectV1GraphProgram,
  EffectV1InputContract,
  EffectV1Kind,
  EffectV1ObjectLayout,
  EffectV1ObjectHandle,
  EffectV1Program,
  EffectV1RuntimeInputName,
  EffectV1ValidationResult,
} from "./types.js";

export {
  resolveEffectV1LocaleText,
  resolveEffectV1ControlDefault,
} from "./locale-text.js";

export {
  applyEffectV1ControlPreset,
  applyEffectV1ControlPresetValues,
  validateEffectV1ControlPresetValues,
} from "./control-presets.js";

export {
  resolveEffectV1EditorRegion,
  updateEffectV1EditorRegion,
} from "./editor-region.js";
export type { EffectV1RegionRect } from "./editor-region.js";

export type { EffectV1EditorRegion } from "./types.js";
