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
    if (!prototype) continue;
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
      typeof value === "string" &&
      REDUCED_EXPENSIVE_BLEND_MODES.has(value)
        ? "source-over"
        : value,
    );
    wrapSetter(prototype, "imageSmoothingQuality", (value) =>
      resolveQuality() === "reduced" ? "low" : value,
    );
  }
}

function wrapSetter(
  prototype: object,
  property: string,
  transform: (value: unknown) => unknown,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
  if (!descriptor?.set || !descriptor.configurable) {
    return;
  }
  Object.defineProperty(prototype, property, {
    ...descriptor,
    set: function (this: unknown, value: unknown): void {
      descriptor.set?.call(this, transform(value));
    },
  });
}
