import {
  responseField,
  responseObject,
  responseArray,
} from "../../../tooling/test/fixtures/response.ts";
import { parseEffectV1Fixture } from "../../../tooling/test/fixtures/effect-v1-documents.ts";
import type { SmokeRuntime } from "../../../tooling/test/smoke/runtime.ts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { createNeutralEffectV1Document } from "../../../tooling/test/fixtures/local-pack.ts";

export async function assertInspectorSvgFlow({
  browser,
  viewerPort,
  sandboxPort,
  outputDir,
}: Pick<SmokeRuntime, "browser" | "viewerPort" | "sandboxPort" | "outputDir">) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1640, height: 1060 },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const doc = createNeutralEffectV1Document("standalone");
  doc.assets = [
    {
      id: "neutral-mark",
      kind: "svg",
      mimeType: "image/svg+xml",
      path: "assets/neutral-mark.svg",
    },
  ];
  doc.layers = [
    {
      id: "logo",
      type: "svgAsset",
      assetId: "neutral-mark",
      baseX: 640,
      baseY: 360,
      width: 200,
      height: 100,
      svgPartMode: "reveal",
      svgPartIds: [],
      partReveal: 1,
      partStagger: 0,
      partSpread: 0,
      partBlur: 0,
      partOrder: "document",
    },
  ];
  doc.clips = [{ layerId: "logo", sceneId: "main", start: 0, duration: 2 }];
  doc.program.commands.push({
    op: "svgParts",
    assetId: "neutral-mark",
    layerId: "logo",
    x: 540,
    y: 310,
    width: 200,
    height: 100,
    part: {
      kind: "preset",
      reveal: { op: "read", path: "layers.logo.partReveal" },
    },
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" fill="#72dbe6"><defs><rect id="ignored" width="1" height="1"/></defs><g id="glyph"><rect width="40" height="20"/></g><rect id="tail" x="60" y="20" width="30" height="20" fill="#eab676"/>${Array.from({ length: 50 }, (_, index) => `<rect id="extra-${index}" x="${index}" width="1" height="1"/>`).join("")}</svg>`;
  const sha256 = createHash("sha256").update(svg).digest("hex");
  const originalAsset = doc.assets[0];
  assert.ok(originalAsset, "SVG fixture must contain an asset.");
  originalAsset.sha256 = sha256;
  originalAsset.byteLength = Buffer.byteLength(svg);
  const input = JSON.stringify(doc);
  await page.route("**/packs/demo/manifest.json", async (route) => {
    const response = await route.fetch();
    const manifest = responseObject(await response.json());
    const asset = responseObject(
      responseArray(manifest, "assets").find(
        (item) => responseField(item, "id") === "neutral-mark",
      ),
    );
    asset.size = Buffer.byteLength(svg);
    asset.sha256 = sha256;
    await route.fulfill({ response, json: manifest });
  });
  await page.route(
    "**/effects/neutral-standalone.sniptale-effect.json",
    (route) => route.fulfill({ contentType: "application/json", body: input }),
  );
  await page.route(/\/neutral-mark\.svg(?:\?.*)?$/, (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
  try {
    await page.goto(
      `http://127.0.0.1:${viewerPort}/index.html?sandboxPort=${sandboxPort}`,
      { waitUntil: "domcontentloaded" },
    );
    await expect(page.locator("#packStatus")).toHaveClass(/ready/);
    await expect(page.locator("#templateSelect option")).toHaveCount(3);
    await page.locator("#templateComboboxButton").click();
    await page
      .locator(`.template-combobox-option[data-value="${doc.id}"]`)
      .click();
    await page.locator("#expandTimelineRowsButton").click();
    await page
      .locator('.layer-lane[data-layer-id="logo"] .timeline-lane-label')
      .first()
      .click();
    await page.locator('[data-inspector-tab="transform"]').click();
    const chips = page.locator("#inspectorPanel .svg-part-chip");
    await expect(chips).toHaveCount(48);
    await expect(
      page
        .locator("#inspectorPanel .inspector-heading")
        .filter({ hasText: /^Части SVG$/ }),
    ).toBeVisible();
    const inherited = chips.filter({
      has: page.locator("strong", { hasText: /^glyph\.rect-0$/ }),
    });
    await expect(inherited).toHaveCount(1);
    await expect(inherited.locator(".svg-part-swatch")).toHaveCSS(
      "background-color",
      "rgb(114, 219, 230)",
    );
    await expect(
      page.locator('.svg-part-chip[data-part-id="ignored"]'),
    ).toHaveCount(0);
    await inherited.click();
    await expect(inherited).toHaveClass(/selected/);
    await page.locator("#undoEditorButton").click();
    await expect(inherited).not.toHaveClass(/selected/);
    await page.locator("#redoEditorButton").click();
    await expect(inherited).toHaveClass(/selected/);
    const tail = page.locator('.svg-part-chip[data-part-id="tail"]');
    await tail.click();
    await expect(tail).toHaveClass(/selected/);
    await page.locator("#undoEditorButton").click();
    await expect(tail).not.toHaveClass(/selected/);
    await expect(inherited).toHaveClass(/selected/);
    await page.locator("#appActionsButton").click();
    const pending = page.waitForEvent("download");
    await page.locator("#exportEffectFileButton").click();
    const file = join(outputDir, "inspector-svg.sniptale-effect.json");
    await (await pending).saveAs(file);
    const source = await readFile(file, "utf8");
    const exported = parseEffectV1Fixture(source);
    const logo = exported.layers.find((layer) => layer.id === "logo");
    assert.ok(logo, "Export must contain the edited SVG layer.");
    assert.deepEqual(logo.svgPartIds, ["glyph.rect-0"]);
    const asset = exported.assets.find((item) => item.id === "neutral-mark");
    assert.ok(
      asset && typeof asset.svgText === "string",
      "Export must contain inline SVG source.",
    );
    assert.ok(asset.svgText.includes('id="glyph"'));
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "tooling/effect-v1/validate.ts", file, "--json"],
      { cwd: process.cwd() },
    );
    assert.equal(responseField(JSON.parse(stdout), "ok"), true);
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: join(outputDir, "inspector-svg.png"),
      fullPage: true,
    });
    await writeFile(
      join(outputDir, "inspector-svg.json"),
      JSON.stringify(
        {
          status: "passed",
          inputSha256: createHash("sha256").update(input).digest("hex"),
          exportSha256: createHash("sha256").update(source).digest("hex"),
          browser: browser.version(),
          steps: [
            "svg-asset-preview",
            "root-paint-inheritance",
            "visible-part-limit",
            "defs-excluded",
            "select-part",
            "undo-and-redo",
            "multiple-parts-and-undo",
            "export-metadata-and-embedded-asset",
            "cli-validation",
          ],
          errors,
        },
        null,
        2,
      ) + "\n",
    );
  } catch (error) {
    await writeFile(
      join(outputDir, "inspector-svg-failure.json"),
      JSON.stringify(
        {
          error: String(error),
          errors,
          diagnostics: await page.locator("#diagnostics").textContent(),
        },
        null,
        2,
      ) + "\n",
    );
    await page.screenshot({
      path: join(outputDir, "inspector-svg-failure.png"),
      fullPage: true,
    });
    throw error;
  } finally {
    await context.close();
  }
}
