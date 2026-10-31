import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { createNeutralEffectV1Document } from "../../../tooling/test/fixtures/local-pack.mjs";

export async function assertCanvasMotionPathFlow({
  browser,
  viewerPort,
  sandboxPort,
  outputDir,
}) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1640, height: 1060 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const doc = createNeutralEffectV1Document("standalone");
  doc.layers = [
    {
      id: "card",
      name: "Card",
      type: "rect",
      width: 200,
      height: 100,
      x: 20,
      y: 40,
    },
  ];
  doc.clips = [{ layerId: "card", sceneId: "main", start: 0, duration: 2 }];
  doc.program.commands.push({
    op: "shape",
    shape: "rect",
    layerId: "card",
    fill: "#72dbe6",
    width: 200,
    height: 100,
    x: 0,
    y: 0,
  });
  doc.timeline.tracks = [
    {
      id: "card.x",
      layerId: "card",
      property: "x",
      keyframes: [
        { id: "x-start", time: 0, value: 20 },
        { id: "x-end", time: 1, value: 200 },
      ],
    },
    {
      id: "card.y",
      layerId: "card",
      property: "y",
      keyframes: [
        { id: "y-start", time: 0, value: 40 },
        { id: "y-end", time: 1, value: 90 },
      ],
    },
  ];
  const input = JSON.stringify(doc);
  await page.route(
    "**/effects/neutral-standalone.sniptale-effect.json",
    (route) => route.fulfill({ contentType: "application/json", body: input }),
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
      .locator('.layer-lane[data-layer-id="card"] .timeline-lane-label')
      .first()
      .click();
    const point = page.locator(
      '.motion-path-point[data-x-keyframe-id="x-end"][data-y-keyframe-id="y-end"]',
    );
    await expect(point).toBeVisible();
    await point.press("Enter");
    await page.locator('[data-inspector-tab="timing"]').click();
    const kind = page.locator('select[data-motion-path-point-kind="true"]');
    await expect(kind).toBeEnabled();
    await kind.selectOption("smooth");
    await expect(kind).toHaveValue("smooth");
    await expect(page.locator(".motion-path-tangent-handle")).toHaveCount(1);
    const before = await point.getAttribute("cx");
    await point.press("Shift+ArrowRight");
    await expect(point).not.toHaveAttribute("cx", before);
    const after = await point.getAttribute("cx");
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+z`);
    await expect(point).toHaveAttribute("cx", before);
    await expect(page.locator("#redoEditorButton")).toBeEnabled();
    await page.keyboard.press(`${modifier}+Shift+z`);
    await expect(point).toHaveAttribute("cx", after);
    assert.doesNotMatch(
      await page.locator(".motion-path-line").getAttribute("d"),
      /NaN|undefined|Infinity/,
    );
    await expect(page.locator("#exportEffectFileButton")).toBeEnabled();
    await page.locator("#appActionsButton").click();
    const pendingDownload = page.waitForEvent("download");
    await page.locator("#exportEffectFileButton").click();
    const download = await pendingDownload;
    const file = join(outputDir, "canvas-motion-path.sniptale-effect.json");
    await download.saveAs(file);
    const source = await readFile(file, "utf8");
    const exported = JSON.parse(source);
    assert.equal(
      exported.timeline.tracks
        .find((track) => track.id === "card.x")
        .keyframes.find((key) => key.id === "x-end").value,
      210,
    );
    assert.equal(
      exported.timeline.motionPaths[0].points.find(
        (candidate) => candidate.xKeyframeId === "x-end",
      ).kind,
      "smooth",
    );
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "tooling/effect-v1/validate.ts", file, "--json"],
      { cwd: process.cwd() },
    );
    assert.equal(JSON.parse(stdout).ok, true);
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: join(outputDir, "canvas-motion-path.png"),
      fullPage: true,
    });
    await writeFile(
      join(outputDir, "canvas-motion-path.json"),
      JSON.stringify(
        {
          status: "passed",
          inputSha256: createHash("sha256").update(input).digest("hex"),
          exportSha256: createHash("sha256").update(source).digest("hex"),
          browser: browser.version(),
          steps: [
            "layer-selection",
            "paired-point-selection",
            "inspector-point-kind",
            "tangent-overlay",
            "keyboard-nudge",
            "undo",
            "redo",
            "export-and-cli-validation",
          ],
          errors,
        },
        null,
        2,
      ) + "\n",
    );
  } catch (error) {
    await writeFile(
      join(outputDir, "canvas-motion-path-failure.json"),
      JSON.stringify(
        {
          error: String(error),
          errors,
          status: await page
            .locator("#timelineSaveStatus")
            .getAttribute("title"),
          diagnostics: await page.locator("#diagnostics").textContent(),
        },
        null,
        2,
      ) + "\n",
    );
    await page.screenshot({
      path: join(outputDir, "canvas-motion-path-failure.png"),
      fullPage: true,
    });
    throw error;
  } finally {
    await context.close();
  }
}
