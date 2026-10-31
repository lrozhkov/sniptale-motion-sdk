import { readDomMotionTemplateDocument } from "../src/apps/viewer/dom-motion/template.js";
import { describe, expect, it } from "vitest";
import {
  parseDomMotionDocument,
  parseDomMotionTimeline,
} from "../src/sdk/dom-motion/validation.js";
import { evaluateTimelineKeyframes } from "../src/sdk/timeline/keyframe-value.js";

function source() {
  return {
    schemaVersion: "sniptale.dom-motion.v1",
    id: "retreat",
    label: { ru: "Отдых", en: "Retreat" },
    duration: 10,
    width: 400,
    height: 240,
    html: '<section id="trip"><h2>Алтайский рассвет</h2></section>',
    bindings: [
      {
        id: "trip",
        label: { ru: "Поездка", en: "Trip" },
        selector: "#trip",
        parts: "h2",
        stagger: 0.2,
        depth: 100,
        spread: 20,
      },
    ],
    timeline: {
      phases: [],
      tracks: [
        {
          id: "trip.assembly",
          target: "trip",
          property: "assembly",
          keyframes: [
            { time: 0, value: 0 },
            { time: 10, value: 1 },
          ],
        },
      ],
    },
  };
}
describe("DOM motion document boundary", () => {
  it("parses the embedded viewer document without asserting the surrounding template", () => {
    expect(readDomMotionTemplateDocument(null)).toBeNull();
    expect(readDomMotionTemplateDocument({ id: "plain" })).toBeNull();
    expect(() => readDomMotionTemplateDocument({ domMotion: true })).toThrow();
    expect(() =>
      readDomMotionTemplateDocument({ domMotion: { id: "fake" } }),
    ).toThrow();
    const input = source();
    const embedded = readDomMotionTemplateDocument({ domMotion: input });
    expect(embedded?.id).toBe("retreat");
    expect(embedded).not.toBe(input);
  });
  it("parses a separate HTML contract without accepting executable renderers", () => {
    const input = {
      ...source(),
      renderer: () => {
        throw new Error("must not execute");
      },
    };
    const parsed = parseDomMotionDocument(input);
    expect(parsed).not.toHaveProperty("renderer");
    expect(parsed.bindings[0].parts).toBe("h2");
    input.bindings[0].depth = 999;
    expect(parsed.bindings[0].depth).toBe(100);
  });
  it.each([NaN, Infinity, 0, -1, 301, "10"])(
    "rejects unbounded duration %s",
    (duration) => {
      expect(() => parseDomMotionDocument({ ...source(), duration })).toThrow();
    },
  );
  it("bounds layer lift while allowing assembly from either side", () => {
    const input = source();
    expect(
      parseDomMotionDocument({
        ...input,
        bindings: [
          {
            ...input.bindings[0],
            lift: -100,
            spread: -20,
            tiltY: 20,
            partDelay: 0.2,
          },
        ],
      }).bindings[0].spread,
    ).toBe(-20);
    for (const partDelay of [-0.01, 2.01, NaN, "0.2"])
      expect(() =>
        parseDomMotionDocument({
          ...input,
          bindings: [{ ...input.bindings[0], partDelay }],
        }),
      ).toThrow(/partDelay/);
    expect(() =>
      parseDomMotionDocument({
        ...input,
        bindings: [{ ...input.bindings[0], lift: -2001 }],
      }),
    ).toThrow(/lift/);
    expect(() =>
      parseDomMotionDocument({
        ...input,
        bindings: [{ ...input.bindings[0], tiltX: 46 }],
      }),
    ).toThrow(/tiltX/);
    expect(() =>
      parseDomMotionDocument({
        ...input,
        bindings: [{ ...input.bindings[0], partLift: 2001 }],
      }),
    ).toThrow(/partLift/);
    expect(() =>
      parseDomMotionDocument({
        ...input,
        bindings: [{ ...input.bindings[0], lift: 2001 }],
      }),
    ).toThrow(/lift/);
  });
  it("requires bilingual metadata and bounded viewport/HTML", () => {
    expect(() =>
      parseDomMotionDocument({ ...source(), label: { ru: "Поездка" } }),
    ).toThrow(/locale/);
    expect(() =>
      parseDomMotionDocument({ ...source(), width: 8192, height: 8192 }),
    ).toThrow(/viewport/);
    expect(() => parseDomMotionDocument({ ...source(), width: 1.5 })).toThrow(
      /viewport/,
    );
    expect(() =>
      parseDomMotionDocument({ ...source(), html: "x".repeat(12_000_001) }),
    ).toThrow(/HTML/);
  });
  it("rejects duplicate and reserved binding identifiers", () => {
    const input = source();
    input.bindings.push({ ...input.bindings[0] });
    expect(() => parseDomMotionDocument(input)).toThrow(/Duplicate/);
    input.bindings = [{ ...input.bindings[0], id: "page" }];
    expect(() => parseDomMotionDocument(input)).toThrow(/Duplicate/);
  });
  it("requires observable assembly tracks and rejects unimplemented phase/path data", () => {
    const input = source();
    expect(() =>
      parseDomMotionDocument({
        ...input,
        timeline: { phases: [], tracks: [] },
      }),
    ).toThrow(/Missing/);
    expect(() =>
      parseDomMotionDocument({
        ...input,
        timeline: {
          ...input.timeline,
          phases: [{ id: "intro", start: 0, duration: 2 }],
        },
      }),
    ).toThrow(/timeline/);
    expect(() =>
      parseDomMotionDocument({
        ...input,
        timeline: { ...input.timeline, motionPaths: [] },
      }),
    ).toThrow(/timeline/);
  });
  it("restricts page assembly and panel opacity/blur to preserve descendant depth", () => {
    const input = source();
    const targets = new Set(["page", "trip"]);
    for (const [target, property] of [
      ["page", "assembly"],
      ["trip", "opacity"],
      ["trip", "blur"],
      ["trip", "scrollbarOpacity"],
      ["missing", "assembly"],
      ["page", "javascript"],
    ]) {
      expect(() =>
        parseDomMotionTimeline(
          {
            phases: [],
            tracks: [
              {
                ...input.timeline.tracks[0],
                id: `${target}.${property}`,
                target,
                property,
              },
            ],
          },
          10,
          targets,
        ),
      ).toThrow();
    }
  });
  it("accepts bounded panel geometry tracks alongside assembly", () => {
    const input = source();
    for (const property of [
      "x",
      "y",
      "z",
      "rotateX",
      "rotateY",
      "rotateZ",
      "scale",
    ]) {
      const track = {
        ...input.timeline.tracks[0],
        id: `trip.${property}`,
        property,
      };
      expect(
        parseDomMotionDocument({
          ...input,
          timeline: {
            phases: [],
            tracks: [
              ...input.timeline.tracks,
              { ...track, keyframes: [{ time: 0, value: 1 }] },
            ],
          },
        }).timeline.tracks,
      ).toHaveLength(2);
      expect(() =>
        parseDomMotionDocument({
          ...input,
          timeline: {
            phases: [],
            tracks: [
              ...input.timeline.tracks,
              { ...track, keyframes: [{ time: 0, value: 9000 }] },
            ],
          },
        }),
      ).toThrow(/value/);
    }
  });
  it("rejects unordered, duplicate, nonfinite and out-of-range keys", () => {
    const input = source(),
      track = input.timeline.tracks[0];
    for (const keyframes of [
      [
        { time: 2, value: 0 },
        { time: 1, value: 1 },
      ],
      [
        { time: 1, value: 0 },
        { time: 1, value: 1 },
      ],
      [{ time: 0, value: NaN }],
      [{ time: 0, value: 1.1 }],
      [{ time: 11, value: 1 }],
    ]) {
      expect(() =>
        parseDomMotionDocument({
          ...input,
          timeline: { phases: [], tracks: [{ ...track, keyframes }] },
        }),
      ).toThrow();
    }
  });
  it("validates easing handles and enabled flags at the receiving boundary", () => {
    const input = source(),
      track = input.timeline.tracks[0];
    for (const patch of [
      { easing: "eval" },
      { easing: "bezier", handles: { x1: -1, y1: 0, x2: 1, y2: 1 } },
      { enabled: "yes" },
      { phaseId: "intro" },
    ]) {
      expect(() =>
        parseDomMotionDocument({
          ...input,
          timeline: {
            phases: [],
            tracks: [
              { ...track, keyframes: [{ time: 0, value: 0, ...patch }] },
            ],
          },
        }),
      ).toThrow();
    }
  });
});
describe("shared Canvas and DOM interpolation", () => {
  it("uses outgoing-key easing and preserves exact boundaries for tiny segments", () => {
    const keys = [
      { time: 0, value: 0, easing: "hold" },
      { time: 1, value: 10, easing: "out" },
      { time: 2, value: 20 },
    ];
    expect(evaluateTimelineKeyframes(keys, -0.5, 100)).toBe(0);
    expect(evaluateTimelineKeyframes(keys, 0.5, 100)).toBe(0);
    expect(evaluateTimelineKeyframes(keys, 1, 100)).toBe(10);
    expect(evaluateTimelineKeyframes(keys, 1.5, 100)).toBe(18.75);
    expect(evaluateTimelineKeyframes(keys, 3, 100)).toBe(20);
    expect(
      evaluateTimelineKeyframes(
        [
          { time: 0, value: 0 },
          { time: 0.00001, value: 1 },
          { time: 1, value: 2 },
        ],
        0.00001,
        0,
      ),
    ).toBe(1);
    expect(evaluateTimelineKeyframes([], 0, 42)).toBe(42);
  });
});
