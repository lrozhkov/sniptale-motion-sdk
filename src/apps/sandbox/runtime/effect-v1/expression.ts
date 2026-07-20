import type { EffectV1Expression } from "../../../../sdk/effect-v1/types.js";

export type EffectV1EvaluationScope = {
  context: any;
  definitions: Record<string, EffectV1Expression>;
  definitionCache: Map<string, unknown>;
  item?: unknown;
  vars: Record<string, unknown>;
};

export function evaluateEffectV1Expression(
  expression: EffectV1Expression | unknown,
  scope: EffectV1EvaluationScope,
): any {
  if (
    expression == null ||
    typeof expression === "boolean" ||
    typeof expression === "number" ||
    typeof expression === "string"
  ) {
    return expression;
  }
  if (!isRecord(expression)) return null;
  const args = () =>
    Array.isArray(expression.args)
      ? expression.args.map((value) => evaluateEffectV1Expression(value, scope))
      : [];
  switch (expression.op) {
    case "read":
      return readEffectV1Value(String(expression.path ?? ""), scope);
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
      return args().reduce((sum, value) => number(sum) + number(value), 0);
    case "sub": {
      const values = args();
      return number(values[0]) - number(values[1]);
    }
    case "mul":
      return args().reduce((product, value) => product * number(value), 1);
    case "div": {
      const values = args();
      const divisor = number(values[1]);
      return divisor === 0 ? 0 : number(values[0]) / divisor;
    }
    case "neg":
      return -number(args()[0]);
    case "min":
      return Math.min(...args().map(number));
    case "max":
      return Math.max(...args().map(number));
    case "clamp": {
      const values = args();
      return clamp(number(values[0]), number(values[1]), number(values[2]));
    }
    case "concat":
      return args().map(String).join("");
    case "abs":
      return Math.abs(number(args()[0]));
    case "floor":
      return Math.floor(number(args()[0]));
    case "sin":
      return Math.sin(number(args()[0]));
    case "cos":
      return Math.cos(number(args()[0]));
    case "pow": {
      const values = args();
      return finite(Math.pow(number(values[0]), number(values[1])));
    }
    case "sqrt":
      return Math.sqrt(Math.max(0, number(args()[0])));
    case "exp":
      return finite(Math.exp(clamp(number(args()[0]), -100, 100)));
    case "mod": {
      const values = args();
      const divisor = Math.abs(number(values[1]));
      return divisor === 0
        ? 0
        : ((number(values[0]) % divisor) + divisor) % divisor;
    }
    case "mix": {
      const values = args();
      return (
        number(values[0]) +
        (number(values[1]) - number(values[0])) * number(values[2])
      );
    }
    case "point": {
      const values = args();
      return { x: number(values[0]), y: number(values[1]) };
    }
    case "rgba": {
      const values = args();
      const red = clamp(Math.round(number(values[0])), 0, 255);
      const green = clamp(Math.round(number(values[1])), 0, 255);
      const blue = clamp(Math.round(number(values[2])), 0, 255);
      const alpha = clamp(number(values[3] ?? 1), 0, 1);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
    case "out": {
      const value = clamp(number(args()[0]), 0, 1);
      return 1 - Math.pow(1 - value, 3);
    }
    case "inOut": {
      const value = clamp(number(args()[0]), 0, 1);
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
      const values = args().map(number);
      if (expression.op === "lt") return values[0] < values[1];
      if (expression.op === "lte") return values[0] <= values[1];
      if (expression.op === "gt") return values[0] > values[1];
      return values[0] >= values[1];
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
      throw new Error(`Unsupported v1 expression ${String(expression.op)}.`);
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
    return ctx.controls?.[path.slice(9)];
  }
  if (path.startsWith("tracks.")) {
    const id = path.slice(7);
    return ctx.track(id, 0);
  }
  if (path.startsWith("layers.")) {
    const [layerId, ...property] = path.slice(7).split(".");
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
    const definition = scope.definitions[id];
    if (definition === undefined) return undefined;
    const value = evaluateEffectV1Expression(definition, scope);
    scope.definitionCache.set(id, value);
    return value;
  }
  if (path.startsWith("input.")) {
    const name = path.slice(6);
    return ctx.inputFrames?.[name];
  }
  return undefined;
}

function cubicPoint(values: any[]): { x: number; y: number } {
  const [p0, p1, p2, p3] = values;
  const t = number(values[4]);
  const u = 1 - t;
  return {
    x:
      u * u * u * number(p0?.x) +
      3 * u * u * t * number(p1?.x) +
      3 * u * t * t * number(p2?.x) +
      t * t * t * number(p3?.x),
    y:
      u * u * u * number(p0?.y) +
      3 * u * u * t * number(p1?.y) +
      3 * u * t * t * number(p2?.y) +
      t * t * t * number(p3?.y),
  };
}

function cubicTangent(values: any[]): { x: number; y: number } {
  const [p0, p1, p2, p3] = values;
  const t = number(values[4]);
  const u = 1 - t;
  return {
    x:
      3 * u * u * (number(p1?.x) - number(p0?.x)) +
      6 * u * t * (number(p2?.x) - number(p1?.x)) +
      3 * t * t * (number(p3?.x) - number(p2?.x)),
    y:
      3 * u * u * (number(p1?.y) - number(p0?.y)) +
      6 * u * t * (number(p2?.y) - number(p1?.y)) +
      3 * t * t * (number(p3?.y) - number(p2?.y)),
  };
}

function ellipse(velocity: boolean, values: any[]): { x: number; y: number } {
  const [cx, cy, rx, ry, angle] = values.map(number);
  return velocity
    ? { x: -rx * Math.sin(angle), y: ry * Math.cos(angle) }
    : { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
}

function getPath(value: any, parts: string[]): any {
  return parts.reduce((current, part) => current?.[part], value);
}

function number(value: unknown): number {
  const result = Number(value);
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

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
