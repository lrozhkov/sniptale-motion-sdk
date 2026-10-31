import { requiredEntry } from "./helpers/required-entry";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { expect, it } from "vitest";

it("keeps an assembled element in its held foreground pose until its independent flight ends", async () => {
  const bundle = requiredEntry(
    (
      await build({
        entryPoints: ["src/sdk/dom-motion/index.ts"],
        bundle: true,
        write: false,
        format: "iife",
        globalName: "MotionSDK",
      })
    ).outputFiles,
    0,
  ).text;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 400, height: 240 },
    });
    await page.setContent(
      '<div id="host" style="position:relative;width:400px;height:240px"></div>',
    );
    await page.addScriptTag({ content: bundle });
    const proof = await page.evaluate(async () => {
      const runtime = window;
      const host = document.getElementById("host");
      if (!host) throw new Error("DOM motion host is missing.");
      const flight = (property: string, value: number, final = 0) => ({
        id: `brand.${property}`,
        target: "brand",
        property,
        keyframes: [
          { time: 0, value, easing: "hold" },
          { time: 8, value, easing: "inOut" },
          { time: 10, value: final },
        ],
      });
      const surface = runtime.MotionSDK.createDomMotionSurface(host, {
        schemaVersion: "sniptale.dom-motion.v1",
        id: "brand-flight",
        label: { ru: "Логотип", en: "Logo" },
        duration: 10,
        width: 400,
        height: 240,
        html: '<style>body{margin:0}header{height:40px}#brand{display:inline-block;width:80px;height:30px}</style><header><a id="brand" style="color:#333">SD Pro</a></header><main>Алтайский рассвет</main>',
        bindings: [
          {
            id: "brand",
            label: { ru: "Логотип", en: "Logo" },
            selector: "#brand",
            stagger: 0,
            depth: 0,
            spread: 0,
          },
        ],
        timeline: {
          phases: [],
          tracks: [
            flight("assembly", 1, 1),
            flight("x", 130),
            flight("y", 90),
            flight("z", 300),
            flight("scale", 2, 1),
          ],
        },
      });
      await surface.ready;
      const doc = surface.frame.contentDocument;
      if (!doc) throw new Error("DOM motion frame is not loaded.");
      const node = doc.getElementById("brand");
      if (!node) throw new Error("Brand fixture is missing.");
      const initial = node.getAttribute("style");
      surface.render(3);
      const held = {
        transform: node.style.transform,
        camera: doc.body.style.transformStyle,
        reads: surface.bindingReads.tracks,
      };
      surface.render(7);
      const heldAgain = node.style.transform;
      surface.render(9);
      const landing = node.style.transform;
      surface.render(10);
      const restored = {
        style: node.getAttribute("style"),
        camera: doc.body.style.transform,
        same: doc.getElementById("brand") === node,
      };
      surface.render(3);
      const replay = node.style.transform;
      surface.dispose();
      return {
        initial,
        held,
        heldAgain,
        landing,
        restored,
        replay,
        mounted: document.getElementById("host")!.children.length,
      };
    });
    expect(proof.held.transform).toContain("translate3d(130px, 90px, 302px)");
    expect(proof.held.transform).toContain("scale(2)");
    expect(proof.held.camera).toBe("preserve-3d");
    expect(proof.held.reads.sort()).toEqual([
      "brand.assembly",
      "brand.scale",
      "brand.x",
      "brand.y",
      "brand.z",
    ]);
    expect(proof.heldAgain).toBe(proof.held.transform);
    expect(proof.landing).not.toBe(proof.held.transform);
    expect(proof.restored).toEqual({
      style: proof.initial,
      camera: "",
      same: true,
    });
    expect(proof.replay).toBe(proof.held.transform);
    expect(proof.mounted).toBe(0);
  } finally {
    await browser.close();
  }
}, 30000);
