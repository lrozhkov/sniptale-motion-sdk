import type {
  ControlDefinition,
  EffectClip,
  EffectLayer,
  EffectScene,
  EffectTimeline,
  LocaleText,
} from "../types.js";

export const EFFECT_V1_SCHEMA = "sniptale.effect.v1" as const;
export const EFFECT_V1_KINDS = [
  "standalone",
  "targetEffect",
  "transition",
] as const;
export const EFFECT_V1_COMMAND_OPS = [
  "clear",
  "clip",
  "compositePass",
  "fillRect",
  "forEach",
  "forGrid",
  "forRange",
  "group",
  "image",
  "let",
  "path",
  "polyline",
  "renderPass",
  "sampledPath",
  "shape",
  "stableOrderBy",
  "svgParts",
  "text",
  "when",
] as const;
export const EFFECT_V1_EXPRESSION_OPS = [
  "abs",
  "add",
  "and",
  "clamp",
  "concat",
  "cos",
  "cubicPoint",
  "cubicTangent",
  "div",
  "ellipsePoint",
  "ellipseVelocity",
  "eq",
  "exp",
  "fallback",
  "floor",
  "gt",
  "gte",
  "inOut",
  "lt",
  "lte",
  "max",
  "min",
  "mix",
  "mod",
  "mul",
  "neg",
  "not",
  "or",
  "out",
  "point",
  "pow",
  "read",
  "rgba",
  "select",
  "sin",
  "sqrt",
  "sub",
] as const;

export type EffectV1Kind = (typeof EFFECT_V1_KINDS)[number];
export type EffectV1CommandOp = (typeof EFFECT_V1_COMMAND_OPS)[number];
export type EffectV1ExpressionOp = (typeof EFFECT_V1_EXPRESSION_OPS)[number];
export type EffectV1RuntimeInputName = "source" | "from" | "to";

export type EffectV1Asset = {
  byteLength?: number;
  dataUrl?: string;
  duration?: number;
  height?: number;
  id: string;
  kind: "audio" | "image" | "svg";
  mimeType: string;
  path?: string;
  sha256?: string;
  svgText?: string;
  width?: number;
};

export type EffectV1Expression =
  | boolean
  | number
  | string
  | null
  | {
      args?: EffectV1Expression[];
      fallback?: EffectV1Expression;
      op: EffectV1ExpressionOp;
      path?: string;
      value?: EffectV1Expression;
      values?: EffectV1Expression[];
    };

type ExpressionValue = EffectV1Expression;
type PointValue = { x: ExpressionValue; y: ExpressionValue };
export type EffectV1PathSegment =
  | { kind: "moveTo" | "lineTo"; x: ExpressionValue; y: ExpressionValue }
  | {
      cpx: ExpressionValue;
      cpy: ExpressionValue;
      kind: "quadraticTo";
      x: ExpressionValue;
      y: ExpressionValue;
    }
  | {
      cp1x: ExpressionValue;
      cp1y: ExpressionValue;
      cp2x: ExpressionValue;
      cp2y: ExpressionValue;
      kind: "cubicTo";
      x: ExpressionValue;
      y: ExpressionValue;
    }
  | {
      centerX: ExpressionValue;
      centerY: ExpressionValue;
      counterclockwise?: boolean;
      end: ExpressionValue;
      kind: "arc";
      radius: ExpressionValue;
      start: ExpressionValue;
    }
  | {
      centerX: ExpressionValue;
      centerY: ExpressionValue;
      counterclockwise?: boolean;
      end: ExpressionValue;
      kind: "ellipse";
      radiusX: ExpressionValue;
      radiusY: ExpressionValue;
      rotation: ExpressionValue;
      start: ExpressionValue;
    }
  | {
      height: ExpressionValue;
      kind: "rect";
      width: ExpressionValue;
      x: ExpressionValue;
      y: ExpressionValue;
    }
  | {
      height: ExpressionValue;
      kind: "roundRect";
      radius: ExpressionValue;
      width: ExpressionValue;
      x: ExpressionValue;
      y: ExpressionValue;
    };
