import type { EffectLayer } from "../../../sdk/types.js";
import type {
  InspectorLayerField,
  InspectorNumberField,
} from "./field-model.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";

export interface InspectorMotionPathActions {
  appendMotionPathPointInspector(
    template: EditorTimelineSource | null | undefined,
  ): boolean;
}

export interface InspectorPropertyActions {
  getLayerContentFields(
    layer: Pick<EffectLayer, "type">,
  ): InspectorLayerField[];
  createInspectorLayerField(
    layer: EffectLayer,
    field: InspectorLayerField,
  ): HTMLElement;
  appendInspectorLayerField(
    layer: EffectLayer,
    field: InspectorLayerField,
    target?: HTMLElement | null,
  ): HTMLElement;
  createInspectorNumberField(
    layer: EffectLayer,
    field: InspectorNumberField,
  ): HTMLLabelElement;
  appendInspectorNumberField(
    layer: EffectLayer,
    field: InspectorNumberField,
    target?: HTMLElement | null,
  ): HTMLLabelElement;
  roundInspectorNumber(value: unknown): number;
  syncInspectorLayerPropertyState(
    layerId: string,
    properties: Readonly<Record<string, unknown>>,
  ): void;
  appendLayerPropertiesInspector(layer: EffectLayer): void;
}
