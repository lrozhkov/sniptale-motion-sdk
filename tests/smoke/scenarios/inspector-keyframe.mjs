import assert from "node:assert/strict";
import { join } from "node:path";
import { expect } from "@playwright/test";

export async function assertInspectorKeyframeFlow(page, outputDir) {
  await page.locator('[data-inspector-tab="timing"]').click();
  const value = page.locator(
    '#inspectorPanel input[data-track-id="card.opacity"][data-keyframe-id="start"][data-keyframe-property="value"]',
  );
  await expect(value).toHaveValue("0.2");
  await value.fill("0.35");
  await value.press("Tab");
  await expect(value).toHaveValue("0.35");
  await page.locator("#undoEditorButton").click();
  await expect(value).toHaveValue("0.2");
  await expect(page.locator("#redoEditorButton")).toBeEnabled();
  await value.fill("");
  await value.press("Tab");
  await expect(value).toHaveValue("0.2");
  await expect(page.locator("#redoEditorButton")).toBeEnabled();
  const handle = page.locator("#inspectorPanel .curve-handle-first");
  const handleValue = page.locator(
    '#inspectorPanel input[data-keyframe-property="handle-x1"]',
  );
  await expect(handle).toBeVisible();
  const before = await handleValue.inputValue();
  const box = await handle.boundingBox();
  assert.ok(box);
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 20, y - 6, { steps: 4 });
  await expect(handleValue).not.toHaveValue(before);
  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.press(`${modifier}+z`);
  await expect(handleValue).toHaveValue(before);
  await page.mouse.move(x + 50, y - 12, { steps: 3 });
  await page.mouse.up();
  await expect(handleValue).toHaveValue(before);
  await expect(page.locator("#redoEditorButton")).toBeEnabled();
  await page.locator("#redoEditorButton").click();
  await expect(handleValue).not.toHaveValue(before);
  await page.locator("#undoEditorButton").click();
  await expect(handleValue).toHaveValue(before);
  await page.screenshot({
    path: join(outputDir, "inspector-keyframe.png"),
    fullPage: true,
  });
}