type CommandBase = { layerId?: string };
type StyledCommand = CommandBase & {
  alpha?: ExpressionValue;
  blend?: "lighter" | "screen" | "source-over";
  filter?: EffectV1Filter;
  shadow?: EffectV1Shadow;
};
type ChildCommands = { commands: EffectV1Command[] };

export type EffectV1Paint =
  | ExpressionValue
  | {
      kind: "linearGradient";
      stops: Array<{ color: ExpressionValue; offset: ExpressionValue }>;
      x0: ExpressionValue;
      x1: ExpressionValue;
      y0: ExpressionValue;
      y1: ExpressionValue;
    }
  | {
      kind: "radialGradient";
      r0: ExpressionValue;
      r1: ExpressionValue;
      stops: Array<{ color: ExpressionValue; offset: ExpressionValue }>;
      x0: ExpressionValue;
      x1: ExpressionValue;
      y0: ExpressionValue;
      y1: ExpressionValue;
    };

export type EffectV1SvgPartTransform =
  | {
      angle?: ExpressionValue;
      blur?: ExpressionValue;
      ease?: "inOut" | "linear" | "out";
      kind: "preset";
      mode?: "assemble" | "scatter" | "shatter";
      order?: "center" | "document" | "edges" | "random" | "reverse";
      reveal?: ExpressionValue;
      rotate?: ExpressionValue;
      scaleFrom?: ExpressionValue;
      spread?: ExpressionValue;
      stagger?: ExpressionValue;
    }
  | {
      alpha?: ExpressionValue;
      blur?: ExpressionValue;
      kind: "custom";
      originX?: ExpressionValue;
      originY?: ExpressionValue;
      rotate?: ExpressionValue;
      scale?: ExpressionValue;
      x?: ExpressionValue;
      y?: ExpressionValue;
    };

