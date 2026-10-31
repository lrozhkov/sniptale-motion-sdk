import type { EffectV1Document } from "../../../sdk/effect-v1/index.js";
export type NormalizeEffectFileOptions = {
  normalizePresets?: (presets: unknown) => unknown[];
  normalizeScenes?: (scenes: unknown, duration: number) => unknown[];
};

export type ValidateEffectFileOptions = NormalizeEffectFileOptions & {
  collectTemplateErrors?: (
    template: unknown,
    knownAssetIds: Set<string>,
  ) => string[];
  existingAssetIds?: Iterable<string>;
  isSafeSvgAssetText?: (svgText: unknown) => boolean;
};

export type EffectFileValidationResult = {
  errors: string[];
  ok: boolean;
  payload?: EffectV1Document | undefined;
};
