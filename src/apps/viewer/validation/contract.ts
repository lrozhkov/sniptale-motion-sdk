import type { EditorTimelineSource } from "../editor/timeline-source.js";
import type {
  EditorValidationIssue,
  EditorValidationOptions,
  KnownValidationAssets,
  ValidationIssueTarget,
} from "./types.js";
export type EditorValidationContextOptions = EditorValidationOptions & {
  targetTemplate?: unknown;
};
export interface EditorValidationActions {
  collectEditorValidationErrors(
    template: unknown,
    knownAssetIds?: KnownValidationAssets,
    options?: EditorValidationOptions,
  ): string[];
  collectEditorValidationIssues(
    template: unknown,
    knownAssetIds?: KnownValidationAssets,
    options?: EditorValidationOptions,
  ): EditorValidationIssue[];
  createEditorValidationOptions(
    knownAssetIds?: KnownValidationAssets,
    options?: EditorValidationContextOptions,
  ): EditorValidationOptions;
  isRendererContractCoveragePending(
    template?: EditorTimelineSource | null,
  ): boolean;
  createValidationIssue(
    message: string,
    target?: ValidationIssueTarget,
  ): EditorValidationIssue;
  categorizeValidationIssue(
    issue: { message?: string; targetType?: string } | null | undefined,
  ): string;
  toTitleLabel(value: string): string;
}
