import type { EditorTimelineSource } from "../editor/timeline-source.js";
import type { EffectLayer } from "../../../sdk/types.js";
import type { ViewerSelection } from "../timeline/model/selection-model.js";
import type {
  EditorTemplate,
  EditorTemplateSource,
} from "../templates/model.js";
export type SelectionCrumbModel = {
  type: string;
  title: string;
  meta: string;
  hint: string;
};
export interface InspectorOverviewActions {
  renderInspector(): void;
  renderEffectOverview(
    template: EditorTemplateSource,
    effectiveTemplate: EditorTemplate,
  ): void;
  renderInspectorContext(
    item: ViewerSelection,
    template: EditorTemplateSource,
  ): void;
  appendLayerSelectionOverview(
    item: Extract<ViewerSelection, { layerId: string }>,
    effectiveTemplate: EditorTemplate,
  ): void;
  appendClipSelectionOverview(
    item: Extract<ViewerSelection, { layerId: string }>,
    effectiveTemplate: EditorTemplate,
  ): void;
  renderSelectionCrumb(template?: EditorTimelineSource | null): void;
  getSelectionCrumbModel(template: EditorTemplate): SelectionCrumbModel;
  appendAssetUsageInspector(layers: readonly EffectLayer[]): void;
  isLayerSelectionInspector(template?: EditorTemplate | null): boolean;
  appendLayerMultiSelectionOverview(template: EditorTemplate): void;
  appendSvgPartPicker(layer: EffectLayer, target?: HTMLElement | null): void;
}
