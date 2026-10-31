import type { Page } from "@playwright/test";
import type { SmokeRuntime } from "../../../tooling/test/smoke/runtime.ts";
const REQUIRED_KINDS = ["standalone", "targetEffect", "transition"];

export async function assertEffectV1MainFlow({
  page,
  sandboxPort,
  viewerPort,
}: Pick<SmokeRuntime, "page" | "sandboxPort" | "viewerPort">) {
  await page.goto(
    `http://127.0.0.1:${viewerPort}/index.html?sandboxPort=${sandboxPort}`,
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForFunction(() => {
    const state = window.effectsViewer?.getState();
    return Boolean(state?.currentTemplate && state.templates.length > 0);
  });

  const catalog = await page.evaluate(() =>
    [...document.querySelectorAll("#templateSelect option")].map((option) => {
      if (!(option instanceof HTMLOptionElement))
        throw new Error("Effect catalog must contain option elements.");
      return { id: option.value, kind: option.dataset.bundleKind };
    }),
  );
  const kinds = new Set(catalog.map(({ kind }) => kind));
  for (const kind of REQUIRED_KINDS) {
    if (!kinds.has(kind)) {
      throw new Error(`Effect v1 smoke is missing a ${kind} fixture.`);
    }
  }

  const before = await readHealth(page);
  for (const { id } of catalog) {
    await selectEffect(page, id);
    await page.evaluate(async (templateId) => {
      const state = window.effectsViewer.getState();
      if (typeof state.duration !== "number")
        throw new Error("Loaded effect must have a numeric duration.");
      await window.effectsViewer.renderTemplateFrame(
        templateId,
        Math.min(0.25, state.duration / 2),
      );
    }, id);
    const surface = await page.evaluate(() => {
      const canvas = document.querySelector("#previewCanvas");
      if (!(canvas instanceof HTMLCanvasElement))
        throw new Error("Preview canvas is missing.");
      return {
        height: canvas?.height ?? 0,
        width: canvas?.width ?? 0,
      };
    });
    if (surface.width !== 1280 || surface.height !== 720) {
      throw new Error(
        `Effect v1 smoke rendered ${id} at ${surface.width}x${surface.height}.`,
      );
    }
  }

  const standaloneId = catalog.find(({ kind }) => kind === "standalone")?.id;
  if (!standaloneId) throw new Error("Standalone smoke fixture is missing.");
  await selectEffect(page, standaloneId);
  const referenceTime = await page.evaluate(async (templateId) => {
    const duration = window.effectsViewer.getState().duration;
    if (typeof duration !== "number")
      throw new Error("Loaded effect must have a numeric duration.");
    const time = Math.min(2.2, duration / 2);
    await window.effectsViewer.renderTemplateFrame(templateId, time);
    const canvas = document.querySelector("#previewCanvas");
    if (!(canvas instanceof HTMLCanvasElement))
      throw new Error("Preview canvas is missing.");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Preview comparison requires a 2D context.");
    window.__effectV1SmokePreview = new Uint8ClampedArray(
      context.getImageData(0, 0, canvas.width, canvas.height).data,
    );
    return time;
  }, standaloneId);
  await page.selectOption("#sizeSelect", "3840x2160");
  await page.waitForFunction(() => {
    const state = window.effectsViewer.getState();
    return (
      state.previewRasterWidth === 3840 &&
      state.previewRasterHeight === 2160 &&
      !state.renderInFlight &&
      !state.renderQueued
    );
  });
  await selectEffect(page, standaloneId);
  const raster = await page.evaluate(
    async ({ templateId, time }) => {
      await window.effectsViewer.renderTemplateFrame(templateId, time);
      const canvas = document.querySelector("#previewCanvas");
      if (!(canvas instanceof HTMLCanvasElement))
        throw new Error("Preview canvas is missing.");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context)
        throw new Error("Preview comparison requires a 2D context.");
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      const baseline = window.__effectV1SmokePreview;
      if (!baseline || baseline.length !== pixels.length)
        throw new Error("Preview comparison requires a matching baseline.");
      let differentChannels = 0;
      let squaredError = 0;
      for (let index = 0; index < pixels.length; index += 1) {
        const current = pixels[index];
        const reference = baseline[index];
        if (current === undefined || reference === undefined)
          throw new Error("Preview pixel is missing.");
        const delta = Math.abs(current - reference);
        squaredError += delta * delta;
        if (delta > 8) differentChannels += 1;
      }
      delete window.__effectV1SmokePreview;
      const points: [number, number][] = [
        [0, 0],
        [canvas.width - 1, 0],
        [0, canvas.height - 1],
        [canvas.width - 1, canvas.height - 1],
      ];
      return {
        cornerAlpha: points.map(([x, y]) =>
          context.getImageData(x, y, 1, 1).data.at(3),
        ),
        differentChannelRatio: differentChannels / pixels.length,
        height: canvas.height,
        meanSquaredError: squaredError / pixels.length,
        rasterHeight: window.effectsViewer.getState().previewRasterHeight,
        rasterWidth: window.effectsViewer.getState().previewRasterWidth,
        width: canvas.width,
      };
    },
    { templateId: standaloneId, time: referenceTime },
  );
  if (
    raster.width !== 1280 ||
    raster.height !== 720 ||
    raster.rasterWidth !== 3840 ||
    raster.rasterHeight !== 2160 ||
    raster.cornerAlpha.some((alpha) => alpha !== 255) ||
    raster.meanSquaredError > 3 ||
    raster.differentChannelRatio > 0.01
  ) {
    throw new Error(
      `Logical preview did not cover the canvas at 4K render resolution: ${JSON.stringify(raster)}.`,
    );
  }

  const after = await readHealth(page);
  if (
    after.sandboxRecoveryAttempts !== before.sandboxRecoveryAttempts ||
    after.staleResponses !== before.staleResponses
  ) {
    throw new Error(
      `Effect v1 smoke changed runtime health: ${JSON.stringify({ before, after })}.`,
    );
  }
}

async function selectEffect(page: Page, id: string) {
  await page.locator("#templateSelect").evaluate((select, value) => {
    if (!(select instanceof HTMLSelectElement))
      throw new Error("Effect selector must be a select element.");
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, id);
  await page.waitForFunction(
    (expected) =>
      window.effectsViewer?.getState().currentTemplate === expected &&
      !window.effectsViewer.getState().renderInFlight &&
      !window.effectsViewer.getState().renderQueued,
    id,
  );
}

async function readHealth(page: Page) {
  return page.evaluate(() => {
    const state = window.effectsViewer.getState();
    return {
      sandboxRecoveryAttempts: state.sandboxRecoveryAttempts,
      staleResponses: state.staleResponses,
    };
  });
}
