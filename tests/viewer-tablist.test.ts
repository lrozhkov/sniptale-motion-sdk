import { describe, expect, it } from "vitest";

import { resolveTablistNavigationIndex } from "../src/apps/viewer/app/tablist";

describe("viewer tablist navigation", () => {
  it("wraps horizontal arrow navigation", () => {
    expect(resolveTablistNavigationIndex(0, 3, "ArrowLeft")).toBe(2);
    expect(resolveTablistNavigationIndex(2, 3, "ArrowRight")).toBe(0);
    expect(resolveTablistNavigationIndex(1, 3, "ArrowRight")).toBe(2);
  });

  it("moves directly to the first or last available tab", () => {
    expect(resolveTablistNavigationIndex(2, 4, "Home")).toBe(0);
    expect(resolveTablistNavigationIndex(0, 4, "End")).toBe(3);
  });

  it("handles an empty or missing current tab deterministically", () => {
    expect(resolveTablistNavigationIndex(0, 0, "ArrowRight")).toBe(-1);
    expect(resolveTablistNavigationIndex(-1, 3, "ArrowRight")).toBe(1);
    expect(resolveTablistNavigationIndex(-1, 3, "ArrowLeft")).toBe(2);
  });
});
