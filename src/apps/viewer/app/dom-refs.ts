export function requireHtml<Tag extends keyof HTMLElementTagNameMap>(
  selector: string,
  tag: Tag,
): HTMLElementTagNameMap[Tag] {
  const element = document.querySelector(selector);
  if (!isHtmlTag(element, tag))
    throw new Error(`Expected viewer element ${selector} to be <${tag}>.`);
  return element;
}

export function queryHtml<Tag extends keyof HTMLElementTagNameMap>(
  selector: string,
  tag: Tag,
): HTMLElementTagNameMap[Tag][] {
  return Array.from(document.querySelectorAll(selector), (element) => {
    if (!isHtmlTag(element, tag))
      throw new Error(`Expected viewer element ${selector} to be <${tag}>.`);
    return element;
  });
}

export function requireSvg(selector: string): SVGSVGElement {
  const element = document.querySelector(selector);
  if (!(element instanceof SVGSVGElement))
    throw new Error(`Expected viewer element ${selector} to be <svg>.`);
  return element;
}

function isHtmlTag<Tag extends keyof HTMLElementTagNameMap>(
  element: Element | null,
  tag: Tag,
): element is HTMLElementTagNameMap[Tag] {
  return element instanceof HTMLElement && element.localName === tag;
}
