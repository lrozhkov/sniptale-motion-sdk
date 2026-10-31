import type { EditorTimelineSource } from "../editor/timeline-source.js";
import type { EditorTemplate } from "../templates/model.js";
import type { EditorValidationIssue } from "../validation/types.js";

export type RendererBindingItem = {
  bound: boolean;
  id: string;
  label: string;
  sceneId: string | null;
  type: "layer" | "clip" | "phase" | "track";
};
export type RendererBindingCoverage = {
  boundCount: number;
  items: RendererBindingItem[];
  totalCount: number;
  unboundCount: number;
};
export interface InspectorHealthActions {
  renderValidationPanel(template?: EditorTimelineSource | null): void;
  groupValidationIssues(
    issues: readonly EditorValidationIssue[],
  ): [string, EditorValidationIssue[]][];
  issueTargetLabel(issue: EditorValidationIssue): string;
  focusValidationIssue(issue: EditorValidationIssue): void;
  scrollTimelineTargetIntoView(selector: string): void;
  renderRendererBindingsPanel(template?: EditorTimelineSource | null): void;
  buildRendererBindingCoverage(
    template: EditorTemplate,
  ): RendererBindingCoverage;
  focusRendererBindingItem(item: RendererBindingItem): void;
  findRendererBindingSceneId(
    template: EditorTemplate | null,
    item: RendererBindingItem,
  ): string | null;
}
