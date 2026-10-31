import type {
  EffectV1Command,
  EffectV1Document,
} from "../../../../sdk/effect-v1/types.js";
import { applyEffectV1ObjectLayout } from "./object-layout.js";
import {
  drawImage,
  drawPath,
  drawShape,
  drawText,
  resolvePaint,
  withCommandStyle,
  withSavedState,
} from "./drawing.js";
import {
  attachPrimitiveBindingReads,
  recordPrimitiveRect,
} from "./primitive-geometry.js";
import { compositeEffectV1Pass, renderEffectV1Pass } from "./render-passes.js";
import { drawSampledPath } from "./sampled-path.js";
import { createSvgPartTransform } from "./svg-part-transform.js";
import {
  isRecord,
  n,
  resolveCommandLayer,
  type RenderState,
  type EffectV1RenderContext,
  v,
  valueOr,
  withItem,
} from "./model.js";

export function createEffectV1GraphRenderer(
  document: EffectV1Document,
  runtime: RenderState["runtime"],
) {
  const program = document.program;
  return {
    id: document.id,
    kind: document.kind === "standalone" ? "composition" : "effect",
    meta: { label: document.label },
    async renderFrame(context: EffectV1RenderContext) {
      const canvas = context.createCanvas(context.width, context.height);
      const canvasContext = canvas.getContext("2d");
      if (!canvasContext)
        throw new Error("Effect v1 Canvas 2D context is unavailable.");
      canvasContext.clearRect(0, 0, context.width, context.height);
      const logicalContext = {
        ...context,
        ...applyEffectV1ObjectLayout(
          document.objectLayout,
          context,
          canvasContext,
        ),
      };
      const state: RenderState = {
        canvas,
        context: canvasContext,
        passes: new Map(),
        runtime,
        scope: {
          context: logicalContext,
          definitions: program.definitions ?? {},
          definitionCache: new Map(),
          vars: {},
        },
      };
      attachPrimitiveBindingReads(state.context, context.__bindingReads);
      await executeCommands(program.commands, state);
      return canvas;
    },
  };
}

async function executeCommands(
  commands: EffectV1Command[],
  state: RenderState,
): Promise<void> {
  for (const command of commands) {
    await executeCommand(command, state);
  }
}

