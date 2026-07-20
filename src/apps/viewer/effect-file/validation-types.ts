export type NormalizeEffectFileOptions = {
  normalizePresets?: (presets: unknown) => unknown[];
  normalizeScenes?: (scenes: unknown, duration: number) => unknown[];
};

export type ValidateEffectFileOptions = NormalizeEffectFileOptions & {
  collectTemplateErrors?: (
    template: any,
    knownAssetIds: Set<string>,
  ) => string[];
  existingAssetIds?: Iterable<string>;
  isSafeSvgAssetText?: (svgText: unknown) => boolean;
};

export type EffectFileValidationResult = {
  errors: string[];
  ok: boolean;
  payload?: any;
};