export type EffectV1Command =
  | (CommandBase & { color?: EffectV1Paint; op: "clear" })
  | (CommandBase &
      ChildCommands & {
        height: ExpressionValue;
        op: "clip";
        width: ExpressionValue;
        x: ExpressionValue;
        y: ExpressionValue;
      })
  | (StyledCommand & {
      fill: EffectV1Paint;
      height: ExpressionValue;
      op: "fillRect";
      width: ExpressionValue;
      x: ExpressionValue;
      y: ExpressionValue;
    })
  | (CommandBase &
      ChildCommands & {
        itemVar?: string;
        items: unknown[];
        op: "forEach";
      })
  | (CommandBase &
      ChildCommands & {
        columns: number;
        columnVar?: string;
        op: "forGrid";
        rows: number;
        rowVar?: string;
      })
  | (CommandBase &
      ChildCommands & {
        count: number;
        indexVar?: string;
        op: "forRange";
      })
  | (StyledCommand &
      ChildCommands & {
        filter?: EffectV1Filter;
        op: "group";
        rotation?: ExpressionValue;
        scaleX?: ExpressionValue;
        scaleY?: ExpressionValue;
        shadow?: EffectV1Shadow;
        x?: ExpressionValue;
        y?: ExpressionValue;
      })
  | (StyledCommand & {
      assetId?: string;
      fit?: "contain" | "cover" | "fill";
      height: ExpressionValue;
      input?: EffectV1RuntimeInputName;
      op: "image";
      rotation?: ExpressionValue;
      width: ExpressionValue;
      x: ExpressionValue;
      y: ExpressionValue;
    })
  | (CommandBase &
      ChildCommands & {
        bindings: Record<string, EffectV1Expression>;
        op: "let";
      })
  | (StyledCommand & {
      closed?: boolean;
      fill?: EffectV1Paint;
      lineCap?: CanvasLineCap;
      lineJoin?: CanvasLineJoin;
      lineWidth?: ExpressionValue;
      op: "path";
      points?: PointValue[];
      segments?: EffectV1PathSegment[];
      stroke?: EffectV1Paint;
    })
  | (StyledCommand & {
      lineCap?: CanvasLineCap;
      lineJoin?: CanvasLineJoin;
      lineWidth?: ExpressionValue;
      op: "polyline";
      points: PointValue[];
      progress?: ExpressionValue;
      stroke: EffectV1Paint;
    })
  | (CommandBase &
      ChildCommands & {
        height?: ExpressionValue;
        id: string;
        op: "renderPass";
        width?: ExpressionValue;
      })
  | (StyledCommand & {
      from: ExpressionValue;
      lineCap?: CanvasLineCap;
      lineJoin?: CanvasLineJoin;
      lineWidth?: ExpressionValue;
      op: "sampledPath";
      sampleVar?: string;
      samples: number;
      stroke: EffectV1Paint;
      to: ExpressionValue;
      x: ExpressionValue;
      y: ExpressionValue;
    })
  | (StyledCommand & {
      filter?: EffectV1Filter;
      height?: ExpressionValue;
      op: "compositePass";
      passId: string;
      rotation?: ExpressionValue;
      width?: ExpressionValue;
      x?: ExpressionValue;
      y?: ExpressionValue;
    })
  | (StyledCommand & {
      fill?: EffectV1Paint;
      height: ExpressionValue;
      lineWidth?: ExpressionValue;
      op: "shape";
      radius?: ExpressionValue;
      rotation?: ExpressionValue;
      shape: "circle" | "diamond" | "ellipse" | "rect" | "roundRect";
      stroke?: EffectV1Paint;
      width: ExpressionValue;
      x: ExpressionValue;
      y: ExpressionValue;
    })
  | (CommandBase &
      ChildCommands & {
        direction?: "asc" | "desc";
        itemVar?: string;
        items: unknown[];
        key: EffectV1Expression;
        op: "stableOrderBy";
      })
  | (StyledCommand & {
      assetId: string;
      filter?: EffectV1Filter;
      height: ExpressionValue;
      op: "svgParts";
      part?: EffectV1SvgPartTransform;
      width: ExpressionValue;
      x: ExpressionValue;
      y: ExpressionValue;
    })
  | (StyledCommand & {
      align?: CanvasTextAlign;
      baseline?: CanvasTextBaseline;
      caret?: boolean;
      fill?: EffectV1Paint;
      fontFamily?: ExpressionValue;
      fontSize?: ExpressionValue;
      fontStyle?: "italic" | "normal" | "oblique";
      fontWeight?: ExpressionValue;
      maxWidth?: ExpressionValue;
      op: "text";
      reveal?: ExpressionValue;
      text: ExpressionValue;
      x: ExpressionValue;
      y: ExpressionValue;
    })
  | (CommandBase &
      ChildCommands & { condition: EffectV1Expression; op: "when" });

export type EffectV1Filter = {
  blur?: ExpressionValue;
  brightness?: ExpressionValue;
  saturate?: ExpressionValue;
};

export type EffectV1Shadow = {
  blur?: ExpressionValue;
  color?: ExpressionValue;
  x?: ExpressionValue;
  y?: ExpressionValue;
};
export type EffectV1GraphProgram = {
  commands: EffectV1Command[];
  definitions?: Record<string, EffectV1Expression>;
  kind: "graph";
  version: 1;
};

export type EffectV1Program = EffectV1GraphProgram;

export type EffectV1Document = {
  assets: EffectV1Asset[];
  clips: EffectClip[];
  controls: ControlDefinition[];
  description?: LocaleText;
  duration: number;
  id: string;
  kind: EffectV1Kind;
  label: LocaleText;
  layers: EffectLayer[];
  presets?: unknown[];
  program: EffectV1Program;
  scenes: EffectScene[];
  schemaVersion: typeof EFFECT_V1_SCHEMA;
  timeline: EffectTimeline;
};

export type EffectV1Diagnostic = {
  code: string;
  message: string;
  path: string;
  severity: "error" | "warning";
  suggestion?: string;
};

export type EffectV1ValidationResult = {
  diagnostics: EffectV1Diagnostic[];
  document?: EffectV1Document;
  ok: boolean;
  summary: { errors: number; warnings: number };
};

export type EffectV1InputContract = {
  optional: readonly EffectV1RuntimeInputName[];
  required: readonly EffectV1RuntimeInputName[];
};
