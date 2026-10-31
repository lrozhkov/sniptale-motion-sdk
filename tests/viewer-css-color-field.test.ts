import { describe, expect, it } from "vitest";

import {
  isValidCssPaint,
  toOpaqueHex,
} from "../src/apps/viewer/controls/css-color-field";

describe("viewer CSS color field", () => {
  it("rejects non-text paints without invoking foreign conversion hooks", () => {
    const calls: string[] = [];
    const value = {
      toString() {
        calls.push("text");
        return "#abc";
      },
    };
    expect(isValidCssPaint(value)).toBe(false);
    expect(toOpaqueHex(value, "#abc")).toBe("#aabbcc");
    expect(calls).toEqual([]);
  });

  it("preserves Canvas paint values that a native color input cannot represent", () => {
    expect(isValidCssPaint("none")).toBe(true);
    expect(isValidCssPaint("rgba(255, 255, 255, 0.18)")).toBe(true);
    expect(isValidCssPaint("#7cf7ff80")).toBe(true);
    expect(isValidCssPaint("")).toBe(false);
    expect(isValidCssPaint("not a paint")).toBe(false);
  });

  it("derives an opaque picker color without changing the model value", () => {
    expect(toOpaqueHex("#abc")).toBe("#aabbcc");
    expect(toOpaqueHex("#12345680")).toBe("#123456");
    expect(toOpaqueHex("rgba(255, 134, 24, 0.18)")).toBe("#ff8618");
    expect(toOpaqueHex("none", "#7cf7ff")).toBe("#7cf7ff");
  });
});
