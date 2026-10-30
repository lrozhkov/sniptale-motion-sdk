import { restoreDomMotionNode } from "./elements.js";

/** Paint native scrollbars without changing scroll geometry or flattening panels. */
export function createDomMotionScrollbars(doc: Document) {
  const view = doc.defaultView!;
  const nodes = Array.from(doc.querySelectorAll<HTMLElement>("*")).flatMap(
    (element) => {
      const computed = view.getComputedStyle(element);
      if (
        !element.style ||
        ![computed.overflowX, computed.overflowY].some(
          (value) => value === "auto" || value === "scroll",
        )
      )
        return [];
      const colors = computed.scrollbarColor;
      const pair = colors.match(
        /(?:rgba?|hsla?|hwb|oklab|oklch|lab|lch|color)\([^)]*\)/g,
      );
      return [
        {
          element,
          style: element.getAttribute("style"),
          thumb: pair?.[0] ?? "color-mix(in srgb, CanvasText 25%, Canvas)",
          track: pair?.[1] ?? "color-mix(in srgb, Canvas 95%, CanvasText)",
        },
      ];
    },
  );
  return {
    restore() {
      nodes.forEach(restoreDomMotionNode);
    },
    render(opacity: number) {
      const percent = Math.max(0, Math.min(1, opacity)) * 100;
      if (percent === 100) return;
      for (const { element, thumb, track } of nodes)
        element.style.setProperty(
          "scrollbar-color",
          `color-mix(in srgb, ${thumb} ${percent}%, transparent) color-mix(in srgb, ${track} ${percent}%, transparent)`,
          "important",
        );
    },
  };
}
