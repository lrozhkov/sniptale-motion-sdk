import { describe, expect, it, vi } from "vitest";

import { wireEffectFileJsonBindingActions } from "../src/apps/viewer/effect-file/json-binding";

describe("viewer JSON source actions", () => {
  it("wires Open, Save, and Export JSON menu buttons to their owners", () => {
    const bindTemplateSourceJson = vi.fn<() => Promise<void>>(async () => {});
    const saveBoundTemplateJson = vi.fn<() => Promise<void>>(async () => {});
    const exportCurrentTemplateJson = vi.fn<() => null>(() => null);
    const buttons = {
      bindJsonButton: createButton(),
      exportJsonButton: createButton(),
      saveJsonButton: createButton(),
    };
    const ctx = {
      bindTemplateSourceJson,
      exportCurrentTemplateJson,
      refs: buttons,
      saveBoundTemplateJson,
    };

    wireEffectFileJsonBindingActions(ctx);
    buttons.bindJsonButton.click();
    buttons.saveJsonButton.click();
    buttons.exportJsonButton.click();

    expect(bindTemplateSourceJson).toHaveBeenCalledOnce();
    expect(saveBoundTemplateJson).toHaveBeenCalledOnce();
    expect(exportCurrentTemplateJson).toHaveBeenCalledOnce();
  });
});

function createButton() {
  let clickHandler: (() => void) | null = null;
  return {
    addEventListener(type: string, handler: () => void) {
      expect(type).toBe("click");
      clickHandler = handler;
    },
    click() {
      clickHandler?.();
    },
  };
}
