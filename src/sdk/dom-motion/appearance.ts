import type { DomMotionNode } from "./model.js";

export type DomMotionBackground = DomMotionNode & { color: string };

/** Fade the paint, rather than group opacity, which would flatten the 3D tree. */
export function readDomMotionBackgrounds(
  source: HTMLElement,
  children: DomMotionNode[],
): DomMotionBackground[] {
  const view = source.ownerDocument.defaultView!;
  return [source, ...Array.from(source.querySelectorAll<HTMLElement>("*"))]
    .filter(
      (element) =>
        !!element.style &&
        !children.some((child) => child.element.contains(element)) &&
        element.getClientRects().length > 0,
    )
    .flatMap((element) => {
      const color = view.getComputedStyle(element).backgroundColor;
      return color === "rgba(0, 0, 0, 0)" || color === "transparent"
        ? []
        : [{ element, color, style: element.getAttribute("style") }];
    });
}

export function renderDomMotionBackgrounds(
  backgrounds: DomMotionBackground[],
  progress: number,
): void {
  const p = Math.max(0, Math.min(1, progress));
  const density = p * p;
  for (const { element, color } of backgrounds) {
    element.style.backgroundColor = `color-mix(in srgb, ${color} ${density * 100}%, transparent)`;
    // Source page shadows may be pale glows against the moving scene's dark stage.
    // The panel pose owns its flight shadow; original paper shadows return on settle.
    element.style.boxShadow = "none";
  }
}
