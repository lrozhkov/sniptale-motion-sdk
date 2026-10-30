import type { ViewerAppContext } from "../app/context.js";
import { resolveLayerCanvasResizeProperty } from "../layers/editor-capabilities.js";

const HANDLE_ANGLES = {
  e: 0,
  n: -90,
  ne: -45,
  nw: -135,
  s: 90,
  se: 45,
  sw: 135,
  w: 180,
};
const RESIZE_CURSORS = [
  "ew-resize",
  "nwse-resize",
  "ns-resize",
  "nesw-resize",
] as const;

export function resolveCanvasResizeCursor(
  handle: unknown,
  rotation: unknown,
): string {
  const baseAngle = HANDLE_ANGLES[String(handle) as keyof typeof HANDLE_ANGLES];
  if (baseAngle === undefined) {
    return "default";
  }
  const sector = modulo(
    Math.round((baseAngle + (Number(rotation) || 0)) / 45),
    4,
  );
  return RESIZE_CURSORS[sector];
}

function ensureCanvasTransformHandles(
  ctx: ViewerAppContext,
  capabilities,
  rotation = 0,
  displaySize: {
    height?: number;
    multiSelection?: boolean;
    width?: number;
  } = {},
) {
  if (!ctx.refs.canvasSelectionBox.querySelector("[data-scale-handle]")) {
    for (const handle of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) {
      const node = createTransformHandle(`scale-${handle}`);
      node.dataset.scaleHandle = handle;
      node.addEventListener("pointerdown", (event) => {
        ctx.setInspectorTab("transform");
        ctx.beginCanvasScaleDrag(event, handle);
      });
      bindKeyboardTransform(ctx, node);
      ctx.refs.canvasSelectionBox.append(node);
    }
    const rotate = createTransformHandle("rotate");
    rotate.dataset.rotateHandle = "true";
    rotate.addEventListener("pointerdown", (event) => {
      ctx.setInspectorTab("transform");
      ctx.beginCanvasRotationDrag(event);
    });
    bindKeyboardTransform(ctx, rotate);
    ctx.refs.canvasSelectionBox.append(rotate);
    const anchor = createTransformHandle("anchor");
    anchor.dataset.anchorHandle = "true";
    anchor.addEventListener("pointerdown", (event) => {
      ctx.setInspectorTab("transform");
      if (event.altKey) {
        ctx.beginCanvasAnchorDrag(event);
      } else {
        ctx.beginCanvasLayerDrag(event);
      }
    });
    bindKeyboardTransform(ctx, anchor);
    ctx.refs.canvasSelectionBox.append(anchor);
  }
  (
    ctx.refs.canvasSelectionBox.querySelectorAll(
      "[data-scale-handle]",
    ) as NodeListOf<HTMLButtonElement>
  ).forEach((handle) => {
    const direction = handle.dataset.scaleHandle;
    const horizontal = /e|w/.test(direction ?? "");
    const vertical = /n|s/.test(direction ?? "");
    const compact = isCompactCanvasSelection(displaySize);
    const multiSelection = displaySize.multiSelection === true;
    handle.hidden =
      (horizontal &&
        resolveLayerCanvasResizeProperty(capabilities, "x") === null) ||
      (vertical &&
        resolveLayerCanvasResizeProperty(capabilities, "y") === null) ||
      ((compact || multiSelection) && direction?.length === 1);
    handle.style.cursor = resolveCanvasResizeCursor(direction, rotation);
    const label = ctx.deps.t(
      `viewer.canvas.resize.${direction}`,
      `Resize ${direction}`,
    );
    nameTransformHandle(ctx, handle, label);
  });
  const rotate = ctx.refs.canvasSelectionBox.querySelector(
    "[data-rotate-handle]",
  ) as HTMLButtonElement | null;
  if (rotate) {
    rotate.hidden = !capabilities.transform.includes("rotation");
    nameTransformHandle(
      ctx,
      rotate,
      ctx.deps.t("viewer.canvas.rotateLayer", "Rotate layer"),
    );
  }
  const anchor = ctx.refs.canvasSelectionBox.querySelector(
    "[data-anchor-handle]",
  ) as HTMLButtonElement | null;
  if (anchor) {
    anchor.hidden =
      displaySize.multiSelection === true ||
      !capabilities.transform.includes("anchorX") ||
      !capabilities.transform.includes("anchorY");
    const label = ctx.deps.t(
      "viewer.canvas.moveAnchorPoint",
      "Move anchor point",
    );
    anchor.setAttribute("aria-label", label);
    anchor.title = `${label} · ${ctx.deps.t(
      "viewer.canvas.anchorPointerHint",
      "Alt+drag or arrow keys",
    )}`;
  }
}

export function isCompactCanvasSelection({
  height,
  width,
}: {
  height?: number;
  width?: number;
}): boolean {
  const resolvedWidth = Number(width);
  const resolvedHeight = Number(height);
  return Boolean(
    Number.isFinite(resolvedWidth) &&
    resolvedWidth > 0 &&
    Number.isFinite(resolvedHeight) &&
    resolvedHeight > 0 &&
    (resolvedWidth < 64 || resolvedHeight < 64),
  );
}

function updateCanvasAnchorHandle(ctx: ViewerAppContext, anchor) {
  const handle = ctx.refs.canvasSelectionBox.querySelector(
    "[data-anchor-handle]",
  ) as HTMLElement | null;
  if (!handle) {
    return;
  }
  handle.style.left = `${(0.5 + anchor.x) * 100}%`;
  handle.style.top = `${(0.5 + anchor.y) * 100}%`;
}

function createTransformHandle(role: string): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.className = `canvas-transform-handle ${role}`;
  const visual = document.createElement("span");
  visual.className = "canvas-transform-handle-visual";
  visual.setAttribute("aria-hidden", "true");
  node.append(visual);
  return node;
}

function bindKeyboardTransform(
  ctx: ViewerAppContext,
  node: HTMLButtonElement,
): void {
  node.addEventListener("keydown", (event) =>
    ctx.handleCanvasTransformHandleKeydown(event),
  );
}

function nameTransformHandle(
  ctx: ViewerAppContext,
  handle: HTMLButtonElement,
  label: string,
): void {
  handle.setAttribute("aria-label", label);
  handle.title = `${label} · ${ctx.deps.t("viewer.canvas.keyboardHint", "Arrow keys")}`;
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function installCanvasTransformHandlesOwner(
  ctx: ViewerAppContext,
): void {
  ctx.ensureCanvasTransformHandles = ensureCanvasTransformHandles.bind(
    undefined,
    ctx,
  );
  ctx.updateCanvasAnchorHandle = updateCanvasAnchorHandle.bind(undefined, ctx);
}
