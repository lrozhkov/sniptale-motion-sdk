import { describe, expect, it, vi } from "vitest";

import {
  drawCodeBlock,
  drawParticles,
  drawPath,
  drawText,
} from "../src/apps/sandbox/runtime/canvas-drawing-primitives";

describe("sandbox canvas drawing primitives", () => {
  it("draws text with optional letter spacing and paint state", () => {
    const context = createCanvasContextSpy();

    drawText(context, {
      alpha: 0.5,
      color: "#123",
      letterSpacing: 2,
      shadowBlur: 4,
      text: "ab",
      x: 10,
      y: 20,
    });

    expect(context.globalAlpha).toBe(0.5);
    expect(context.fillStyle).toBe("#123");
    expect(context.shadowColor).toBe("#123");
    expect(context.shadowBlur).toBe(4);
    expect(context.fillText.mock.calls).toEqual([
      ["a", 10, 20],
      ["b", 20, 20],
    ]);
    expect(context.restore).toHaveBeenCalledOnce();
  });

  it("accepts opacity as text alpha alias", () => {
    const context = createCanvasContextSpy();

    drawText(context, {
      opacity: 0.35,
      text: "fade",
      x: 4,
      y: 8,
    });

    expect(context.globalAlpha).toBe(0.35);
    expect(context.fillText).toHaveBeenCalledWith("fade", 4, 8, undefined);
  });

  it("draws code blocks with visible progress, focus rows, and token colors", () => {
    const context = createCanvasContextSpy();

    drawCodeBlock(context, {
      accent: "#0ff",
      focusLine: 1,
      lineHeight: 20,
      lines: [
        [{ color: "#f00", text: "const " }, { text: "x" }],
        "return x",
        "hidden",
      ],
      progress: 0.5,
      width: 200,
      x: 5,
      y: 6,
    });

    expect(context.fill).toHaveBeenCalledOnce();
    expect(context.stroke).toHaveBeenCalledOnce();
    expect(context.fillRect).toHaveBeenCalledWith(17, 60.4, 176, 20);
    expect(context.fillText.mock.calls).toContainEqual(["01", 29, 50]);
    expect(context.fillText.mock.calls).toContainEqual(["02", 29, 70]);
    expect(context.fillText.mock.calls).toContainEqual(["const ", 81, 50]);
    expect(context.fillText.mock.calls).toContainEqual(["return x", 81, 70]);
    expect(context.fillText.mock.calls).not.toContainEqual(["hidden", 81, 90]);
  });

  it("draws paths up to clamped progress", () => {
    const context = createCanvasContextSpy();

    drawPath(context, {
      alpha: 0.25,
      color: "#abc",
      glow: 6,
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 10 },
        { x: 40, y: 20 },
      ],
      progress: 0.51,
      width: 5,
    });

    expect(context.globalAlpha).toBe(0.25);
    expect(context.strokeStyle).toBe("#abc");
    expect(context.shadowBlur).toBe(6);
    expect(context.moveTo).toHaveBeenCalledWith(0, 0);
    expect(context.quadraticCurveTo).toHaveBeenCalledOnce();
    expect(context.stroke).toHaveBeenCalledOnce();
  });

  it("accepts opacity as path alpha alias", () => {
    const context = createCanvasContextSpy();

    drawPath(context, {
      opacity: 0.2,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    });

    expect(context.globalAlpha).toBe(0.2);
  });

  it("supports authored path trim, fill, and closure", () => {
    const context = createCanvasContextSpy();

    drawPath(context, {
      closed: true,
      fill: "rgba(10,20,30,0.4)",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 5 },
        { x: 20, y: 10 },
        { x: 30, y: 15 },
      ],
      progress: 1,
      startProgress: 0.5,
    });

    expect(context.moveTo).toHaveBeenCalledWith(10, 5);
    expect(context.closePath).toHaveBeenCalledOnce();
    expect(context.fillStyle).toBe("rgba(10,20,30,0.4)");
    expect(context.fill).toHaveBeenCalledOnce();
    expect(context.stroke).toHaveBeenCalledOnce();
  });

  it("draws deterministic particles and skips short paths", () => {
    const context = createCanvasContextSpy();

    drawPath(context, { points: [{ x: 0, y: 0 }] });
    expect(context.save).not.toHaveBeenCalled();

    drawParticles(context, {
      alpha: 0.4,
      color: "#fff",
      count: 3,
      height: 40,
      progress: 0.25,
      seed: 2,
      width: 100,
    });

    expect(context.fillStyle).toBe("#fff");
    expect(context.fillRect).toHaveBeenCalledTimes(3);
    expect(context.fillRect.mock.calls[0]).toEqual([
      51.287847430947295, 16.140858295386614, 1.4, 1.4,
    ]);
    expect(context.restore).toHaveBeenCalledOnce();
  });

  it("accepts opacity as particle alpha alias", () => {
    const context = createCanvasContextSpy();

    drawParticles(context, {
      count: 1,
      opacity: 0.2,
      seed: 1,
    });

    expect(context.globalAlpha).toBeCloseTo(0.07);
    expect(context.fillRect).toHaveBeenCalledOnce();
  });
});

function createCanvasContextSpy(): any {
  return {
    arcTo: vi.fn(),
    beginPath: vi.fn(),
    canvas: { height: 80, width: 120 },
    closePath: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
    fillText: vi.fn(),
    globalAlpha: 1,
    lineCap: "",
    lineJoin: "",
    lineWidth: 0,
    measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    shadowBlur: 0,
    shadowColor: "",
    stroke: vi.fn(),
    strokeStyle: "",
    textAlign: "",
    textBaseline: "",
  };
}
