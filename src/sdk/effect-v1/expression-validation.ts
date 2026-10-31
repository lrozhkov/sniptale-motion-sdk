import { formatEffectV1DiagnosticValue } from "./diagnostics.js";
import { EFFECT_V1_EXPRESSION_OPS } from "./types.js";
import type { EffectV1ValidationReport } from "./diagnostics.js";
import type { EffectV1ReadReferences } from "./graph-model.js";
import { isRecord, rejectUnknownKeys } from "./validation-shared.js";

const MAX_EXPRESSION_DEPTH = 32;
const EXPRESSION_KEYS = new Set([
  "args",
  "fallback",
  "op",
  "path",
  "value",
  "values",
]);

const EXPRESSION_SHAPES: Record<
  string,
  { args?: readonly [number, number]; fields?: readonly string[] }
> = {
  abs: { args: [1, 1] },
  add: { args: [1, 64] },
  and: { args: [1, 64] },
  clamp: { args: [3, 3] },
  concat: { args: [1, 64] },
  cos: { args: [1, 1] },
  cubicPoint: { args: [5, 5] },
  cubicTangent: { args: [5, 5] },
  div: { args: [2, 2] },
  ellipsePoint: { args: [5, 5] },
  ellipseVelocity: { args: [5, 5] },
  eq: { args: [2, 2] },
  exp: { args: [1, 1] },
  fallback: { fields: ["fallback", "value"] },
  floor: { args: [1, 1] },
  gt: { args: [2, 2] },
  gte: { args: [2, 2] },
  inOut: { args: [1, 1] },
  lt: { args: [2, 2] },
  lte: { args: [2, 2] },
  max: { args: [1, 64] },
  min: { args: [1, 64] },
  mix: { args: [3, 3] },
  mod: { args: [2, 2] },
  mul: { args: [1, 64] },
  neg: { args: [1, 1] },
  not: { args: [1, 1] },
  or: { args: [1, 64] },
  out: { args: [1, 1] },
  point: { args: [2, 2] },
  pow: { args: [2, 2] },
  read: { fields: ["path"] },
  rgba: { args: [3, 4] },
  select: { fields: ["value", "values"] },
  sin: { args: [1, 1] },
  sqrt: { args: [1, 1] },
  sub: { args: [2, 2] },
};

export const EXPRESSION_OPS = new Set<string>(EFFECT_V1_EXPRESSION_OPS);

export function validateEffectV1Definitions(
  definitions: Record<string, unknown>,
  references: EffectV1ReadReferences,
  report: EffectV1ValidationReport,
): void {
  for (const [name, expression] of Object.entries(definitions)) {
    if (!/^[a-z][a-zA-Z0-9._-]{0,63}$/.test(name)) {
      report.error(
        "DEFINITION_ID",
        `$.program.definitions.${name}`,
        "Expected a safe definition id.",
      );
    }
    validateEffectV1Expression(
      expression,
      `$.program.definitions.${name}`,
      0,
      report,
      references,
    );
  }
  validateDefinitionCycles(definitions, report);
}

export function validateCommandExpressions(
  command: Record<string, unknown>,
  path: string,
  report: EffectV1ValidationReport,
  references: EffectV1ReadReferences,
): void {
  for (const [key, value] of Object.entries(command)) {
    if (["commands", "items", "op"].includes(key)) continue;
    walkExpressionCandidates(value, `${path}.${key}`, report, references);
  }
}

function walkExpressionCandidates(
  value: unknown,
  path: string,
  report: EffectV1ValidationReport,
  references: EffectV1ReadReferences,
): void {
  if (isRecord(value) && typeof value.op === "string") {
    validateEffectV1Expression(value, path, 0, report, references);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walkExpressionCandidates(item, `${path}[${index}]`, report, references),
    );
    return;
  }
  if (isRecord(value)) {
    Object.entries(value).forEach(([key, child]) =>
      walkExpressionCandidates(child, `${path}.${key}`, report, references),
    );
  }
}

export function validateEffectV1Expression(
  value: unknown,
  path: string,
  depth: number,
  report: EffectV1ValidationReport,
  references: EffectV1ReadReferences,
): void {
  if (depth > MAX_EXPRESSION_DEPTH) {
    report.error(
      "EXPRESSION_DEPTH",
      path,
      `Expression nesting exceeds ${MAX_EXPRESSION_DEPTH}.`,
    );
    return;
  }
  if (value == null || ["boolean", "number", "string"].includes(typeof value)) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      report.error(
        "EXPRESSION_NUMBER",
        path,
        "Expression numbers must be finite.",
      );
    }
    return;
  }
  const operation = isRecord(value) ? value.op : undefined;
  if (
    !isRecord(value) ||
    typeof operation !== "string" ||
    !EXPRESSION_OPS.has(operation)
  ) {
    report.error(
      "EXPRESSION_OP",
      `${path}.op`,
      `Unknown expression operation "${formatEffectV1DiagnosticValue(operation)}".`,
    );
    return;
  }
  rejectUnknownKeys(value, EXPRESSION_KEYS, path, report);
  validateExpressionShape(value, path, report);
  if (value.op === "read" && !isSafeReadPath(value.path)) {
    report.error(
      "READ_PATH",
      `${path}.path`,
      "Read path is not in the declared frame scope.",
      "Read time, progress, width, height, controls.*, tracks.*, layers.*, vars.*, item.*, defs.*, or input.*.",
    );
  } else if (value.op === "read") {
    validateReadReference(value.path, `${path}.path`, references, report);
  }
  for (const key of ["args", "values"]) {
    const children = value[key];
    if (children !== undefined) {
      if (!Array.isArray(children)) {
        report.error(
          "EXPRESSION_ARGS",
          `${path}.${key}`,
          "Expected an expression array.",
        );
      } else {
        children.forEach((child, index) =>
          validateEffectV1Expression(
            child,
            `${path}.${key}[${index}]`,
            depth + 1,
            report,
            references,
          ),
        );
      }
    }
  }
  for (const key of ["fallback", "value"]) {
    if (value[key] !== undefined) {
      validateEffectV1Expression(
        value[key],
        `${path}.${key}`,
        depth + 1,
        report,
        references,
      );
    }
  }
}

