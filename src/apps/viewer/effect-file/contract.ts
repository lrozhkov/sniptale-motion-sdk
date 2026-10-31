import type { EffectFileValidationResult } from "./validation-types.js";
export interface EffectExportReadinessActions {
  sanitizeIdentifier(value: string): string;
  appendImportedLabel(label: unknown): Record<string, string>;
  assertExportable(prefix: string): boolean;
  updateExportAvailability(
    existingErrors?: readonly string[] | null,
    options?: { preserveStatus?: boolean },
  ): void;
}

export type EffectImportOptions = {
  appendImportedLabel?: boolean;
  preferOriginalId?: boolean;
  select?: boolean;
};
export type EffectImportResult = {
  errors: string[];
  ok: boolean;
  templateId: string | null;
};
export interface EffectFileActions {
  exportCurrentEffectFile(): string | null;
  importSelectedEffectFile(): Promise<void>;
  importEffectFileSource(
    source: unknown,
    sourceName?: string,
    options?: EffectImportOptions,
  ): Promise<EffectImportResult>;
  validateCurrentEffectFileSource(source: unknown): EffectFileValidationResult;
  buildCurrentEffectFile(): string;
  bootstrapLocalEffects(): Promise<boolean>;
}
export interface JsonBindingActions {
  bindTemplateSourceJson(): Promise<void>;
  validateBoundTemplateJson(parsed: unknown): boolean;
  saveBoundTemplateJson(): Promise<void>;
  exportCurrentTemplateJson(): string | null;
  createUniqueTemplateId(baseId: string): string;
  buildCurrentTemplateJson(): string;
  wireEffectFileJsonBindingActions(): void;
}
