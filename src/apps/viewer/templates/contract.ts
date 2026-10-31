import type { EditorTemplateMetadata } from "./model.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";
import type {
  EffectLayer,
  EffectClip,
  EffectScene,
  TimelinePhase,
} from "../../../sdk/types.js";
import type { TimelineScene } from "../timeline/model/row-tree-model.js";
import type { EditorTimeline } from "../editor/model-types.js";
import type { ViewerDrawingContext } from "../rendering/output-contract.js";
import type {
  EditorTemplate,
  EditorPreset,
  EditorTemplateSource,
} from "./model.js";

export type CapturedEditorPreset = EditorPreset &
  Pick<EditorTemplate, "clips" | "duration" | "layers" | "scenes" | "timeline">;
export type TemplatePresentationSource = EditorTimelineSource &
  Pick<EditorTemplateMetadata, "label"> & { duration?: number };

export interface TemplateModelActions {
  updateTemplateContext(template?: TemplatePresentationSource | null): void;
  getEffectiveTemplate(template?: unknown): EditorTemplate | null;
  createPresetFromTemplate(
    template: EditorTemplate,
    id: string,
  ): CapturedEditorPreset;
  drawBaseForTemplate(
    context: ViewerDrawingContext,
    template: EditorTemplateSource,
    progress: number,
  ): void;
}

export interface TemplateFallbackActions {
  createFallbackLayers(template: unknown): EffectLayer[];
  createFallbackClips(template: unknown): EffectClip[];
  createFallbackScenes(template: unknown): EffectScene[];
  createFallbackTimeline(template: unknown): EditorTimeline;
  normalizeScenes(scenes: unknown, duration?: number): TimelineScene[];
  findTemplateScene(
    template: unknown,
    sceneId: string | null | undefined,
  ): TimelineScene | null;
  findTemplatePhase(
    template: unknown,
    phaseId: string | null | undefined,
  ): TimelinePhase | null;
  getRendererType(template: unknown): "dom" | "composition" | "effect";
}

export interface TemplateSelectionActions {
  bootstrap(): Promise<void>;
  populateTemplates(templates: readonly EditorTemplateSource[]): void;
  selectTemplate(
    templateId: string,
    options?: {
      canSelect?: () => boolean;
      beforeReset?: () => void;
      restoreDraft?: boolean;
    },
  ): Promise<boolean>;
  selectInitialTemplateWhenReady(): Promise<void>;
}

export interface TemplateComboboxActions {
  setTemplateComboboxOpen(open: boolean): void;
  syncTemplateCombobox(): void;
  wireTemplateCombobox(): void;
}

export interface WorkspaceViewActions {
  captureCompositionWorkspaceView(): void;
  restoreCompositionWorkspaceView(
    template?: EditorTimelineSource | null,
  ): boolean;
}
