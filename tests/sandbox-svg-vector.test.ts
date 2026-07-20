import { afterEach, describe, expect, it, vi } from "vitest";

import { createSvgPartTransform } from "../src/apps/sandbox/runtime/svg-part-transform";
import {
  parseSvgAsset,
  serializeSvgVectorAsset,
} from "../src/apps/sandbox/runtime/svg-vector-parser";
import { drawSvgVectorAsset } from "../src/apps/sandbox/runtime/svg-vector-renderer";

const originalDomParser = globalThis.DOMParser;
const originalPath2D = globalThis.Path2D;

describe("sandbox SVG vector owners", () => {
  afterEach(() => {
    globalThis.DOMParser = originalDomParser;
    globalThis.Path2D = originalPath2D;
  });

  it("parses SVG vector parts with inherited state and cache", () => {
    let parseCalls = 0;
    installSvgGlobals(() => {
      parseCalls += 1;
      return createSvgDocument(
        node("svg", { viewBox: "0 0 120 80" }, [
          node("g", { fill: "#abc", id: "logo", opacity: "0.5" }, [
            node("rect", {
              height: "10",
              rx: "2",
              stroke: "#123",
              width: "20",
              x: "5",
              y: "6",
            }),
            node("path", {
              d: "M0 0 L10 10",
              fill: "url(#grad)",
              "fill-opacity": "0.5",
              id: "spark",
              stroke: "#fff",
              "stroke-linecap": "round",
              "stroke-width": "3",
            }),
          ]),
        ]),
      );
    });

    const asset = {
      height: 1,
      id: "logo",
      svgText: "<svg><g><rect/><path/></g></svg>",
      width: 1,
    };
    const parsed = parseSvgAsset(asset);
    const cached = parseSvgAsset(asset);

    expect(cached).toBe(parsed);
    expect(parseCalls).toBe(1);
    expect(parsed.width).toBe(120);
    expect(parsed.height).toBe(80);
    expect(parsed.parts).toMatchObject([
      {
        cx: 15,
        cy: 11,
        fill: "#abc",
        groupId: "logo",
        groupIds: ["logo"],
        height: 10,
        id: "logo.rect-0",
        opacity: 0.5,
        rx: 2,
        stroke: "#123",
        type: "rect",
        width: 20,
        x: 5,
        y: 6,
      },
      {
        fill: "#f4fbff",
        id: "spark",
        opacity: 0.25,
        stroke: "#fff",
        strokeLineCap: "round",
        strokeWidth: 3,
        type: "path",
      },
    ]);
    expect(serializeSvgVectorAsset(asset)).toMatchObject({
      height: 80,
      parts: [
        { id: "logo.rect-0", type: "rect" },
        { id: "spark", pathData: "M0 0 L10 10", type: "path" },
      ],
      width: 120,
    });
  });

  it("hydrates a serialized SVG vector without DOMParser", () => {
    globalThis.Path2D = vi.fn(function Path2DStub(this: any, d: string) {
      this.d = d;
    }) as any;
    globalThis.DOMParser = undefined as any;

    const parsed = parseSvgAsset({
      cacheKey: "worker-vector-v1",
      id: "worker-vector",
      svgText: "<svg />",
      svgVector: {
        height: 50,
        parts: [
          {
            cx: 5,
            cy: 5,
            fill: "#fff",
            groupId: null,
            groupIds: [],
            id: "path-a",
            opacity: 1,
            pathData: "M0 0 L10 10",
            stroke: null,
            strokeLineCap: "butt",
            strokeLineJoin: "miter",
            strokeWidth: 1,
            type: "path",
          },
        ],
        width: 100,
      },
    });

    expect(parsed.parts[0].path).toMatchObject({ d: "M0 0 L10 10" });
  });

  it("renders SVG vector parts with filters, transforms, and part filters", () => {
    installSvgGlobals(() =>
      createSvgDocument(
        node("svg", { viewBox: "0 0 100 50" }, [
          node("rect", {
            fill: "#fff",
            height: "10",
            id: "target",
            width: "20",
            x: "1",
            y: "2",
          }),
          node("rect", {
            fill: "#f00",
            height: "10",
            id: "skip",
            width: "20",
            x: "30",
            y: "2",
          }),
        ]),
      ),
    );
    const context = createCanvasContextSpy();

    drawSvgVectorAsset(
      context,
      {
        id: "render",
        svgText: "<svg><rect/><rect/></svg>",
      },
      {
        alpha: 0.5,
        height: 100,
        partIds: ["target"],
        partTransform: () => ({
          alpha: 0.75,
          filter: "blur(2px)",
          rotate: 0.25,
          scale: 1.2,
          x: 3,
          y: 4,
        }),
        width: 200,
        x: 8,
        y: 9,
      },
      vi.fn(),
    );

    expect(context.translate.mock.calls[0]).toEqual([8, 9]);
    expect(context.scale.mock.calls[0]).toEqual([2, 2]);
    expect(context.globalAlpha).toBe(0.375);
    expect(context.filter).toBe("blur(2px)");
    expect(context.fillStyle).toBe("#fff");
    expect(context.fill).toHaveBeenCalledOnce();
    expect(context.restore).toHaveBeenCalledTimes(2);
  });

  it("falls back to bitmap drawing when vector parsing is unavailable", () => {
    globalThis.Path2D = undefined as any;
    const fallback = vi.fn();

    drawSvgVectorAsset(
      createCanvasContextSpy(),
      { id: "bitmap", svgText: "<svg />" },
      { x: 1 },
      fallback,
    );

    expect(fallback).toHaveBeenCalledOnce();
  });

  it("renders a serialized worker vector without retaining source SVG text", () => {
    installSvgGlobals(() => createSvgDocument(node("svg", {}, [])));
    const context = createCanvasContextSpy();
    const fallback = vi.fn();

    drawSvgVectorAsset(
      context,
      {
        id: "worker-vector",
        svgVector: {
          height: 10,
          parts: [
            {
              fill: "#fff",
              groupId: null,
              groupIds: [],
              height: 10,
              id: "tile",
              opacity: 1,
              rx: 0,
              stroke: null,
              strokeLineCap: "butt",
              strokeLineJoin: "miter",
              strokeWidth: 1,
              type: "rect",
              width: 10,
              x: 0,
              y: 0,
              cx: 5,
              cy: 5,
            },
          ],
          width: 10,
        },
      },
      { height: 10, width: 10 },
      fallback,
    );

    expect(fallback).not.toHaveBeenCalled();
    expect(context.fill).toHaveBeenCalledOnce();
  });

  it("creates deterministic SVG part transforms", () => {
    const transform = createSvgPartTransform({
      blur: 4,
      mode: "scatter",
      order: "reverse",
      reveal: 0.5,
      rotate: 0.4,
      scaleFrom: 0.8,
      spread: 20,
      stagger: 0.4,
    });

    const first = transform({ cx: 10, cy: 20 }, 0, { parts: [{}, {}, {}] });
    const second = transform({ cx: 10, cy: 20 }, 0, { parts: [{}, {}, {}] });

    expect(first).toEqual(second);
    expect(first.alpha).toBeGreaterThan(0);
    expect(first.alpha).toBeLessThan(1);
    expect(first.filter).toMatch(/^blur\(/);
    expect(first.originX).toBe(10);
    expect(first.originY).toBe(20);
    expect(first.rotate).toBeLessThan(0);
  });

  it("orders SVG part transforms across supported reveal modes", () => {
    const parsed = { parts: [{}, {}, {}, {}, {}] };
    const alphaFor = (order: string, index: number, parts = parsed.parts) =>
      createSvgPartTransform({
        ease: "linear",
        order,
        reveal: 0.5,
        scaleFrom: 1,
        stagger: 0.8,
      })({}, index, { parts }).alpha;

    expect(alphaFor("reverse", 4)).toBeGreaterThan(alphaFor("reverse", 0));
    expect(alphaFor("center", 2)).toBeGreaterThan(alphaFor("center", 0));
    expect(alphaFor("edges", 0)).toBeGreaterThan(alphaFor("edges", 2));
    expect(alphaFor("random", 3)).toBe(alphaFor("random", 3));
    expect(alphaFor("document", 0, [{}])).toBe(0.5);
  });
});

function installSvgGlobals(createDocument: () => any) {
  globalThis.Path2D = vi.fn(function Path2DStub(this: any, d: string) {
    this.d = d;
  }) as any;
  globalThis.DOMParser = class DOMParserStub {
    parseFromString() {
      return createDocument();
    }
  } as any;
}

function createSvgDocument(root: any) {
  return {
    documentElement: root,
    querySelector: () => null,
  };
}

function node(tagName: string, attrs: Record<string, string>, children = []) {
  return {
    children,
    getAttribute(name: string) {
      return attrs[name] ?? null;
    },
    tagName,
  };
}

function createCanvasContextSpy(): any {
  return {
    arcTo: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillStyle: "",
    filter: "none",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    lineCap: "butt",
    lineJoin: "miter",
    lineWidth: 1,
    moveTo: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    shadowBlur: 0,
    shadowColor: "transparent",
    stroke: vi.fn(),
    strokeStyle: "",
    translate: vi.fn(),
  };
}
