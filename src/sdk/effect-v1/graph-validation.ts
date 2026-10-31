import { isUnknownArray } from "./validation-shared.js";
import type { EffectV1ValidationReport } from "./diagnostics.js";
import {
  COMMAND_KEYS,
  EFFECT_V1_GRAPH_LIMITS,
  GRAPH_OPS,
} from "./graph-command-contract.js";
import {
  createEffectV1ReadReferences,
  type EffectV1GraphReferences,
  type EffectV1ReadReferences,
} from "./graph-model.js";
import {
  validateCommandExpressions,
  validateEffectV1Definitions,
} from "./expression-validation.js";
import {
  collectEffectV1PassIndex,
  type EffectV1PassIndex,
  validateEffectV1CommandSemantics,
} from "./command-validation.js";
import {
  isRecord,
  rejectUnknownKeys,
  requireIdentifier,
} from "./validation-shared.js";

export { EXPRESSION_OPS } from "./expression-validation.js";
export { GRAPH_OPS } from "./graph-command-contract.js";
export type { EffectV1GraphReferences } from "./graph-model.js";

export function validateEffectV1Graph(
  program: Record<string, unknown>,
  assets: Map<string, Record<string, unknown>>,
  runtimeInputs: Set<string>,
  references: EffectV1GraphReferences,
  report: EffectV1ValidationReport,
): void {
  const definitions = isRecord(program.definitions) ? program.definitions : {};
  const readReferences = createEffectV1ReadReferences(
    definitions,
    runtimeInputs,
    references,
  );
  if (program.definitions !== undefined && !isRecord(program.definitions)) {
    report.error(
      "DEFINITIONS_TYPE",
      "$.program.definitions",
      "Expected a named expression object.",
    );
  }
  validateEffectV1Definitions(definitions, readReferences, report);
  if (!isUnknownArray(program.commands)) {
    report.error(
      "COMMANDS_TYPE",
      "$.program.commands",
      "Expected a command array.",
    );
    return;
  }
  if (program.commands.length === 0) {
    report.error(
      "COMMANDS_EMPTY",
      "$.program.commands",
      "A graph program needs at least one render command.",
    );
    return;
  }
  const passes = collectEffectV1PassIndex(program.commands);
  validateCommands(
    program.commands,
    "$.program.commands",
    0,
    assets,
    runtimeInputs,
    { expanded: 0, nodes: 0 },
    report,
    readReferences,
    passes,
  );
  validateRequiredRuntimeInputs(program.commands, runtimeInputs, report);
}

function validateRequiredRuntimeInputs(
  commands: unknown[],
  requiredInputs: Set<string>,
  report: EffectV1ValidationReport,
): void {
  if (requiredInputs.size === 0) return;
  const used = new Set<string>();
  collectRuntimeInputs(commands, used);
  for (const input of requiredInputs) {
    if (used.has(input)) continue;
    report.error(
      "RUNTIME_INPUT_REQUIRED",
      "$.program.commands",
      `Effect kind requires runtime input "${input}", but the graph never reads it.`,
      `Add an image command with input: "${input}". Preview media remains session-only and is not part of the bundle.`,
    );
  }
}

function collectRuntimeInputs(commands: unknown[], used: Set<string>) {
  for (const command of commands) {
    if (!isRecord(command)) continue;
    if (command.op === "image" && typeof command.input === "string") {
      used.add(command.input);
    }
    if (isUnknownArray(command?.commands)) {
      collectRuntimeInputs(command.commands, used);
    }
  }
}

function validateCommands(
  commands: unknown[],
  path: string,
  depth: number,
  assets: Map<string, Record<string, unknown>>,
  runtimeInputs: Set<string>,
  budget: { expanded: number; nodes: number },
  report: EffectV1ValidationReport,
  references: EffectV1ReadReferences,
  passes: EffectV1PassIndex,
  multiplier = 1,
): void {
  if (depth > EFFECT_V1_GRAPH_LIMITS.graphDepth) {
    report.error(
      "GRAPH_DEPTH",
      path,
      `Graph nesting exceeds ${EFFECT_V1_GRAPH_LIMITS.graphDepth}.`,
    );
    return;
  }
  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index];
    const commandPath = `${path}[${index}]`;
    budget.nodes += 1;
    budget.expanded += multiplier;
    if (budget.nodes > EFFECT_V1_GRAPH_LIMITS.graphNodes) {
      report.error(
        "GRAPH_NODE_BUDGET",
        path,
        `Graph exceeds ${EFFECT_V1_GRAPH_LIMITS.graphNodes} nodes.`,
      );
      return;
    }
    if (budget.expanded > EFFECT_V1_GRAPH_LIMITS.expandedCommands) {
      report.error(
        "GRAPH_EXPANSION_BUDGET",
        path,
        `Worst-case execution exceeds ${EFFECT_V1_GRAPH_LIMITS.expandedCommands} commands per frame.`,
      );
      return;
    }
    const operation = isRecord(command) ? command.op : undefined;
    const allowed =
      typeof operation === "string" ? COMMAND_KEYS[operation] : undefined;
    if (
      !isRecord(command) ||
      typeof operation !== "string" ||
      !GRAPH_OPS.has(operation) ||
      !allowed
    ) {
      report.error(
        "COMMAND_OP",
        `${commandPath}.op`,
        `Unknown render command "${String(operation)}".`,
      );
      continue;
    }
    rejectUnknownKeys(command, allowed, commandPath, report);
    validateEffectV1CommandSemantics(command, commandPath, passes, report);
    validateCommandExpressions(command, commandPath, report, references);
    validateCommandReferences(
      command,
      commandPath,
      assets,
      runtimeInputs,
      references,
      report,
    );
    if (operation === "renderPass") {
      requireIdentifier(command.id, `${commandPath}.id`, report);
    }
    if (operation === "compositePass") {
      requireIdentifier(command.passId, `${commandPath}.passId`, report);
    }
    const children = command.commands;
    if (commandNeedsChildren(operation)) {
      if (!isUnknownArray(children)) {
        report.error(
          "CHILD_COMMANDS_TYPE",
          `${commandPath}.commands`,
          "Expected a command array.",
        );
        continue;
      }
      const loopMultiplier = isLoop(operation)
        ? Math.max(1, resolveLoopBound(command, commandPath, report))
        : 1;
      validateCommands(
        children,
        `${commandPath}.commands`,
        depth + 1,
        assets,
        runtimeInputs,
        budget,
        report,
        references,
        passes,
        multiplier * loopMultiplier,
      );
    }
  }
}

