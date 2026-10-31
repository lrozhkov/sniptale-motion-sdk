import type { EditorTemplateSource } from "../templates/model.js";
import type { RendererBindingReads } from "../app/binding-reads.js";
export interface RendererContractCoverageActions {
  mergeRendererContractReads(templateId: string, reads: unknown): void;
  createRendererContractSampleTimes(
    template?: EditorTemplateSource | null,
  ): number[];
  refreshRendererContractCoverage(
    template?: EditorTemplateSource | null,
  ): Promise<RendererBindingReads>;
}