async function executeCommand(
  command: EffectV1Command,
  state: RenderState,
): Promise<void> {
  const layer = resolveCommandLayer(command, state);
  if (layer && !layer.active) return;
  const c = state.context;
  switch (command.op) {
    case "clear":
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, state.canvas.width, state.canvas.height);
      c.restore();
      if (command.color != null) {
        c.save();
        c.fillStyle = resolvePaint(command.color, c, state);
        c.fillRect(0, 0, state.scope.context.width, state.scope.context.height);
        c.restore();
      }
      return;
    case "fillRect":
      withCommandStyle(command, layer, state, () => {
        c.fillStyle = resolvePaint(command.fill ?? "#000", c, state);
        const x = n(command.x, state);
        const y = n(command.y, state);
        const width = n(command.width, state);
        const height = n(command.height, state);
        recordPrimitiveRect(c, command.layerId, { height, width, x, y });
        c.fillRect(x, y, width, height);
      });
      return;
    case "shape":
      drawShape(command, layer, state);
      return;
    case "text":
      drawText(command, layer, state);
      return;
    case "image":
      drawImage(command, layer, state);
      return;
    case "path":
    case "polyline":
      drawPath(command, layer, state);
      return;
    case "sampledPath":
      drawSampledPath(command, layer, state);
      return;
    case "group":
      await withSavedState(command, layer, state, async () => {
        c.translate(n(command.x, state), n(command.y, state));
        c.rotate(n(command.rotation, state));
        c.scale(
          valueOr(command.scaleX, 1, state),
          valueOr(command.scaleY, 1, state),
        );
        await executeCommands(command.commands, state);
      });
      return;
    case "clip":
      await withSavedState(command, layer, state, async () => {
        c.beginPath();
        c.rect(
          n(command.x, state),
          n(command.y, state),
          n(command.width, state),
          n(command.height, state),
        );
        c.clip();
        await executeCommands(command.commands, state);
      });
      return;
    case "when":
      if (v(command.condition, state)) {
        await executeCommands(command.commands, state);
      }
      return;
    case "let": {
      const previous = state.scope.vars;
      const bindings = isRecord(command.bindings) ? command.bindings : {};
      const next = { ...previous };
      state.scope.vars = next;
      try {
        for (const [name, expression] of Object.entries(bindings)) {
          next[name] = v(expression, state);
        }
        await executeCommands(command.commands, state);
      } finally {
        state.scope.vars = previous;
      }
      return;
    }
    case "forEach":
      await executeItems(
        command,
        Array.isArray(command.items) ? command.items : [],
        state,
      );
      return;
    case "stableOrderBy": {
      const items = Array.isArray(command.items) ? [...command.items] : [];
      const decorated = items.map((item, index) => ({
        index,
        item,
        key: withItem(state, item, () => n(command.key, state)),
      }));
      decorated.sort((a, b) => {
        const order = a.key - b.key || a.index - b.index;
        return command.direction === "desc" ? -order : order;
      });
      await executeItems(
        command,
        decorated.map((entry) => entry.item),
        state,
      );
      return;
    }
    case "forRange": {
      const items = Array.from(
        { length: Number(command.count) },
        (_, index) => index,
      );
      await executeItems(command, items, state);
      return;
    }
    case "forGrid": {
      const items: Array<{ column: number; row: number }> = [];
      for (let row = 0; row < Number(command.rows); row += 1) {
        for (let column = 0; column < Number(command.columns); column += 1) {
          items.push({ column, row });
        }
      }
      await executeItems(command, items, state);
      return;
    }
    case "renderPass": {
      await renderEffectV1Pass(command, state, executeCommands);
      return;
    }
    case "compositePass": {
      compositeEffectV1Pass(command, layer, state);
      return;
    }
    case "svgParts": {
      const asset = state.scope.context.assets?.[String(command.assetId)];
      if (!asset) return;
      withCommandStyle(command, layer, state, () => {
        const height = n(command.height, state);
        const width = n(command.width, state);
        const x = n(command.x, state);
        const y = n(command.y, state);
        recordPrimitiveRect(c, command.layerId, { height, width, x, y });
        if (!state.runtime.drawSvgVectorAsset)
          throw new Error("SVG drawing is unavailable.");
        state.runtime.drawSvgVectorAsset(c, asset, {
          alpha: 1,
          composite: c.globalCompositeOperation,
          filter: c.filter,
          height,
          partTransform: createSvgPartTransform(command.part, state),
          shadowBlur: c.shadowBlur,
          shadowColor: c.shadowColor,
          width,
          x,
          y,
        });
      });
      return;
    }
    default:
      throw new Error("Unsupported v1 render command.");
  }
}

async function executeItems(
  command: Extract<
    EffectV1Command,
    { op: "forEach" | "forGrid" | "forRange" | "stableOrderBy" }
  >,
  items: unknown[],
  state: RenderState,
): Promise<void> {
  const previousItem = state.scope.item;
  const previousVars = state.scope.vars;
  try {
    for (let index = 0; index < items.length; index += 1) {
      state.scope.item = items[index];
      const item = items[index];
      const variable =
        command.op === "forRange"
          ? (command.indexVar ?? "index")
          : "itemVar" in command
            ? (command.itemVar ?? "index")
            : "index";
      state.scope.vars = { ...previousVars, [variable]: item, index };
      if (command.op === "forGrid") {
        if (
          !isRecord(item) ||
          typeof item.row !== "number" ||
          typeof item.column !== "number"
        )
          throw new Error("Invalid Effect v1 grid item.");
        state.scope.vars[command.rowVar ?? "row"] = item.row;
        state.scope.vars[command.columnVar ?? "column"] = item.column;
      }
      await executeCommands(command.commands, state);
    }
  } finally {
    state.scope.item = previousItem;
    state.scope.vars = previousVars;
  }
}
