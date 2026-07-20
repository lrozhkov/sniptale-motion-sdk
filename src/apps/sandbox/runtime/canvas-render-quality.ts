export type CanvasRenderQuality = "full" | "reduced";

const REDUCED_NUMERIC_EFFECT_PROPERTIES = [
  "shadowBlur",
  "shadowOffsetX",
  "shadowOffsetY",
];
const REDUCED_EXPENSIVE_BLEND_MODES = new Set([
  "color-burn",
  "color-dodge",
  "hard-light",
  "lighter",
  "overlay",
  "screen",
  "soft-light",
]);

export function installCanvasRenderQuality(
  resolveQuality: () => CanvasRenderQuality,
): void {
  const prototypes = [
    globalThis.OffscreenCanvasRenderingContext2D?.prototype,
    globalThis.CanvasRenderingContext2D?.prototype,
  ].filter(Boolean);
  for (const prototype of prototypes) {
    for (const property of REDUCED_NUMERIC_EFFECT_PROPERTIES) {
      wrapSetter(prototype, property, (value) =>
        resolveQuality() === "reduced" ? 0 : value,
      );
    }
    wrapSetter(prototype, "filter", (value) =>
      resolveQuality() === "reduced" ? "none" : value,
    );
    wrapSetter(prototype, "globalCompositeOperation", (value) =>
      resolveQuality() === "reduced" &&
      REDUCED_EXPENSIVE_BLEND_MODES.has(String(value))
        ? "source-over"
        : value,
    );
    wrapSetter(prototype, "imageSmoothingQuality", (value) =>
      resolveQuality() === "reduced" ? "low" : value,
    );
  }
}

function wrapSetter(
  prototype: any,
  property: string,
  transform: (value: unknown) => unknown,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
  if (!descriptor?.set || !descriptor.configurable) {
    return;
  }
  Object.defineProperty(prototype, property, {
    ...descriptor,
    set(value) {
      return descriptor.set?.call(this, transform(value));
    },
  });
}
