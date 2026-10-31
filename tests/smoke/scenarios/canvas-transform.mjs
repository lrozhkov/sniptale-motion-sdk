import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { createNeutralEffectV1Document } from "../../../tooling/test/fixtures/local-pack.mjs";

export async function assertCanvasTransformFlow({
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
      fill: "#72dbe6",
      type: "rect",
      baseX: 340,
      baseY: 230,
      width: 200,
      height: 100,
      x: 0,
      y: 0,
    },
    {
      id: "title",
      name: "Title",
      fill: "#eab676",
      type: "rect",
      baseX: 700,
      baseY: 390,
      width: 100,
      height: 80,
      x: 0,
      y: 0,
    },
  ];
  doc.clips = doc.layers.map((layer) => ({
    layerId: layer.id,
    sceneId: "main",
    start: 0,
    duration: 2,
  }));
  doc.program.commands.push(
    ...doc.layers.map((layer) => ({
      op: "shape",
      shape: "rect",
      layerId: layer.id,
      fill: { op: "read", path: `layers.${layer.id}.fill` },
      x: {
        op: "sub",
        args: [
          { op: "read", path: `layers.${layer.id}.baseX` },
          {
            op: "mul",
            args: [{ op: "read", path: `layers.${layer.id}.width` }, 0.5],
          },
        ],
      },
      y: {
        op: "sub",
        args: [
          { op: "read", path: `layers.${layer.id}.baseY` },
          {
            op: "mul",
            args: [{ op: "read", path: `layers.${layer.id}.height` }, 0.5],
          },
        ],
      },
      width: { op: "read", path: `layers.${layer.id}.width` },
      height: { op: "read", path: `layers.${layer.id}.height` },
    })),
  );
  const input = JSON.stringify(doc);
  await page.route(
    "**/effects/neutral-standalone.sniptale-effect.json",
    (route) => route.fulfill({ contentType: "application/json", body: input }),
  );
  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  const selection = page.locator("#canvasSelectionBox");
  const selectLayer = (id) =>
    page
      .locator(`.layer-lane[data-layer-id="${id}"] .timeline-lane-label`)
      .first();
  const style = async (property) =>
    selection.evaluate((node, name) => node.style[name], property);
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
    await selectLayer("card").click();
    await expect(selection).toBeVisible();
    await expect(selection).toHaveAttribute("data-layer-id", "card");
    const width = await style("width");
    const east = selection.locator('[data-scale-handle="e"]');
    await expect(east).toBeVisible();
    await east.press("ArrowRight");
    await expect.poll(() => style("width")).not.toBe(width);
    await page.keyboard.press(`${modifier}+z`);
    await expect.poll(() => style("width")).toBe(width);
    const handle = await east.boundingBox();
    assert.ok(handle);
    const x = handle.x + handle.width / 2,
      y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y, { steps: 4 });
    await expect.poll(() => style("width")).not.toBe(width);
    const scale = parseFloat(width) / 200;
    const resizedAuthorWidth = Math.round(200 + 40 / scale);
    await page.keyboard.press(`${modifier}+z`);
    await expect.poll(() => style("width")).toBe(width);
    await page.mouse.move(x + 90, y, { steps: 3 });
    await page.mouse.up();
    await expect.poll(() => style("width")).toBe(width);
    await expect(page.locator("#redoEditorButton")).toBeEnabled();
    await page.locator("#redoEditorButton").click();
    await expect
      .poll(async () => parseFloat(await style("width")))
      .toBeCloseTo(resizedAuthorWidth * scale, 2);
    const numberField = (property) =>
      page.locator(
        `#inspectorPanel input[data-layer-id="card"][data-property="${property}"]`,
      );
    const xInput = numberField("x");
    const previousX = await xInput.inputValue();
    await xInput.fill("45");
    await xInput.press("Tab");
    await expect(xInput).toHaveValue("45");
    await page.locator("#undoEditorButton").click();
    await expect(xInput).toHaveValue(previousX);
    const widthInput = numberField("width");
    await widthInput.fill("275");
    await widthInput.press("Tab");
    await expect(widthInput).toHaveValue("275");
    await page.locator("#undoEditorButton").click();
    await expect(widthInput).toHaveValue(String(resizedAuthorWidth));
    await expect(page.locator("#redoEditorButton")).toBeEnabled();
    await widthInput.fill("");
    await widthInput.press("Tab");
    await expect(widthInput).toHaveValue(String(resizedAuthorWidth));
    await expect(page.locator("#redoEditorButton")).toBeEnabled();
    const fill = page.locator(
      '#inspectorPanel .css-color-field[data-layer-id="card"][data-property="fill"] [data-css-color-role="value"]',
    );
    await fill.fill("#e14b50");
    await fill.press("Tab");
    await expect(fill).toHaveValue("#e14b50");
    await page
      .locator(
        '#inspectorPanel details[data-property-group="advanced"] summary',
      )
      .click();
    await page
      .locator(
        '#inspectorPanel select[data-layer-id="card"][data-property="blendMode"]',
      )
      .selectOption("screen");
    await selectLayer("card").click();
    await selectLayer("title").click({ modifiers: ["Shift"] });
    await expect(selection).toHaveAttribute("data-selection-kind", "multi");
    const groupWidth = await style("width");
    await selection.locator('[data-scale-handle="se"]').press("ArrowRight");
    await expect.poll(() => style("width")).not.toBe(groupWidth);
    await page.keyboard.press(`${modifier}+z`);
    await expect.poll(() => style("width")).toBe(groupWidth);
    const left = await style("left");
    const box = await selection.boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 24,
      box.y + box.height / 2 + 16,
      { steps: 4 },
    );
    await page.mouse.up();
    await expect.poll(() => style("left")).not.toBe(left);
    const movedLeft = await style("left");
    await selection.locator('[data-rotate-handle="true"]').press("ArrowRight");
    await expect.poll(() => style("left")).not.toBe(movedLeft);
    await expect(page.locator("#undoEditorButton")).toBeEnabled();
    await page.keyboard.press(`${modifier}+z`);
    await expect.poll(() => style("left")).toBe(movedLeft);
    await expect(page.locator("#exportEffectFileButton")).toBeEnabled();
    await page.locator("#appActionsButton").click();
    const pending = page.waitForEvent("download");
    await page.locator("#exportEffectFileButton").click();
    const download = await pending;
    const file = join(outputDir, "canvas-transform.sniptale-effect.json");
    await download.saveAs(file);
    const source = await readFile(file, "utf8");
    const exported = JSON.parse(source);
    assert.equal(
      exported.layers.find((layer) => layer.id === "card").width,
      resizedAuthorWidth,
    );
    const card = exported.layers.find((layer) => layer.id === "card");
    assert.equal(card.fill, "#e14b50");
    assert.equal(card.blendMode, "screen");
    for (const id of ["card", "title"]) {
      const layer = exported.layers.find((candidate) => candidate.id === id);
      assert.ok(typeof layer?.x === "number" && layer.x > 0);
      assert.ok(typeof layer?.y === "number" && layer.y > 0);
    }
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "tooling/effect-v1/validate.ts", file, "--json"],
      { cwd: process.cwd() },
    );
    assert.equal(JSON.parse(stdout).ok, true);
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: join(outputDir, "canvas-transform.png"),
      fullPage: true,
    });
    await writeFile(
      join(outputDir, "canvas-transform.json"),
      JSON.stringify(
        {
          status: "passed",
          inputSha256: createHash("sha256").update(input).digest("hex"),
          exportSha256: createHash("sha256").update(source).digest("hex"),
          browser: browser.version(),
          steps: [
            "layer-selection",
            "keyboard-resize",
            "pointer-resize",
            "undo-during-drag",
            "stale-move-after-undo",
            "redo",
            "inspector-position-and-undo",
            "inspector-content-size-and-undo",
            "invalid-number-preserves-redo",
            "inspector-css-color",
            "inspector-select-value",
            "multi-selection",
            "group-keyboard-scale",
            "group-pointer-move",
            "group-keyboard-rotation-and-undo",
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
      join(outputDir, "canvas-transform-failure.json"),
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
      path: join(outputDir, "canvas-transform-failure.png"),
      fullPage: true,
    });
    throw error;
  } finally {
    await context.close();
  }
}
