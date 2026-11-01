import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requireHtml,
  queryHtml,
  requireSvg,
} from "../src/apps/viewer/app/dom-refs.js";

class HtmlElementStub {
  constructor(public localName: string) {}
}
class SvgRootStub {
  localName = "svg";
}

afterEach(() => vi.unstubAllGlobals());

function installElements(value: unknown, values: unknown[] = []) {
  vi.stubGlobal("HTMLElement", HtmlElementStub);
  vi.stubGlobal("SVGSVGElement", SvgRootStub);
  const querySelector = vi.fn<(selector: string) => unknown>(() => value);
  vi.stubGlobal("document", {
    querySelector,
    querySelectorAll: vi.fn<() => unknown[]>(() => values),
  });
  return querySelector;
}

describe("viewer DOM receiving boundary", () => {
  it("preserves a matching HTML element and parses every list entry", () => {
    const input = new HtmlElementStub("input");
    const querySelector = installElements(input, [input]);
    expect(requireHtml("#input", "input")).toBe(input);
    expect(queryHtml("input", "input")).toEqual([input]);
    expect(querySelector).toHaveBeenCalledWith("#input");
  });

  it.each([
    null,
    new HtmlElementStub("div"),
    new SvgRootStub(),
    { localName: "input" },
  ])("rejects a missing or wrong native element %#", (value) => {
    installElements(value);
    expect(() => requireHtml("#input", "input")).toThrow(
      "Expected viewer element #input to be <input>.",
    );
  });

  it("rejects a wrong type inside a list", () => {
    installElements(null, [
      new HtmlElementStub("button"),
      new HtmlElementStub("div"),
    ]);
    expect(() => queryHtml("[data-tab]", "button")).toThrow(
      "Expected viewer element [data-tab] to be <button>.",
    );
  });

  it("keeps optional empty collections and requires a real SVG root", () => {
    const svg = new SvgRootStub();
    installElements(svg);
    expect(requireSvg("#overlay")).toBe(svg);
    expect(queryHtml("[data-tab]", "button")).toEqual([]);
    installElements(new HtmlElementStub("div"));
    expect(() => requireSvg("#overlay")).toThrow(
      "Expected viewer element #overlay to be <svg>.",
    );
  });
});
