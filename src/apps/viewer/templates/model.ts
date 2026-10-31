import type {
  EffectClip,
  EffectLayer,
  EffectScene,
  LocaleText,
} from "../../../sdk/types.js";
import type { EditorTimeline } from "../editor/model-types.js";
import type {
  EffectV1ControlUnit,
  EffectV1ControlPresentation,
  EffectV1ControlIcon,
  EffectV1ControlGroup,
} from "../../../sdk/effect-v1/control-presentation-model.js";

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
  unit?: EffectV1ControlUnit;
  presentation?: EffectV1ControlPresentation;
  icon?: EffectV1ControlIcon;
  options?: {
    value: string | number;
    label?: EditorText;
    icon?: EffectV1ControlIcon;
  }[];
};
export type EditorTemplateMetadata = {
  default?: boolean;
  assets?: string[];
  controls?: EditorControl[];
  controlGroups?: EffectV1ControlGroup[];
  presets?: unknown[];
  label?: EditorText;
  description?: EditorText;
  kind?: string;
  moduleId?: string;
  effectId?: string;
  category?: string;
  target?: string;
};
export type EditorTemplateSource = Record<string, unknown> &
  EditorTemplateMetadata & {
    id: string;
    duration: number;
    layers?: EffectLayer[];
    clips?: EffectClip[];
    scenes?: EffectScene[];
    timeline?: unknown;
  };

export type EditorTemplate = EditorTemplateSource & {
  layers: EffectLayer[];
  clips: EffectClip[];
  scenes: EffectScene[];
  timeline: EditorTimeline;
};
