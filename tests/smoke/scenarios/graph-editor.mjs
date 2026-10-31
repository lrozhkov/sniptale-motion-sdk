import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { createNeutralEffectV1Document } from "../../../tooling/test/fixtures/local-pack.mjs";

export async function assertGraphEditorFlow({
  page,
  viewerPort,
  sandboxPort,
  outputDir,
}) {
  const document = createNeutralEffectV1Document("standalone");
  document.layers = [{ id: "card", name: "Card", type: "customDraw" }];
  document.clips = [
    { duration: 2, layerId: "card", sceneId: "main", start: 0 },
  ];
  document.program.commands.push({
    op: "shape",
    shape: "rect",
    layerId: "card",
    fill: "#72dbe6",
    width: 200,
    height: 100,
    x: 100,
    y: 100,
  });
  document.timeline.tracks = [
    {
      id: "card.opacity",
      property: "opacity",
      target: "card",
      keyframes: [
        {
          id: "start",
          time: 0.25,
          value: 0.2,
          easing: "bezier",
          handles: { x1: 0.25, x2: 0.75, y1: 0.1, y2: 0.9 },
        },
        { id: "finish", time: 1.5, value: 0.8, easing: "linear" },
      ],
    },
  ];
  const input = JSON.stringify(document);
  const route = "**/effects/neutral-standalone.sniptale-effect.json";
  const errors = [];
  const onError = (error) => errors.push(error.message);
  page.on("pageerror", onError);
  await page.route(route, (request) =>
    request.fulfill({ contentType: "application/json", body: input }),
  );
  try {
    await page.goto(
      `http://127.0.0.1:${viewerPort}/index.html?sandboxPort=${sandboxPort}`,
      { waitUntil: "domcontentloaded" },
    );
    await selectEffect(page, document.id);
    await page.locator("#expandTimelineRowsButton").click();
    const timelinePoint = page
      .locator(
        '.keyframe-point[data-track-id="card.opacity"][data-keyframe-id="start"]',
      )
      .first();
    await expect(timelinePoint).toBeVisible();
    await timelinePoint.click();
    await expect(page.locator("#graphEditorButton")).toBeEnabled();
    await page.locator("#graphEditorButton").click();
    const svg = page.locator(".graph-editor-svg");
    await expect(svg).toBeVisible();
    await expect(svg.locator(".graph-keyframe-point")).toHaveCount(2);
    await expect(page.locator("#graphEditorButton")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const point = svg.locator(
      '[data-keyframe-id="start"].graph-keyframe-point',
    );
    const original = await point.getAttribute("cx");
    const bounds = await point.boundingBox();
    assert.ok(bounds, "Graph keyframe needs a visible pointer target.");
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(bounds.x + 36, bounds.y - 8, { steps: 4 });
    await page.mouse.up();
    await expect(point).not.toHaveAttribute("cx", original);
    const curve = svg.locator(".graph-track-curve");
    await expect(curve).toHaveAttribute("d", /C/);
    assert.doesNotMatch(
      await curve.getAttribute("d"),
      /NaN|undefined|Infinity/,
    );
    const beforeZoom = await curve.getAttribute("d");
    await page.locator(".graph-editor-icon-action").nth(1).click();
    await expect(curve).not.toHaveAttribute("d", beforeZoom);
    const plot = await svg.locator(".graph-editor-plot").boundingBox();
    assert.ok(plot, "Graph background needs a visible pointer target.");
    const beforePan = await curve.getAttribute("d");
    await page.mouse.move(plot.x + plot.width / 2, plot.y + plot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      plot.x + plot.width / 2 + 28,
      plot.y + plot.height / 2 + 10,
      { steps: 4 },
    );
    await page.mouse.up();
    await expect(curve).not.toHaveAttribute("d", beforePan);
    await page.screenshot({
      path: join(outputDir, "graph-editor.png"),
      fullPage: true,
    });
    await selectEffect(page, "neutral-target-effect");
    await expect(page.locator("#graphEditorButton")).toBeDisabled();
    await expect(page.locator("#curveEditor")).toBeHidden();
    await selectEffect(page, document.id);
    await expect(svg).toBeVisible();
    await page.locator(".graph-editor-icon-action").last().click();
    await expect(svg).toBeHidden();
    await page.locator("#graphEditorButton").click();
    await expect(svg).toBeVisible();
    assert.deepEqual(errors, []);
    await writeFile(
      join(outputDir, "graph-editor.json"),
      JSON.stringify(
        {
          status: "passed",
          inputSha256: createHash("sha256").update(input).digest("hex"),
          browser: page.context().browser().version(),
          steps: [
            "numeric-selection",
            "lazy-open",
            "keyframe-drag",
            "bezier-curve",
            "zoom",
            "pan",
            "source-switch",
            "close-and-reopen",
          ],
          errors,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await page.unroute(route);
    page.off("pageerror", onError);
  }
}

async function selectEffect(page, id) {
  await page.locator("#templateComboboxButton").click();
  await page.locator(`.template-combobox-option[data-value="${id}"]`).click();
  await expect(page.locator("#templateSelect")).toHaveValue(id);
}
