import type { Page, Locator } from "@playwright/test";
import assert from "node:assert/strict";
import { expect } from "@playwright/test";

export async function assertActiveGestureUndo(page: Page, point: Locator) {
  await page.evaluate(() => {
    const listeners = new Set<unknown>();
    const add = window.addEventListener;
    const remove = window.removeEventListener;
    window.addEventListener = function (
      this: Window,
      type: string,
      listener: unknown,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (type === "pointermove") listeners.add(listener);
      Reflect.apply(add, this, [type, listener, options]);
    };
    window.removeEventListener = function (
      this: Window,
      type: string,
      listener: unknown,
      options?: boolean | EventListenerOptions,
    ) {
      if (type === "pointermove") listeners.delete(listener);
      Reflect.apply(remove, this, [type, listener, options]);
    };
    window.__motionPointerProbe = {
      count() {
        return listeners.size;
      },
      restore() {
        window.addEventListener = add;
        window.removeEventListener = remove;
        delete window.__motionPointerProbe;
      },
    };
  });
  try {
    const initial = await point.getAttribute("cx");
    assert.ok(initial !== null, "Expected SVG attribute is missing.");
    const rect = await point.boundingBox();
    assert.ok(rect, "Undo proof needs a visible graph keyframe.");
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(rect.x + 30, rect.y - 5, { steps: 4 });
    await expect(point).not.toHaveAttribute("cx", initial);
    const edited = await point.getAttribute("cx");
    assert.ok(edited !== null, "Expected SVG attribute is missing.");
    await expect
      .poll(() => page.evaluate(() => window.__motionPointerProbe?.count()))
      .toBe(1);
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+z`);
    await expect
      .poll(() => page.evaluate(() => window.__motionPointerProbe?.count()))
      .toBe(0);
    await expect(point).toHaveAttribute("cx", initial);
    await page.mouse.move(rect.x + 50, rect.y - 8);
    await page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
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