function validateExpressionShape(
  value: Record<string, unknown>,
  path: string,
  report: EffectV1ValidationReport,
): void {
  const shape =
    typeof value.op === "string" && Object.hasOwn(EXPRESSION_SHAPES, value.op)
      ? EXPRESSION_SHAPES[value.op]
      : undefined;
  if (!shape) return;
  if (shape.args) {
    if (!Array.isArray(value.args)) {
      report.error(
        "EXPRESSION_ARGS_REQUIRED",
        `${path}.args`,
        `Operation "${value.op}" requires an argument array.`,
      );
      return;
    }
    const [minimum, maximum] = shape.args;
    if (value.args.length < minimum || value.args.length > maximum) {
      report.error(
        "EXPRESSION_ARITY",
        `${path}.args`,
        minimum === maximum
          ? `Operation "${value.op}" requires exactly ${minimum} argument${minimum === 1 ? "" : "s"}.`
          : `Operation "${value.op}" requires ${minimum} to ${maximum} arguments.`,
      );
    }
    return;
  }
  for (const field of shape.fields ?? []) {
    if (value[field] === undefined) {
      report.error(
        "EXPRESSION_FIELD_REQUIRED",
        `${path}.${field}`,
        `Operation "${value.op}" requires field "${field}".`,
      );
    }
  }
  if (value.op === "select" && value.values !== undefined) {
    if (!Array.isArray(value.values) || value.values.length !== 2) {
      report.error(
        "EXPRESSION_SELECT_VALUES",
        `${path}.values`,
        "Select requires exactly two result values.",
      );
    }
  }
}

function validateReadReference(
  value: unknown,
  path: string,
  references: EffectV1ReadReferences,
  report: EffectV1ValidationReport,
): void {
  if (typeof value !== "string") return;
  const reference = resolveDeclaredReference(value, references);
  if (!reference || reference.ids.has(reference.id)) return;
  report.error(
    "READ_REFERENCE_UNKNOWN",
    path,
    `Unknown ${reference.kind} "${reference.id}".`,
    `Declare the ${reference.kind} or correct the read path.`,
  );
}

function resolveDeclaredReference(
  path: string,
  references: EffectV1ReadReferences,
): { id: string; ids: Set<string>; kind: string } | null {
  if (path.startsWith("controls.")) {
    return {
      id: path.slice(9),
      ids: references.controlIds,
      kind: "control",
    };
  }
  if (path.startsWith("tracks.")) {
    return { id: path.slice(7), ids: references.trackIds, kind: "track" };
  }
  if (path.startsWith("defs.")) {
    return {
      id: path.slice(5),
      ids: references.definitionIds,
      kind: "definition",
    };
  }
  if (path.startsWith("input.")) {
    return {
      id: path.slice(6),
      ids: references.runtimeInputs,
      kind: "runtime input",
    };
  }
  if (path.startsWith("layers.")) {
    return {
      id: path.slice(7).split(".").at(0) ?? "",
      ids: references.layerIds,
      kind: "layer",
    };
  }
  return null;
}

function isSafeReadPath(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^(?:time|progress|width|height|frameIndex|duration|controls\.[a-z0-9._-]+|tracks\.[a-z0-9._-]+|layers\.[a-z0-9._-]+|vars\.[a-z0-9._-]+|defs\.[a-z0-9._-]+|item(?:\.[a-z0-9._-]+)?|input\.(?:source|from|to))$/i.test(
      value,
    )
  );
}

function validateDefinitionCycles(
  definitions: Record<string, unknown>,
  report: EffectV1ValidationReport,
): void {
  const refs = new Map<string, Set<string>>();
  for (const [name, expression] of Object.entries(definitions)) {
    const target = new Set<string>();
    collectDefinitionRefs(expression, target);
    refs.set(name, target);
  }
  for (const name of refs.keys()) {
    if (hasCycle(name, refs, new Set(), new Set())) {
      report.error(
        "DEFINITION_CYCLE",
        `$.program.definitions.${name}`,
        "Named expressions must be acyclic.",
      );
    }
  }
}

function collectDefinitionRefs(value: unknown, refs: Set<string>): void {
  if (!isRecord(value)) return;
  if (
    value.op === "read" &&
    typeof value.path === "string" &&
    value.path.startsWith("defs.")
  ) {
    refs.add(value.path.slice(5));
  }
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      child.forEach((item) => collectDefinitionRefs(item, refs));
    } else {
      collectDefinitionRefs(child, refs);
    }
  }
}

function hasCycle(
  name: string,
  refs: Map<string, Set<string>>,
  visiting: Set<string>,
  visited: Set<string>,
): boolean {
  if (visiting.has(name)) return true;
  if (visited.has(name)) return false;
  visiting.add(name);
  for (const dependency of refs.get(name) ?? []) {
    if (refs.has(dependency) && hasCycle(dependency, refs, visiting, visited)) {
      return true;
    }
  }
  visiting.delete(name);
  visited.add(name);
  return false;
}
