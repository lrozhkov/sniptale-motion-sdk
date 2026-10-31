import type { DomMotionBinding, DomMotionNode } from "./model.js";
export type { DomMotionNode } from "./model.js";
import {
  readDomMotionBackgrounds,
  type DomMotionBackground,
} from "./appearance.js";

export type DomMotionPart = {
  binding: DomMotionBinding;
  source: HTMLElement;
  style: string | null;
  children: DomMotionNode[];
  backgrounds: DomMotionBackground[];
  width: string;
  height: string;
};

/** Keep the original tree, layout, text and controls. No clones or raster slices. */
export function buildDomMotionParts(
  doc: Document,
  bindings: DomMotionBinding[],
): DomMotionPart[] {
  const view = doc.defaultView;
  if (!view) throw new Error("DOM motion document has no browsing context");
  const parts = bindings.map((binding) => {
    const matches = doc.querySelectorAll<HTMLElement>(binding.selector);
    if (matches.length !== 1)
      throw new Error(
        `DOM motion selector must match one element: ${binding.id}`,
      );
    const matched = matches[0];
    if (!matched)
      throw new Error(`DOM motion selector has no element: ${binding.id}`);
    const source = binding.closest
      ? matched.closest<HTMLElement>(binding.closest)
      : matched;
    if (!source || !source.style || source.getBoundingClientRect().width <= 0)
      throw new Error(`DOM motion binding is not visible: ${binding.id}`);
    const matchesParts = binding.parts
      ? Array.from(source.querySelectorAll<HTMLElement>(binding.parts))
      : [];
    if (matchesParts.length > 256)
      throw new Error("DOM motion element budget exceeded");
    const candidates = matchesParts.filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = view.getComputedStyle(element);
      return (
        !!element.style &&
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden"
      );
    });
    const children = candidates.filter(
      (element) =>
        !candidates.some(
          (other) => other !== element && other.contains(element),
        ),
    );
    const childNodes = children.map((element) => ({
      element,
      style: element.getAttribute("style"),
    }));
    return {
      binding,
      source,
      width: view.getComputedStyle(source).width,
      height: view.getComputedStyle(source).height,
      style: source.getAttribute("style"),
      children: childNodes,
      backgrounds: readDomMotionBackgrounds(source, childNodes),
    };
  });
  for (const [i, part] of parts.entries()) {
    if (
      parts.some(
        (other, j) =>
          i !== j &&
          (other.source.contains(part.source) ||
            part.source.contains(other.source)),
      )
    )
      throw new Error("DOM motion bindings must not overlap");
  }
  if (parts.reduce((count, part) => count + part.children.length, 0) > 256)
    throw new Error("DOM motion element budget exceeded");
  return parts;
}
export function restoreDomMotionNode(node: DomMotionNode): void {
  node.element.setAttribute("style", node.style ?? "");
  if (node.style === null) node.element.removeAttribute("style");
}
export function restoreDomMotionPart(part: DomMotionPart): void {
  part.backgrounds.forEach(restoreDomMotionNode);
  restoreDomMotionNode({ element: part.source, style: part.style });
  for (const child of part.children) restoreDomMotionNode(child);
}
