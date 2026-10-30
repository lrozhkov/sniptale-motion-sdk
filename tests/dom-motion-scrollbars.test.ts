import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, type Browser } from "@playwright/test";
import { parseDomMotionTimeline } from "../src/sdk/dom-motion/validation.js";

let browser: Browser;
let bundle: string;
beforeAll(async () => {
  bundle = (
    await build({
      entryPoints: ["src/sdk/dom-motion/index.ts"],
      bundle: true,
      write: false,
      format: "iife",
      globalName: "MotionSDK",
      platform: "browser",
    })
  ).outputFiles[0].text;
  browser = await chromium.launch();
}, 30000);
afterAll(async () => {
  await browser?.close();
});
const track = (value: number) => ({
  id: "page.scrollbarOpacity",
  target: "page",
  property: "scrollbarOpacity",
  keyframes: [{ time: 0, value }],
});

describe("DOM motion native scrollbars", () => {
  it("validates page-owned, bounded transparency", () => {
    for (const value of [0, 0.5, 1])
      expect(
        parseDomMotionTimeline(
          { phases: [], tracks: [track(value)] },
          6,
          new Set(["page"]),
        ).tracks,
      ).toHaveLength(1);
    for (const value of [-0.01, 1.01, NaN, Infinity])
      expect(() =>
        parseDomMotionTimeline(
          { phases: [], tracks: [track(value)] },
          6,
          new Set(["page"]),
        ),
      ).toThrow();
  });
  it("suppresses flight overflow and reveals real scrollbars deterministically after assembly", async () => {
    const page = await browser.newPage({
      viewport: { width: 400, height: 240 },
    });
    try {
      await page.setContent(
        '<div id="host" style="position:fixed;inset:0"></div>',
      );
      await page.addScriptTag({ content: bundle });
      await page.evaluate(async () => {
        const runtime = window as any;
        runtime.surface = runtime.MotionSDK.createDomMotionSurface(
          document.getElementById("host"),
          {
            schemaVersion: "sniptale.dom-motion.v1",
            id: "scroll-demo",
            label: { ru: "Прокрутка", en: "Scrolling" },
            duration: 6,
            width: 400,
            height: 240,
            html: '<!doctype html><style>body{margin:0}.scroll{height:200px;overflow:auto;scrollbar-color:rgb(40,80,120) rgb(230,240,250)}#panel{height:500px}</style><div class="scroll"><section id="panel">Содержимое</section></div>',
            bindings: [
              {
                id: "panel",
                label: { ru: "Панель", en: "Panel" },
                selector: "#panel",
                stagger: 0,
                depth: 100,
                spread: -1500,
              },
            ],
            timeline: {
              phases: [],
              tracks: [
                {
                  id: "panel.assembly",
                  target: "panel",
                  property: "assembly",
                  keyframes: [
                    { time: 0, value: 0 },
                    { time: 5, value: 1 },
                  ],
                },
                {
                  id: "page.scrollbarOpacity",
                  target: "page",
                  property: "scrollbarOpacity",
                  keyframes: [
                    { time: 0, value: 0, easing: "hold" },
                    { time: 5, value: 0 },
                    { time: 6, value: 1 },
                  ],
                },
              ],
            },
          },
        );
        await runtime.surface.ready;
      });
      const proof = await page.evaluate(() => {
        const s = (window as any).surface,
          d = s.frame.contentDocument,
          node = d.querySelector(".scroll"),
          root = d.documentElement;
        const original = node.getAttribute("style"),
          originalColor = d.defaultView.getComputedStyle(node).scrollbarColor;
        const snapshot = (time: number) => {
          s.render(time);
          return {
            color: d.defaultView.getComputedStyle(node).scrollbarColor,
            overflow: root.style.overflow,
            width: node.offsetWidth,
            height: node.offsetHeight,
            scrollHeight: node.scrollHeight,
          };
        };
        const during = snapshot(3.747),
          hidden = snapshot(5),
          half = snapshot(5.5),
          full = snapshot(6),
          restored = node.getAttribute("style");
        const replay = snapshot(5.5);
        s.render(6);
        return {
          during,
          hidden,
          half,
          full,
          restored,
          original,
          originalColor,
          replay,
          reads: s.bindingReads.tracks,
        };
      });
      expect(proof.during.overflow).toBe("hidden");
      expect(proof.hidden.overflow).toBe("");
      expect(proof.hidden.color).toContain("/ 0)");
      expect(proof.half.color).toContain("/ 0.5)");
      expect(proof.full.color).toBe(proof.originalColor);
      expect(proof.restored).toBe(proof.original);
      expect(proof.replay).toEqual(proof.half);
      expect(proof.full.width).toBe(proof.half.width);
      expect(proof.full.scrollHeight).toBe(proof.half.scrollHeight);
      expect(proof.reads).toContain("page.scrollbarOpacity");
    } finally {
      await page.close();
    }
  });
});
