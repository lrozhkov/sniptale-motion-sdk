import type {
  EffectV1Command,
  EffectV1Expression,
} from "../../../../sdk/effect-v1/types.js";
import {
  evaluateEffectV1Expression,
  type EffectV1EvaluationScope,
} from "./expression.js";

export type RenderState = {
  canvas: any;
  context: any;
  passes: Map<string, any>;
  runtime: any;
  scope: EffectV1EvaluationScope;
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

export function v(value: unknown, state: RenderState): any {
  return evaluateEffectV1Expression(value as EffectV1Expression, state.scope);
}

export function n(value: unknown, state: RenderState): number {
  const result = Number(v(value ?? 0, state));
  return Number.isFinite(result) ? result : 0;
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
