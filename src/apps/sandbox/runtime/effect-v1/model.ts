import type { RuntimeCanvas } from "../canvas-model.js";
import type { BindingReads } from "../binding-reads.js";
import type { EffectV1Command } from "../../../../sdk/effect-v1/types.js";
import {
  evaluateEffectV1Expression,
  effectV1Number,
  type EffectV1EvaluationScope,
  type EffectV1EvaluationContext,
} from "./expression.js";

type EffectV1RenderContext = EffectV1EvaluationContext & {
  width: number;
  height: number;
  createCanvas(width: number, height: number): RuntimeCanvas;
  __bindingReads?: BindingReads | null;
};
export type RenderState = {
  canvas: any;
  context: any;
  passes: Map<string, any>;
  runtime: any;
  scope: Omit<EffectV1EvaluationScope, "context"> & {
    context: EffectV1RenderContext;
  };
};

export function resolveCommandLayer(
  command: EffectV1Command,
  state: RenderState,
): any {
  return command.layerId
    ? state.scope.context.resolveLayer(String(command.layerId))
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

export function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
