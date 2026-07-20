import { recordBindingRead } from "./binding-reads.js";
import { ease } from "./math.js";

export function resolveBindings(ctx, definitions, at) {
  return resolveBindingObject(ctx, definitions, at);
}

export function resolveBindingObject(ctx, definitions, at) {
  const result = {};
  for (const [key, definition] of Object.entries(definitions ?? {})) {
    result[key] = resolveBindingValue(ctx, definition, 0, at);
  }
  return result;
}

export function resolveBindingValue(
  ctx,
  definition,
  fallback = 0,
  at = ctx.time,
) {
  if (typeof definition === "string") {
    return ctx.track(definition, fallback, at);
  }
  if (
    !definition ||
    typeof definition !== "object" ||
    Array.isArray(definition)
  ) {
    return definition ?? fallback;
  }
  const baseFallback =
    definition.fallback ??
    definition.defaultValue ??
    definition.value ??
    fallback;
  let value = baseFallback;
  if (definition.track) {
    value = ctx.track(String(definition.track), baseFallback, at);
  } else if (definition.control) {
    recordBindingRead(ctx.__bindingReads, "controls", definition.control);
    value = ctx.controls?.[definition.control] ?? baseFallback;
  }
  if (definition.phase) {
    value = multiplyBindingValue(
      value,
      ease(
        definition.ease || "linear",
        ctx.phaseProgress(definition.phase, at),
      ),
    );
  }
  if (definition.multiplier != null) {
    value = multiplyBindingValue(value, Number(definition.multiplier) || 0);
  }
  if (definition.offset != null) {
    value = addBindingValue(value, Number(definition.offset) || 0);
  }
  return value;
}

function multiplyBindingValue(value, multiplier) {
  if (typeof value === "number") {
    return value * multiplier;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "number" ? item * multiplier : item,
    );
  }
  return value;
}

function addBindingValue(value, offset) {
  if (typeof value === "number") {
    return value + offset;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "number" ? item + offset : item,
    );
  }
  return value;
}