function validateCommandReferences(
  command: Record<string, unknown>,
  path: string,
  assets: Map<string, Record<string, unknown>>,
  runtimeInputs: Set<string>,
  references: EffectV1ReadReferences,
  report: EffectV1ValidationReport,
): void {
  if (
    command.layerId !== undefined &&
    !references.layerIds.has(String(command.layerId))
  ) {
    report.error(
      "COMMAND_LAYER_UNKNOWN",
      `${path}.layerId`,
      `Unknown layer "${String(command.layerId)}".`,
      "Use a declared leaf layer id or remove layerId.",
    );
  }
  if (command.assetId !== undefined && !assets.has(String(command.assetId))) {
    report.error(
      "COMMAND_ASSET_UNKNOWN",
      `${path}.assetId`,
      `Unknown asset "${String(command.assetId)}".`,
    );
  }
  if (command.op === "image") {
    validateImageSource(command, path, assets, runtimeInputs, report);
  }
  if (command.op === "svgParts" && typeof command.assetId === "string") {
    const asset = assets.get(String(command.assetId));
    if (asset && asset.kind !== "svg") {
      report.error(
        "SVG_PARTS_ASSET_KIND",
        `${path}.assetId`,
        `svgParts requires an SVG asset; "${command.assetId}" is ${String(asset.kind)}.`,
      );
    }
  }
}

function validateImageSource(
  command: Record<string, unknown>,
  path: string,
  assets: Map<string, Record<string, unknown>>,
  runtimeInputs: Set<string>,
  report: EffectV1ValidationReport,
): void {
  const hasAsset = typeof command.assetId === "string";
  const hasInput = typeof command.input === "string";
  if (hasAsset === hasInput) {
    report.error(
      "IMAGE_SOURCE",
      path,
      "Image command requires exactly one assetId or runtime input.",
      "Use a declared asset id, or source/from/to allowed by the document kind.",
    );
    return;
  }
  if (hasAsset && !assets.has(String(command.assetId))) return;
  if (hasAsset) {
    const asset = assets.get(String(command.assetId));
    if (asset && asset.kind !== "image" && asset.kind !== "svg") {
      report.error(
        "IMAGE_ASSET_KIND",
        `${path}.assetId`,
        `Image command cannot render ${String(asset.kind)} asset "${command.assetId}".`,
        "Use an image/SVG asset, or a kind-specific temporary runtime input.",
      );
    }
  }
  if (hasInput && !runtimeInputs.has(String(command.input))) {
    report.error(
      "IMAGE_INPUT_UNAVAILABLE",
      `${path}.input`,
      `Runtime input "${String(command.input)}" is unavailable for this effect kind.`,
      runtimeInputs.size > 0
        ? `Use one of: ${[...runtimeInputs].join(", ")}.`
        : "Use assetId for a standalone effect.",
    );
  }
}

function resolveLoopBound(
  command: Record<string, unknown>,
  path: string,
  report: EffectV1ValidationReport,
): number {
  const count =
    command.op === "forEach" || command.op === "stableOrderBy"
      ? isUnknownArray(command.items)
        ? command.items.length
        : Number.NaN
      : command.op === "forGrid"
        ? Number(command.columns) * Number(command.rows)
        : Number(command.count);
  if (
    !Number.isSafeInteger(count) ||
    count < 0 ||
    count > EFFECT_V1_GRAPH_LIMITS.loopIterations
  ) {
    report.error(
      "LOOP_BOUND",
      path,
      `Loop bound must be a static integer from 0 to ${EFFECT_V1_GRAPH_LIMITS.loopIterations}.`,
      "Use a bounded constant list/count; runtime-dependent loop lengths are forbidden.",
    );
    return EFFECT_V1_GRAPH_LIMITS.loopIterations;
  }
  return count;
}

function commandNeedsChildren(op: string): boolean {
  return [
    "clip",
    "forEach",
    "forGrid",
    "forRange",
    "group",
    "let",
    "renderPass",
    "stableOrderBy",
    "when",
  ].includes(op);
}

function isLoop(op: string): boolean {
  return ["forEach", "forGrid", "forRange", "stableOrderBy"].includes(op);
}
