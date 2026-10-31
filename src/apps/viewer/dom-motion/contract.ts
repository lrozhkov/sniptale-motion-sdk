import type { EditorTemplateSource } from "../templates/model.js";
import type { EffectImportResult } from "../effect-file/contract.js";

export interface DomMotionActions {
  disposeDomMotionSurface(): void;
  bootstrapDomMotion(): Promise<boolean>;
  prepareDomMotionTemplate(
    template: EditorTemplateSource | null,
  ): Promise<boolean>;
  renderDomMotionFrame(): Promise<void>;
  importDomMotionSource(
    value: unknown,
    select?: boolean,
  ): Promise<EffectImportResult>;
  exportDomMotionSource(): string | null;
}
