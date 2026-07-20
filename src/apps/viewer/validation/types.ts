export type EditorValidationIssue = {
  category: string;
  keyframeId: string | null;
  message: string;
  messageKey?: string;
  messageParams?: Record<string, string>;
  presetId?: string;
  severity: string;
  targetId: string | null;
  targetType: string;
  trackId: string | null;
};

export type EditorValidationOptions = {
  assets?: Map<string, any>;
  isSafeLocalAssetPath?: (path: unknown) => boolean;
  isSafeSvgAssetText?: (svgText: unknown) => boolean;
  knownAssetIds?: Map<string, any> | Set<string>;
  rendererCoverage?: any;
  validatePresets?: boolean;
};
