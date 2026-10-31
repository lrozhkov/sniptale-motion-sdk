import { requiredEntry } from "./helpers/required-entry";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, type Browser } from "@playwright/test";

let browser: Browser;
let bundle: string;
beforeAll(async () => {
  bundle = requiredEntry(
    (
      await build({
        entryPoints: ["src/sdk/dom-motion/index.ts"],
        bundle: true,
        write: false,
        format: "iife",
        globalName: "MotionSDK",
        platform: "browser",
      })
    ).outputFiles,
    0,
  ).text;
  browser = await chromium.launch();
}, 30000);
afterAll(async () => {
  await browser?.close();
});

const profiles = [
  ["LTR gutter", ""],
  ["RTL gutter", ".scroll{direction:rtl}"],
  ["both edges", ".scroll{scrollbar-gutter:stable both-edges}"],
  [
    "content box",
    ".scroll{width:360.5px;padding:4px;border:2px solid #ddd;box-sizing:content-box}",
  ],
  [
    "border box",
    ".scroll{width:360.5px;padding:4px;border:2px solid #ddd;box-sizing:border-box}",
  ],
  ["horizontal scrollbar", ".scroll{overflow-x:scroll}.left{min-width:600px}"],
  [
    "scaled ancestor",
    ".frame{transform:scale(.875);transform-origin:top left}",
  ],
];

describe("DOM motion source scrollport geometry", () => {
  it.each(profiles)(
    "keeps the landed column in its final position: %s",
    async (_name, extraCss) => {
      const page = await browser.newPage({
        viewport: { width: 400, height: 240 },
      });
      try {
        await page.setContent(
          '<div id="host" style="position:fixed;inset:0"></div>',
        );
        await page.addScriptTag({ content: bundle });
        const proof = await page.evaluate(async (css) => {
          const host = document.getElementById("host");
          if (!host) throw new Error("DOM motion host is missing.");
          const s = window.MotionSDK.createDomMotionSurface(host, {
            schemaVersion: "sniptale.dom-motion.v1",
            id: "geometry",
            label: { ru: "Геометрия", en: "Geometry" },
            duration: 6,
            width: 400,
            height: 240,
            html: `<!doctype html><style>html,body{margin:0;height:100%}.frame{height:100%;display:flex;flex-direction:column}.header{height:40px;flex:none}.scroll{flex:1;display:flex;overflow:auto;scrollbar-gutter:stable}.left{flex:0 0 70%}.right{flex:1}#panel{height:500px;background:white}${css}</style><div class="frame"><header class="header">Заголовок</header><main class="scroll"><div class="left">Описание</div><aside class="right"><section id="panel">Состояние</section></aside></main></div>`,
            bindings: [
              {
                id: "panel",
                label: { ru: "Состояние", en: "Status" },
                selector: "#panel",
                stagger: 0,
                depth: 0,
                lift: 0,
                spread: 0,
              },
            ],
            timeline: {
              phases: [],
              tracks: [
                {
                  id: "panel.assembly",
                  target: "panel",
                  property: "assembly",
                  keyframes: [{ time: 0, value: 1 }],
                },
                {
                  id: "page.x",
                  target: "page",
                  property: "x",
                  keyframes: [
                    { time: 0, value: 10 },
                    { time: 5, value: 0 },
                  ],
                },
              ],
            },
          });
          await s.ready;
          const d = s.frame.contentDocument;
          if (!d || !d.defaultView)
            throw new Error("DOM motion frame is not loaded.");
          const realm = d.defaultView;
          const scroller = d.querySelector(".scroll");
          if (!(scroller instanceof realm.HTMLElement))
            throw new Error("Scroll fixture is missing.");
          const nodes = [...d.querySelectorAll("*")],
            styles = nodes.map((n) => n.getAttribute("style"));
          const rect = (n: Element | null) => {
            if (!n) throw new Error("Geometry fixture is missing.");
            const r = n.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          };
          const snapshot = () => ({
            panel: rect(d.getElementById("panel")),
            scroller: rect(scroller),
          });
          const initial = snapshot(),
            gutter =
              scroller.offsetWidth -
              scroller.clientWidth -
              parseFloat(realm.getComputedStyle(scroller).borderLeftWidth) -
              parseFloat(realm.getComputedStyle(scroller).borderRightWidth);
          s.render(4.5);
          d.body.style.transform = "none";
          d.documentElement.style.perspective = "none";
          const landed = snapshot();
          s.render(6);
          const final = snapshot();
          const changed = nodes
            .filter((n, i) => n.getAttribute("style") !== styles[i])
            .map((n) => n.id || n.tagName);
          s.render(4.5);
          d.body.style.transform = "none";
          d.documentElement.style.perspective = "none";
          const replay = snapshot();
          s.dispose();
          return { initial, landed, final, replay, gutter, changed };
        }, extraCss);
        expect(proof.gutter).toBeGreaterThan(0);
        expect(proof.landed.scroller).toEqual(proof.initial.scroller);
        expect(proof.landed.panel.x).toBe(proof.initial.panel.x);
        expect(proof.landed.panel.y).toBe(proof.initial.panel.y);
        expect(proof.landed.panel.height).toBe(proof.initial.panel.height);
        // CSSOM serializes used widths; allow one Chromium layout unit on the width.
        expect(
          Math.abs(proof.landed.panel.width - proof.initial.panel.width),
        ).toBeLessThanOrEqual(1 / 64);
        expect(proof.final).toEqual(proof.initial);
        expect(proof.replay).toEqual(proof.landed);
        expect(proof.changed).toEqual([]);
      } finally {
        await page.close();
      }
    },
  );
});
