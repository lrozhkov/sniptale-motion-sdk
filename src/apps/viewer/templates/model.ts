import type {
  EffectClip,
  EffectLayer,
  EffectScene,
  LocaleText,
} from "../../../sdk/types.js";
import type { EditorTimeline } from "../editor/model-types.js";

export type EditorText = LocaleText | string | null;
export type EditorPreset = Record<string, unknown> & {
  id: string;
  label: EditorText;
  controls: Record<string, unknown>;
};
export type EditorControl = Record<string, unknown> & {
  id: string;
  defaultValue: unknown;
  kind?: string;
  label?: EditorText;
  min?: number;
  max?: number;
  step?: number;
  order?: number;
  group?: string;
  options?: { value: string | number; label?: EditorText }[];
};
export type EditorTemplateMetadata = {
  assets?: string[];
  controls?: EditorControl[];
  presets?: unknown[];
  label?: EditorText;
  description?: EditorText;
  kind?: string;
  moduleId?: string;
  effectId?: string;
  category?: string;
  target?: string;
};
export type EditorTemplate = Record<string, unknown> &
  EditorTemplateMetadata & {
    id: string;
    duration: number;
    layers: EffectLayer[];
    clips: EffectClip[];
    scenes: EffectScene[];
    timeline: EditorTimeline;
  };
