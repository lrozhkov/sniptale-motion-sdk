import {
  restoreDomMotionNode,
  type DomMotionNode,
  type DomMotionPart,
} from "./elements.js";
import { readDomMotionScrollLayout } from "./scroll-layout.js";

/** The camera must share the DOM's 3D context; an outer iframe transform flattens it. */
export function createDomMotionWorld(doc: Document, parts: DomMotionPart[]) {
  const branches = new Set<HTMLElement>([doc.body]);
  const sources = new Set(parts.map((part) => part.source));
  const addParents = (element: HTMLElement) => {
    for (
      let parent = element.parentElement;
      parent && parent !== doc.documentElement;
      parent = parent.parentElement
    )
      branches.add(parent);
  };
  for (const part of parts) {
    addParents(part.source);
    for (const child of part.children) addParents(child.element);
  }
  const nodes: DomMotionNode[] = [doc.documentElement, ...branches].map(
    (element) => ({ element, style: element.getAttribute("style") }),
  );
  const formatting = new Map(
    [...branches].map((element) => {
      const style = doc.defaultView!.getComputedStyle(element);
      return [
        element,
        {
          ...(sources.has(element)
            ? {}
            : readDomMotionScrollLayout(element, style)),
          ...(style.display === "block" &&
          (style.overflowX !== "visible" || style.overflowY !== "visible")
            ? { display: "flow-root" }
            : {}),
        },
      ] as const;
    }),
  );
  function restore() {
    nodes.forEach(restoreDomMotionNode);
  }
  function render(transform: string, settled: boolean) {
    restore();
    if (settled) return;
    doc.documentElement.style.perspective = "2600px";
    doc.documentElement.style.perspectiveOrigin = "50% 50%";
    // Flying elements may overflow the viewport; they must not create frame scrollbars.
    doc.documentElement.style.overflow = "hidden";
    doc.documentElement.style.background = "#161c29";
    for (const element of branches) {
      Object.assign(element.style, formatting.get(element), {
        transformStyle: "preserve-3d",
        overflow: "visible",
        opacity: "1",
        filter: "none",
        clipPath: "none",
        isolation: "auto",
        contain: "none",
      });
    }
    doc.body.style.transform = transform;
    doc.body.style.transformOrigin = "50% 50%";
    doc.body.style.willChange = "transform";
  }
  return { render, restore };
}
