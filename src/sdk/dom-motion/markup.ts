const CONTENT_POLICY =
  "default-src 'none'; script-src 'none'; connect-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline' data:; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

/** Parse in an inert template, before the browser can load untrusted resources. */
export function prepareDomMotionMarkup(html: string, owner: Document): string {
  const rootAttributes = readRootAttributes(html, "html", owner);
  const bodyAttributes = readRootAttributes(html, "body", owner);
  const template = owner.createElement("template");
  template.innerHTML = html;
  template.content
    .querySelectorAll(
      "script, iframe, frame, frameset, object, embed, base, meta, portal, noscript, template",
    )
    .forEach((e) => e.remove());
  for (const element of Array.from(template.content.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (
        name.startsWith("on") ||
        [
          "srcdoc",
          "action",
          "formaction",
          "target",
          "download",
          "ping",
          "autofocus",
        ].includes(name)
      )
        element.removeAttribute(attribute.name);
      if (
        ["src", "href", "xlink:href", "poster"].includes(name) &&
        !attribute.value.startsWith("data:") &&
        !attribute.value.startsWith("#")
      )
        element.removeAttribute(attribute.name);
      if (["srcset", "imagesrcset"].includes(name))
        element.removeAttribute(attribute.name);
    }
  }
  const policy = owner.createElement("meta");
  policy.httpEquiv = "Content-Security-Policy";
  policy.content = CONTENT_POLICY;
  return `<!doctype html><html${rootAttributes}><head>${policy.outerHTML}</head><body${bodyAttributes}>${template.innerHTML}</body></html>`;
}

function readRootAttributes(
  html: string,
  tag: "html" | "body",
  owner: Document,
): string {
  const pattern = new RegExp(`<${tag}\\b((?:[^>"']|"[^\"]*"|'[^']*')*)>`, "i");
  const attributes = pattern.exec(html)?.[1] ?? "";
  const holder = owner.createElement("template");
  holder.innerHTML = `<div${attributes}></div>`;
  const element = holder.content.firstElementChild;
  if (!element) return "";
  const safe = owner.createElement("div");
  for (const attribute of Array.from(element.attributes)) {
    if (
      ["id", "class", "style", "lang", "dir", "xmlns"].includes(
        attribute.name,
      ) ||
      attribute.name.startsWith("data-")
    )
      safe.setAttribute(attribute.name, attribute.value);
  }
  return safe.outerHTML.slice(4, safe.outerHTML.indexOf(">"));
}
