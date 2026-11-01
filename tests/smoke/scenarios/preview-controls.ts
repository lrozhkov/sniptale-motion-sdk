import assert from "node:assert/strict";
import { join } from "node:path";
import { expect } from "@playwright/test";
import type { SmokeRuntime } from "../../../tooling/test/smoke/runtime.ts";

export async function assertPreviewControlsLayout({
  browser,
  viewerPort,
  sandboxPort,
  outputDir,
}: Pick<SmokeRuntime, "browser" | "viewerPort" | "sandboxPort" | "outputDir">) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      `http://127.0.0.1:${viewerPort}/index.html?sandboxPort=${sandboxPort}`,
    );
    await expect(page.locator("#packStatus")).toHaveClass(/ready/);
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 1440, height: 600 },
      { width: 900, height: 600 },
    ]) {
      await page.setViewportSize(viewport);
      for (const locale of ["ru", "en"]) {
        await page
          .locator("#localeSelect")
          .selectOption(locale, { force: true });
        const guides = page.locator("#previewGuidesButton");
        await expect(guides).toHaveText(
          locale === "ru" ? "Направляющие" : "Guides",
        );
        const controls = page.locator(
          ".preview-toolbar button:visible, #fullscreenPreviewButton",
        );
        const hits = await controls.evaluateAll((buttons) =>
          buttons.map((button) => {
            const rect = button.getBoundingClientRect();
            return {
              label: button.id || button.textContent,
              rect: {
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
              },
              hits: button.contains(
                document.elementFromPoint(
                  rect.x + rect.width / 2,
                  rect.y + rect.height / 2,
                ),
              ),
            };
          }),
        );
        assert.ok(hits.length >= 6);
        for (const [index, hit] of hits.entries()) {
          assert.equal(
            hit.hits,
            true,
            `${viewport.width}x${viewport.height}/${locale}: ${hit.label}`,
          );
          for (const other of hits.slice(index + 1)) {
            const width = Math.max(
              0,
              Math.min(hit.rect.right, other.rect.right) -
                Math.max(hit.rect.left, other.rect.left),
            );
            const height = Math.max(
              0,
              Math.min(hit.rect.bottom, other.rect.bottom) -
                Math.max(hit.rect.top, other.rect.top),
            );
            assert.equal(
              width * height,
              0,
              `${viewport.width}x${viewport.height}/${locale}: ${hit.label} overlaps ${other.label}`,
            );
          }
        }
        const previous = await guides.getAttribute("aria-pressed");
        const rect = await guides.boundingBox();
        assert.ok(rect);
        await page.mouse.click(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        );
        await expect(guides).toHaveAttribute(
          "aria-pressed",
          previous === "true" ? "false" : "true",
        );
        assert.equal(
          await page.evaluate(() =>
            Boolean(
              document.fullscreenElement ||
              document.querySelector(".preview-fullscreen"),
            ),
          ),
          false,
        );
        await page.screenshot({
          path: join(
            outputDir,
            `preview-controls-${viewport.width}x${viewport.height}-${locale}.png`,
          ),
        });
        const fullscreen = page.locator("#fullscreenPreviewButton");
        await fullscreen.click();
        await expect
          .poll(() =>
            page.evaluate(() =>
              Boolean(
                document.fullscreenElement ||
                document.querySelector(".preview-fullscreen"),
              ),
            ),
          )
          .toBe(true);
        await fullscreen.click();
        await expect
          .poll(() =>
            page.evaluate(() =>
              Boolean(
                document.fullscreenElement ||
                document.querySelector(".preview-fullscreen"),
              ),
            ),
          )
          .toBe(false);
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}
