import type { EffectV1Layer } from "./model.js";
import type { BindingReads } from "../binding-reads.js";
import type { RuntimeCanvasContext } from "../canvas-model.js";
import type { EffectV1Command } from "../../../../sdk/effect-v1/types.js";
import { createChildBindingReads } from "../binding-reads.js";
import { getLogicalCanvasSize } from "../logical-canvas.js";
import { withCommandStyle } from "./drawing.js";
import { n, type RenderState, valueOr } from "./model.js";
import {
  attachPrimitiveBindingReads,
  recordCenteredPrimitiveRect,
  recordPrimitiveRect,
} from "./primitive-geometry.js";

type ExecuteCommands = (
  commands: EffectV1Command[],
  state: RenderState,
) => Promise<void>;

export async function renderEffectV1Pass(
  command: Extract<EffectV1Command, { op: "renderPass" }>,
  state: RenderState,
  executeCommands: ExecuteCommands,
): Promise<void> {
  const width = valueOr(command.width, state.scope.context.width, state);
  const height = valueOr(command.height, state.scope.context.height, state);
  const canvas = state.scope.context.createCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("Render pass Canvas 2D context is unavailable.");
  const passState = { ...state, canvas, context };
  const bindingReads = createChildBindingReads(
    state.scope.context.__bindingReads,
  );
  attachPrimitiveBindingReads(passState.context, bindingReads);
  passState.context.clearRect(0, 0, width, height);
  await executeCommands(command.commands, passState);
  state.passes.set(command.id, { bindingReads, canvas });
}

export function compositeEffectV1Pass(
  command: Extract<EffectV1Command, { op: "compositePass" }>,
  layer: EffectV1Layer | null,
  state: RenderState,
): void {
  const passEntry = state.passes.get(command.passId);
  if (!passEntry) return;
  const pass = passEntry.canvas;
  const passSize = getLogicalCanvasSize(pass);
  withCommandStyle(command, layer, state, () => {
    const context = state.context;
    const width = valueOr(command.width, passSize.width, state);
    const height = valueOr(command.height, passSize.height, state);
    context.translate(
      n(command.x, state) + width / 2,
      n(command.y, state) + height / 2,
    );
    context.rotate(n(command.rotation, state));
    recordCenteredPrimitiveRect(command, state, width, height);
    recordPassChildren(passEntry, passSize, width, height, context);
    context.drawImage(pass, -width / 2, -height / 2, width, height);
  });
}

function recordPassChildren(
  passEntry: { bindingReads?: BindingReads | null },
  passSize: { width: number; height: number },
  width: number,
  height: number,
  context: RuntimeCanvasContext,
): void {
  if (!passEntry.bindingReads?.primitiveBounds) return;
  context.save();
  context.scale(
    width / Math.max(1, passSize.width),
    height / Math.max(1, passSize.height),
  );
  context.translate(-passSize.width / 2, -passSize.height / 2);
  for (const bounds of passEntry.bindingReads.primitiveBounds.values()) {
    recordPrimitiveRect(context, bounds.layerId, bounds);
  }
  context.restore();
}
