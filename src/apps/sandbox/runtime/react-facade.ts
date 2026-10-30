import * as React from "react";

export function createReactFacade() {
  return Object.freeze({
    ...React,
    Fragment: React.Fragment,
    createElement: React.createElement,
    renderToSvg(element: unknown): string {
      return renderElement(element);
    },
  });
}

function renderElement(node: unknown): string {
  if (node === null || node === undefined || node === false) {
    return "";
  }
  if (Array.isArray(node)) {
    return node.map(renderElement).join("");
  }
  if (typeof node === "string" || typeof node === "number") {
    return escapeText(String(node));
  }
  if (!isRecord(node)) return "";
  const props = isRecord(node.props) ? node.props : {};
  if (node.type === React.Fragment) {
    return renderElement(props.children);
  }
  if (typeof node.type === "function") {
    return renderElement(node.type(props));
  }
  if (typeof node.type !== "string") {
    return "";
  }
  const attrs = Object.entries(props)
    .filter(
      ([key, value]) =>
        key !== "children" &&
        value !== false &&
        value !== null &&
        value !== undefined,
    )
    .map(([key, value]) => `${toKebab(key)}="${escapeAttr(String(value))}"`)
    .join(" ");
  const children = renderElement(props.children);
  return `<${node.type}${attrs ? ` ${attrs}` : ""}>${children}</${node.type}>`;
}

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function toKebab(value: string): string {
  return value.replace(/[A-Z]/g, (match: string) => `-${match.toLowerCase()}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
