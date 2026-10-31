import type { EffectV1Expression } from "../../../../sdk/effect-v1/types.js";

export type EffectV1EvaluationContext = {
  [key: string]: unknown;
  controls?: Record<string, unknown>;
  inputFrames?: Record<string, unknown>;
  assets?: Record<string, unknown>;
  track(id: string, fallback: number): unknown;
  resolveLayer(id: string): unknown;
};
export type EffectV1EvaluationScope = {
  context: EffectV1EvaluationContext;
  definitions: Record<string, EffectV1Expression>;
  definitionCache: Map<string, unknown>;
  item?: unknown;
  vars: Record<string, unknown>;
};

export function evaluateEffectV1Expression(
  expression: unknown,
  scope: EffectV1EvaluationScope,
): unknown {
  if (
    expression == null ||
    typeof expression === "boolean" ||
    typeof expression === "number" ||
    typeof expression === "string"
  ) {
    return expression;
  }
  if (!isRecord(expression)) return null;
  const args = (): unknown[] =>
    Array.isArray(expression.args)
      ? expression.args.map((value) => evaluateEffectV1Expression(value, scope))
      : [];
  switch (expression.op) {
    case "read":
      return readEffectV1Value(
        typeof expression.path === "string" ? expression.path : "",
        scope,
      );
    case "fallback": {
      const value = evaluateEffectV1Expression(expression.value, scope);
      return value == null ||
        (typeof value === "number" && !Number.isFinite(value))
        ? evaluateEffectV1Expression(expression.fallback, scope)
        : value;
    }
    case "select": {
      const values = Array.isArray(expression.values) ? expression.values : [];
      return truthy(evaluateEffectV1Expression(expression.value, scope))
        ? evaluateEffectV1Expression(values[0], scope)
        : evaluateEffectV1Expression(values[1], scope);
    }
    case "add":
      return args().reduce<number>(
        (sum, value) => effectV1Number(sum) + effectV1Number(value),
        0,
      );
    case "sub": {
      const values = args();
      return effectV1Number(values[0]) - effectV1Number(values[1]);
    }
    case "mul":
      return args().reduce<number>(
        (product, value) => product * effectV1Number(value),
        1,
      );
    case "div": {
      const values = args();
      const divisor = effectV1Number(values[1]);
      return divisor === 0 ? 0 : effectV1Number(values[0]) / divisor;
    }
    case "neg":
      return -effectV1Number(args()[0]);
    case "min":
      return Math.min(...args().map(effectV1Number));
    case "max":
      return Math.max(...args().map(effectV1Number));
    case "clamp": {
      const values = args();
      return clamp(
        effectV1Number(values[0]),
        effectV1Number(values[1]),
        effectV1Number(values[2]),
      );
    }
    case "concat":
      return args()
        .map((value) => effectV1Text(value))
        .join("");
    case "abs":
      return Math.abs(effectV1Number(args()[0]));
    case "floor":
      return Math.floor(effectV1Number(args()[0]));
    case "sin":
      return Math.sin(effectV1Number(args()[0]));
    case "cos":
      return Math.cos(effectV1Number(args()[0]));
    case "pow": {
      const values = args();
      return finite(
        Math.pow(effectV1Number(values[0]), effectV1Number(values[1])),
      );
    }
    case "sqrt":
      return Math.sqrt(Math.max(0, effectV1Number(args()[0])));
    case "exp":
      return finite(Math.exp(clamp(effectV1Number(args()[0]), -100, 100)));
    case "mod": {
      const values = args();
      const divisor = Math.abs(effectV1Number(values[1]));
      return divisor === 0
        ? 0
        : ((effectV1Number(values[0]) % divisor) + divisor) % divisor;
    }
    case "mix": {
      const values = args();
      return (
        effectV1Number(values[0]) +
        (effectV1Number(values[1]) - effectV1Number(values[0])) *
          effectV1Number(values[2])
      );
    }
    case "point": {
      const values = args();
      return { x: effectV1Number(values[0]), y: effectV1Number(values[1]) };
    }
    case "rgba": {
      const values = args();
      const red = clamp(Math.round(effectV1Number(values[0])), 0, 255);
      const green = clamp(Math.round(effectV1Number(values[1])), 0, 255);
      const blue = clamp(Math.round(effectV1Number(values[2])), 0, 255);
      const alpha = clamp(effectV1Number(values[3] ?? 1), 0, 1);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
    case "out": {
      const value = clamp(effectV1Number(args()[0]), 0, 1);
      return 1 - Math.pow(1 - value, 3);
    }
    case "inOut": {
      const value = clamp(effectV1Number(args()[0]), 0, 1);
      return value < 0.5
        ? 4 * value * value * value
        : 1 - Math.pow(-2 * value + 2, 3) / 2;
    }
    case "eq": {
      const values = args();
      return values[0] === values[1];
    }
    case "lt":
    case "lte":
    case "gt":
    case "gte": {
      const values = args();
      const left = effectV1Number(values[0]),
        right = effectV1Number(values[1]);
      if (expression.op === "lt") return left < right;
      if (expression.op === "lte") return left <= right;
      if (expression.op === "gt") return left > right;
      return left >= right;
    }
    case "and":
      return args().every(truthy);
    case "or":
      return args().some(truthy);
    case "not":
      return !truthy(args()[0]);
    case "cubicPoint":
      return cubicPoint(args());
    case "cubicTangent":
      return cubicTangent(args());
    case "ellipsePoint":
    case "ellipseVelocity":
      return ellipse(expression.op === "ellipseVelocity", args());
    default:
      throw new Error(
        `Unsupported v1 expression ${effectV1Text(expression.op)}.`,
      );
  }
}

export function readEffectV1Value(
  path: string,
  scope: EffectV1EvaluationScope,
): unknown {
  const ctx = scope.context;
  if (
    ["time", "progress", "width", "height", "frameIndex", "duration"].includes(
      path,
    )
  ) {
    return ctx[path];
  }
  if (path.startsWith("controls.")) {
    return getPath(ctx.controls, [path.slice(9)]);
  }
  if (path.startsWith("tracks.")) {
    const id = path.slice(7);
    return ctx.track(id, 0);
  }
  if (path.startsWith("layers.")) {
    const [layerId, ...property] = path.slice(7).split(".");
    if (!layerId) return undefined;
    const layer = ctx.resolveLayer(layerId);
    return property.length > 0 ? getPath(layer, property) : layer;
  }
  if (path.startsWith("vars.")) {
    return getPath(scope.vars, path.slice(5).split("."));
  }
  if (path === "item") return scope.item;
  if (path.startsWith("item.")) {
    return getPath(scope.item, path.slice(5).split("."));
  }
  if (path.startsWith("defs.")) {
    const id = path.slice(5);
    if (scope.definitionCache.has(id)) return scope.definitionCache.get(id);
    const definition = Object.hasOwn(scope.definitions, id)
      ? scope.definitions[id]
      : undefined;
    if (definition === undefined) return undefined;
    const value = evaluateEffectV1Expression(definition, scope);
    scope.definitionCache.set(id, value);
    return value;
  }
  if (path.startsWith("input.")) {
    const name = path.slice(6);
    return getPath(ctx.inputFrames, [name]);
  }
  return undefined;
}

function cubicPoint(values: unknown[]): { x: number; y: number } {
  const p0 = point(values[0]),
    p1 = point(values[1]),
    p2 = point(values[2]),
    p3 = point(values[3]);
  const t = effectV1Number(values[4]);
  const u = 1 - t;
  return {
    x:
      u * u * u * effectV1Number(p0?.x) +
      3 * u * u * t * effectV1Number(p1?.x) +
      3 * u * t * t * effectV1Number(p2?.x) +
      t * t * t * effectV1Number(p3?.x),
    y:
      u * u * u * effectV1Number(p0?.y) +
      3 * u * u * t * effectV1Number(p1?.y) +
      3 * u * t * t * effectV1Number(p2?.y) +
      t * t * t * effectV1Number(p3?.y),
  };
}

function cubicTangent(values: unknown[]): { x: number; y: number } {
  const p0 = point(values[0]),
    p1 = point(values[1]),
    p2 = point(values[2]),
    p3 = point(values[3]);
  const t = effectV1Number(values[4]);
  const u = 1 - t;
  return {
    x:
      3 * u * u * (effectV1Number(p1?.x) - effectV1Number(p0?.x)) +
      6 * u * t * (effectV1Number(p2?.x) - effectV1Number(p1?.x)) +
      3 * t * t * (effectV1Number(p3?.x) - effectV1Number(p2?.x)),
    y:
      3 * u * u * (effectV1Number(p1?.y) - effectV1Number(p0?.y)) +
      6 * u * t * (effectV1Number(p2?.y) - effectV1Number(p1?.y)) +
      3 * t * t * (effectV1Number(p3?.y) - effectV1Number(p2?.y)),
  };
}

function ellipse(
  velocity: boolean,
  values: unknown[],
): { x: number; y: number } {
  const cx = effectV1Number(values[0]),
    cy = effectV1Number(values[1]),
    rx = effectV1Number(values[2]),
    ry = effectV1Number(values[3]),
    angle = effectV1Number(values[4]);
  return velocity
    ? { x: -rx * Math.sin(angle), y: ry * Math.cos(angle) }
    : { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
}

function point(value: unknown): { x: number; y: number } {
  return {
    x: effectV1Number(getPath(value, ["x"])),
    y: effectV1Number(getPath(value, ["y"])),
  };
}

function getPath(value: unknown, parts: readonly string[]): unknown {
  let current = value;
  for (const part of parts) {
    if (isRecord(current)) {
      if (!Object.hasOwn(current, part)) return undefined;
      current = current[part];
    } else if (Array.isArray(current) || typeof current === "string") {
      if (part === "length") current = current.length;
      else if (
        /^(0|[1-9]\d*)$/.test(part) &&
        Number.isSafeInteger(Number(part))
      )
        current = current[Number(part)];
      else return undefined;
    } else return undefined;
  }
  return current;
}

export function effectV1Text(
  value: unknown,
  seen = new Set<unknown>(),
): string {
  if (Array.isArray(value)) {
    if (seen.has(value)) return "";
    seen.add(value);
    const parts: string[] = [];
    for (let index = 0; index < value.length; index++) {
      const item: unknown = value[index];
      parts.push(
        item === null || item === undefined ? "" : effectV1Text(item, seen),
      );
    }
    seen.delete(value);
    return parts.join(",");
  }
  if (value !== null && typeof value === "object") return "[object Object]";
  if (typeof value === "function") return "[function]";
  return String(value);
}

export function effectV1Number(value: unknown): number {
  if (
    typeof value === "symbol" ||
    typeof value === "function" ||
    (value !== null && typeof value === "object" && !Array.isArray(value))
  )
    return 0;
  const result = Number(Array.isArray(value) ? effectV1Text(value) : value);
  return Number.isFinite(result) ? result : 0;
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function truthy(value: unknown): boolean {
  return Boolean(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
