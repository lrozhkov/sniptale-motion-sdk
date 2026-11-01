import { vi } from "vitest";
import * as domRefs from "../../src/apps/viewer/app/dom-refs.js";
import { createViewerContext } from "../../src/apps/viewer/app/create-context.js";

class FixtureElement {
  value = "";
  max = "";
  textContent = "";
  dataset: Record<string, string> = {};
  scrollLeft = 0;
  scrollTop = 0;
}
class FixtureDrawingContext {}
class FixtureCanvas extends FixtureElement {
  getContext(): CanvasRenderingContext2D {
    return new CanvasRenderingContext2D();
  }
}

/** Use real app actions/state. Only native DOM allocation is replaced; restore mocks/globals after each test. */
export function createViewerContextFixture() {
  vi.stubGlobal("HTMLElement", FixtureElement);
  vi.stubGlobal("HTMLCanvasElement", FixtureCanvas);
  vi.stubGlobal("CanvasRenderingContext2D", FixtureDrawingContext);
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      tag === "canvas" ? new FixtureCanvas() : new FixtureElement(),
    createElementNS: () => new FixtureElement(),
  });
  vi.spyOn(domRefs, "requireHtml").mockImplementation((_selector, tag) =>
    document.createElement(tag),
  );
  vi.spyOn(domRefs, "queryHtml").mockReturnValue([]);
  vi.spyOn(domRefs, "requireSvg").mockImplementation(() =>
    document.createElementNS("http://www.w3.org/2000/svg", "svg"),
  );
  const ctx = createViewerContext();
  ctx.deps = { ...ctx.deps };
  // Isolate persistence/UI side effects; each consumer supplies its presentation expectations.
  vi.spyOn(ctx, "markEditorChanged").mockImplementation(() => {});
  vi.spyOn(ctx, "syncEditorWorkflowUi").mockImplementation(() => {});
  return ctx;
}
