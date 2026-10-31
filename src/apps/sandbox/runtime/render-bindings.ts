import type { BindingReads } from "./binding-reads.js";

type BindingContext = {
  __bindingReads: BindingReads | null;
  controls: Readonly<Record<string, unknown>>;
  time: number;
  track(id: string, fallback: unknown, at: number): unknown;
  phaseProgress(id: string, at: number): number;
};

import { recordBindingRead } from "./binding-reads.js";
import { ease } from "./math.js";

export function resolveBindings(
  ctx: BindingContext,
  definitions: unknown,
  at: number,
): Record<string, unknown> {
  return resolveBindingObject(ctx, definitions, at);
}

export function resolveBindingObject(
  ctx: BindingContext,
  definitions: unknown,
  at: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, definition] of Object.entries(
    isRecord(definitions) ? definitions : {},
  )) {
    result[key] = resolveBindingValue(ctx, definition, 0, at);
  }
  return result;
}

export function resolveBindingValue(
  ctx: BindingContext,
  definition: unknown,
  fallback: unknown = 0,
  at = ctx.time,
): unknown {
  if (typeof definition === "string") {
    return ctx.track(definition, fallback, at);
  }
  if (!isRecord(definition)) {
    return definition ?? fallback;
  }
  const baseFallback =
    definition.fallback ??
    definition.defaultValue ??
    definition.value ??
    fallback;
  let value = baseFallback;
  if (typeof definition.track === "string" && definition.track) {
    value = ctx.track(definition.track, baseFallback, at);
  } else if (typeof definition.control === "string" && definition.control) {
    recordBindingRead(ctx.__bindingReads, "controls", definition.control);
    value = ctx.controls?.[definition.control] ?? baseFallback;
  }
  if (typeof definition.phase === "string" && definition.phase) {
    value = multiplyBindingValue(
      value,
      ease(
        typeof definition.ease === "string" ? definition.ease : "linear",
        ctx.phaseProgress(definition.phase, at),
      ),
    );
  }
  if (definition.multiplier != null) {
    value = multiplyBindingValue(
      value,
      readNumericModifier(definition.multiplier),
    );
  }
  if (definition.offset != null) {
    value = addBindingValue(value, readNumericModifier(definition.offset));
  }
  return value;
}

function multiplyBindingValue(value: unknown, multiplier: number): unknown {
  if (typeof value === "number") {
    return value * multiplier;
  }
  if (Array.isArray(value)) {
    const entries: unknown[] = value;
    return entries.map((item) =>
      typeof item === "number" ? item * multiplier : item,
    );
  }
  return value;
}

function addBindingValue(value: unknown, offset: number): unknown {
  if (typeof value === "number") {
    return value + offset;
  }
  if (Array.isArray(value)) {
    const entries: unknown[] = value;
    return entries.map((item) =>
      typeof item === "number" ? item + offset : item,
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readNumericModifier(value: unknown): number {
  if (
    typeof value !== "number" &&
    typeof value !== "string" &&
    typeof value !== "boolean"
  )
    return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
