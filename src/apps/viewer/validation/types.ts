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
  assets?: ReadonlyMap<string, unknown>;
  isSafeLocalAssetPath?: (path: unknown) => boolean;
  isSafeSvgAssetText?: (svgText: unknown) => boolean;
  knownAssetIds?: KnownValidationAssets;
  rendererCoverage?: unknown;
  validatePresets?: boolean;
};

export type KnownValidationAssets =
  | ReadonlyMap<string, unknown>
  | ReadonlySet<string>;
export type ValidationIssueTarget = Partial<
  Omit<EditorValidationIssue, "message">
>;
export type AddValidationIssue = (
  message: string,
  target?: ValidationIssueTarget,
) => void;
