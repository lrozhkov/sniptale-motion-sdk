import * as React from "react";

export function createReactFacade() {
  return Object.freeze({
    ...React,
    Fragment: React.Fragment,
    createElement: React.createElement,
    renderToSvg(element) {
      return renderElement(element);
    },
  });
}

function renderElement(node) {
  if (node === null || node === undefined || node === false) {
    return "";
  }
  if (Array.isArray(node)) {
    return node.map(renderElement).join("");
  }
  if (typeof node === "string" || typeof node === "number") {
    return escapeText(String(node));
  }
  if (node.type === React.Fragment) {
    return renderElement(node.props?.children);
  }
  if (typeof node.type === "function") {
    return renderElement(node.type(node.props ?? {}));
  }
  if (typeof node.type !== "string") {
    return "";
  }
  const attrs = Object.entries(node.props ?? {})
    .filter(
      ([key, value]) =>
        key !== "children" &&
        value !== false &&
        value !== null &&
        value !== undefined,
    )
    .map(([key, value]) => `${toKebab(key)}="${escapeAttr(String(value))}"`)
    .join(" ");
  const children = renderElement(node.props?.children);
  return `<${node.type}${attrs ? ` ${attrs}` : ""}>${children}</${node.type}>`;
}

function escapeAttr(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function escapeText(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function toKebab(value) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
