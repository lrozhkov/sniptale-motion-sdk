import assert from "node:assert/strict";
import { expect } from "@playwright/test";

export async function assertActiveGestureUndo(page, point) {
  await page.evaluate(() => {
    const listeners = new Set();
    const add = window.addEventListener;
    const remove = window.removeEventListener;
    window.addEventListener = function (type, listener, options) {
      if (type === "pointermove") listeners.add(listener);
      return Reflect.apply(add, this, [type, listener, options]);
    };
    window.removeEventListener = function (type, listener, options) {
      if (type === "pointermove") listeners.delete(listener);
      return Reflect.apply(remove, this, [type, listener, options]);
    };
    window.__motionPointerProbe = {
      count: () => listeners.size,
      restore() {
        window.addEventListener = add;
        window.removeEventListener = remove;
        delete window.__motionPointerProbe;
      },
    };
  });
  try {
    const initial = await point.getAttribute("cx");
    const rect = await point.boundingBox();
    assert.ok(rect, "Undo proof needs a visible graph keyframe.");
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(rect.x + 30, rect.y - 5, { steps: 4 });
    await expect(point).not.toHaveAttribute("cx", initial);
    const edited = await point.getAttribute("cx");
    await expect
      .poll(() => page.evaluate(() => window.__motionPointerProbe.count()))
      .toBe(1);
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+z`);
    await expect
      .poll(() => page.evaluate(() => window.__motionPointerProbe.count()))
      .toBe(0);
    await expect(point).toHaveAttribute("cx", initial);
    await page.mouse.move(rect.x + 50, rect.y - 8);
    await page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        ),
    );
    await expect(point).toHaveAttribute("cx", initial);
    await page.mouse.up();
    await expect(page.locator("#redoEditorButton")).toBeEnabled();
    await page.keyboard.press(`${modifier}+Shift+z`);
    await expect(point).toHaveAttribute("cx", edited);
    await expect(page.locator("#undoEditorButton")).toBeEnabled();
    await page.keyboard.press(`${modifier}+z`);
    await expect(point).toHaveAttribute("cx", initial);
  } finally {
    if (!page.isClosed())
      await page.evaluate(() => window.__motionPointerProbe?.restore());
  }
}
