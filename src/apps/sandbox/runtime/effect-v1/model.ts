import type { createSandboxRuntimeFacade } from "../runtime-facade.js";
import type { RuntimeResolvedLayer } from "../render-resolver.js";
import type { RuntimeCanvas, RuntimeCanvasContext } from "../canvas-model.js";
import type { BindingReads } from "../binding-reads.js";
import type { EffectV1Command } from "../../../../sdk/effect-v1/types.js";
import {
  evaluateEffectV1Expression,
  effectV1Number,
  type EffectV1EvaluationScope,
  type EffectV1EvaluationContext,
} from "./expression.js";

export type EffectV1Layer = Pick<
  RuntimeResolvedLayer,
  "active" | "opacity" | "x" | "y"
>;

export interface EffectV1RenderContext extends EffectV1EvaluationContext {
  resolveLayer(id: string): EffectV1Layer | null;
  width: number;
  height: number;
  createCanvas(width: number, height: number): RuntimeCanvas;
  __bindingReads?: BindingReads | null;
}
export type RenderState = {
  canvas: RuntimeCanvas;
  context: RuntimeCanvasContext;
  passes: Map<
    string,
    { canvas: RuntimeCanvas; bindingReads: BindingReads | null }
  >;
  runtime: Partial<
    Pick<
      ReturnType<typeof createSandboxRuntimeFacade>,
      "drawImageAsset" | "drawSvgVectorAsset" | "svgPartTransform"
    >
  >;
  scope: Omit<EffectV1EvaluationScope, "context"> & {
    context: EffectV1RenderContext;
  };
};

export function resolveCommandLayer(
  command: EffectV1Command,
  state: RenderState,
): EffectV1Layer | null {
  return command.layerId
    ? state.scope.context.resolveLayer(command.layerId)
    : null;
}

export function withItem<T>(
  state: RenderState,
  item: unknown,
  read: () => T,
): T {
  const previous = state.scope.item;
  state.scope.item = item;
  try {
    return read();
  } finally {
    state.scope.item = previous;
  }
}

export function v(value: unknown, state: RenderState): unknown {
  return evaluateEffectV1Expression(value, state.scope);
}

export function n(value: unknown, state: RenderState): number {
  return effectV1Number(v(value ?? 0, state));
}

export function valueOr(
  value: unknown,
  fallback: number,
  state: RenderState,
): number {
  return value === undefined ? fallback : n(value, state);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
