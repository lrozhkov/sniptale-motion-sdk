import { requiredEntry } from "./helpers/required-entry";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "@playwright/test";

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
const html =
  '<!doctype html><html lang="ru"><head><style>body{margin:0;background:#edf2f8;font:14px Arial}.page{padding:20px}section{padding:16px;background:white;overflow:hidden}h2,p,input{float:left;clear:both}h2{font-size:18px;margin:0 0 12px}p{margin:0}input{width:180px}</style></head><body class="retreat"><main class="page"><section id="trip" style="border-radius:8px"><div class="details" style="background:white;overflow:hidden;box-shadow:4px 4px 8px #edf2f8"><h2>Алтайский рассвет</h2><p>Елена Морозова</p><input value="12–26 ноября 2026"></div></section></main></body></html>';
function documentSource(sourceHtml = html) {
  return {
    schemaVersion: "sniptale.dom-motion.v1",
    id: "retreat",
    label: { ru: "Отдых", en: "Retreat" },
    duration: 10,
    width: 400,
    height: 240,
    html: sourceHtml,
    bindings: [
      {
        id: "trip",
        label: { ru: "Поездка", en: "Trip" },
        selector: "#trip",
        parts: "h2,p,input",
        stagger: 0.2,
        depth: 100,
        spread: 20,
        tiltY: 12,
        partLift: 80,
        partDelay: 0.2,
      },
    ],
    timeline: {
      phases: [],
      tracks: [
        {
          id: "page.rotateY",
          target: "page",
          property: "rotateY",
          keyframes: [
            { time: 0, value: -18 },
            { time: 8, value: 0 },
          ],
        },
        {
          id: "trip.assembly",
          target: "trip",
          property: "assembly",
          keyframes: [
            { time: 0, value: 0 },
            { time: 8, value: 1 },
          ],
        },
      ],
    },
  };
}
async function mount(page: Page, source = documentSource()) {
  await page.setContent(
    '<div id="host" style="position:relative;width:400px;height:240px"></div>',
  );
  await page.addScriptTag({ content: bundle });
  await page.evaluate(async (input) => {
    const runtime = window;
    const host = document.getElementById("host");
    if (!host) throw new Error("DOM motion host is missing.");
    runtime.surface = runtime.MotionSDK.createDomMotionSurface(host, input);
    await runtime.surface.ready;
  }, source);
}
describe("live HTML SDK surface", () => {
  it("animates the original controls, preserves node identity and exactly restores the final page", async () => {
    const page = await browser.newPage({
      viewport: { width: 400, height: 240 },
    });
    try {
      await page.setContent(html);
      const expected = await page.screenshot();
      await mount(page);
      const proof = await page.evaluate(() => {
        const s = window.surface;
        const d = s.frame.contentDocument;
        if (!d || !d.defaultView)
          throw new Error("DOM motion frame is not loaded.");
        const realm = d.defaultView;
        const htmlElement = (selector: string) => {
          const element = d.querySelector(selector);
          if (!(element instanceof realm.HTMLElement))
            throw new Error(`Expected HTML element ${selector}.`);
          return element;
        };
        const nodes = [...d.querySelectorAll("*")],
          styles = nodes.map((n) => n.getAttribute("style"));
        const sourceHeight = htmlElement("#trip").offsetHeight;
        s.render(3);
        const during = {
          same: nodes.every((n) => n.isConnected),
          count: d.querySelectorAll("*").length,
          nodeCount: nodes.length,
          heading: htmlElement("h2").style.transform,
          panel: htmlElement("#trip").style.transform,
          value: (() => {
            const input = d.querySelector("input");
            if (!input) throw new Error("Source input is missing.");
            return input.value;
          })(),
          elements: s.elementCount,
          heightPreserved: htmlElement("#trip").offsetHeight === sourceHeight,
          background: d.defaultView.getComputedStyle(htmlElement("#trip"))
            .backgroundColor,
          innerDepth: htmlElement(".details").style.transformStyle,
          innerShadow: d.defaultView.getComputedStyle(htmlElement(".details"))
            .boxShadow,
          innerDisplay: d.defaultView.getComputedStyle(htmlElement(".details"))
            .display,
          headingLift: new d.defaultView.DOMMatrixReadOnly(
            d.defaultView.getComputedStyle(htmlElement("h2")).transform,
          ).m42,
          levels: ["h2", "p", "input"].map(
            (selector) => htmlElement(selector).style.transform,
          ),
        };
        s.render(6);
        const laterBackground = d.defaultView.getComputedStyle(
          htmlElement("#trip"),
        ).backgroundColor;
        s.render(8);
        const panelBeforeText = {
          camera: d.body.style.transformStyle,
          heading: htmlElement("h2").style.transform,
          background: d.defaultView.getComputedStyle(htmlElement("#trip"))
            .backgroundColor,
        };
        s.render(10);
        const restored = nodes
          .map((node, i) => ({
            tag: node.tagName,
            before: styles[i],
            after: node.getAttribute("style"),
          }))
          .filter((item) => item.before !== item.after);
        s.setVisibleTargets(["page"]);
        s.render(10);
        const gated = htmlElement("#trip").style.visibility;
        s.setVisibleTargets(["page", "trip"]);
        s.render(10);
        return {
          during,
          laterBackground,
          panelBeforeText,
          restored,
          gated,
          bodyClass: d.body.className,
          camera: d.body.style.transform || "none",
          reads: s.bindingReads,
        };
      });
      expect(proof.during.same).toBe(true);
      expect(proof.during.count).toBe(proof.during.nodeCount);
      expect(proof.during.heading).toContain("translate3d");
      expect(proof.during.panel).toContain("translate3d");
      expect(proof.during.panel).toContain("rotateY(7.5deg)");
      expect(proof.during.value).toBe("12–26 ноября 2026");
      expect(proof.during.elements).toBe(4);
      expect(proof.during.heightPreserved).toBe(true);
      expect(proof.during.innerDepth).toBe("preserve-3d");
      expect(proof.during.innerShadow).toBe("none");
      expect(proof.during.innerDisplay).toBe("flow-root");
      expect(proof.during.headingLift).toBe(-52);
      expect(proof.panelBeforeText.camera).toBe("preserve-3d");
      expect(proof.panelBeforeText.heading).toContain("translate3d");
      expect(proof.panelBeforeText.background).toBe("color(srgb 1 1 1)");
      const alpha = (color: string) =>
        Number(color.match(/\/\s*([\d.]+)\)/)?.[1]);
      expect(alpha(proof.during.background)).toBeGreaterThan(0);
      expect(alpha(proof.during.background)).toBeLessThan(0.5);
      expect(alpha(proof.laterBackground)).toBeGreaterThan(
        alpha(proof.during.background),
      );
      expect(new Set(proof.during.levels).size).toBe(3);
      expect(proof.restored).toEqual([]);
      expect(proof.gated).toBe("hidden");
      expect(proof.bodyClass).toBe("retreat");
      expect(proof.camera).toBe("none");
      expect(proof.reads.tracks.sort()).toEqual([
        "page.rotateY",
        "trip.assembly",
      ]);
      expect(await page.locator("iframe").screenshot()).toEqual(expected);
    } finally {
      await page.close();
    }
  });
  it("blocks source scripts, event handlers, remote resources and navigation payloads", async () => {
    const page = await browser.newPage();
    const remote: string[] = [];
    const responses: string[] = [];
    const cspFailures: string[] = [];
    const protocol = await page.context().newCDPSession(page);
    await protocol.send("Network.enable");
    protocol.on("Network.loadingFailed", (event) => {
      if (event.blockedReason === "csp") cspFailures.push(event.requestId);
    });
    page.on("response", (response) => {
      if (response.url().includes("motion-invalid.example"))
        responses.push(response.url());
    });
    page.on("request", (request) => {
      if (request.url().includes("motion-invalid.example"))
        remote.push(request.url());
    });
    try {
      await mount(
        page,
        documentSource(
          html.replace(
            "</section>",
            '<script>parent.compromised=true</script><img src="https://motion-invalid.example/image" onerror="parent.compromised=true"><link rel="stylesheet" href="https://motion-invalid.example/style"><style>@import "https://motion-invalid.example/import";</style><a href="javascript:parent.compromised=true">Открыть</a><iframe srcdoc="<script>parent.compromised=true</script>"></iframe><form action="https://motion-invalid.example/submit"></form></section>',
          ),
        ),
      );
      const result = await page.evaluate(() => {
        const d = window.surface.frame.contentDocument;
        if (!d) throw new Error("DOM motion frame is not loaded.");
        return {
          compromised: "compromised" in window && window.compromised === true,
          active: d.querySelectorAll("script,iframe,[onerror],[action]").length,
          href: d.querySelector("a")?.getAttribute("href"),
          policy: [...d.querySelectorAll("meta")].find(
            (meta) => meta.httpEquiv === "Content-Security-Policy",
          )?.content,
        };
      });
      expect(result.compromised).toBe(false);
      expect(result.active).toBe(0);
      expect(result.href).toBeNull();
      expect(result.policy).toContain("connect-src 'none'");
      expect(responses).toEqual([]);
      expect(cspFailures.length).toBe(remote.length);
    } finally {
      await page.close();
    }
  });
  it("rejects overlapping bindings and stale/unready surfaces without leaving mounted DOM", async () => {
    const page = await browser.newPage();
    try {
      await mount(page);
      expect(
        await page.evaluate(async (input) => {
          const runtime = window,
            host = document.getElementById("host")!;
          runtime.surface.dispose();
          const s = runtime.MotionSDK.createDomMotionSurface(host, input);
          const pending = s.ready.catch((error: Error) => error.message);
          let unready = "";
          try {
            s.render(0);
          } catch (error) {
            unready = String(error);
          }
          s.dispose();
          return {
            unready,
            rejected: await pending,
            mounted: host.children.length,
          };
        }, documentSource()),
      ).toEqual({
        unready: "Error: DOM motion surface is not ready",
        rejected: "DOM motion surface disposed",
        mounted: 0,
      });
      const input = documentSource();
      input.bindings.push({
        ...requiredEntry(input.bindings, 0),
        id: "duplicate",
      });
      input.timeline.tracks.push({
        ...requiredEntry(input.timeline.tracks, 1),
        id: "duplicate.assembly",
        target: "duplicate",
      });
      expect(
        await page.evaluate(async (source) => {
          const host = document.getElementById("host");
          if (!host) throw new Error("DOM motion host is missing.");
          const s = window.MotionSDK.createDomMotionSurface(host, source);
          try {
            await s.ready;
            return "accepted";
          } catch (error) {
            return String(error);
          } finally {
            s.dispose();
          }
        }, input),
      ).toContain("must not overlap");
    } finally {
      await page.close();
    }
  });
});
