import {
  type EffectV1Document,
  type EffectV1Kind,
} from "../../../src/sdk/effect-v1/index.js";
import { createNeutralEffectV1Document as createDocument } from "./local-pack.mjs";

export type EffectV1DiagnosticExpectation = {
  code: string;
  path: string;
};

export type InvalidEffectV1Case = {
  document: unknown;
  expected: EffectV1DiagnosticExpectation[];
  id: string;
};

export function createNeutralEffectV1Document(
  kind: EffectV1Kind,
): EffectV1Document {
  return createDocument(kind) as EffectV1Document;
}

export function createInvalidEffectV1Cases(): InvalidEffectV1Case[] {
  return [
    {
      document: {
        ...createNeutralEffectV1Document("standalone"),
        schemaVersion: "sniptale.effect.v3",
      },
      expected: [{ code: "SCHEMA_UNSUPPORTED", path: "$.schemaVersion" }],
      id: "wrong-schema",
    },
    {
      document: {
        ...createNeutralEffectV1Document("standalone"),
        renderer: { source: "return canvas" },
      },
      expected: [
        { code: "UNKNOWN_FIELD", path: "$.renderer" },
        { code: "EXECUTABLE_FIELD_FORBIDDEN", path: "$.renderer" },
        {
          code: "EXECUTABLE_FIELD_FORBIDDEN",
          path: "$.renderer.source",
        },
      ],
      id: "executable-field",
    },
    {
      document: {
        ...createNeutralEffectV1Document("transition"),
        program: {
          commands: [{ op: "clear" }],
          kind: "graph",
          version: 1,
        },
      },
      expected: [
        { code: "RUNTIME_INPUT_REQUIRED", path: "$.program.commands" },
        { code: "RUNTIME_INPUT_REQUIRED", path: "$.program.commands" },
      ],
      id: "missing-transition-inputs",
    },
    {
      document: {
        ...createNeutralEffectV1Document("standalone"),
        assets: [
          {
            id: "escaped",
            kind: "svg",
            mimeType: "image/svg+xml",
            path: "../secret.svg",
          },
        ],
        program: {
          commands: [
            { color: "#101820", op: "clear" },
            {
              assetId: "escaped",
              height: 100,
              op: "svgParts",
              width: 100,
              x: 0,
              y: 0,
            },
          ],
          kind: "graph",
          version: 1,
        },
      },
      expected: [{ code: "ASSET_PATH_UNSAFE", path: "$.assets[0].path" }],
      id: "unsafe-asset-path",
    },
    {
      document: {
        ...createNeutralEffectV1Document("standalone"),
        program: {
          commands: [
            { color: "#101820", op: "clear" },
            {
              from: 0,
              lineWidth: 2,
              op: "sampledPath",
              samples: 1024,
              stroke: "#ffffff",
              to: 1,
              x: 0,
              y: 0,
            },
          ],
          kind: "graph",
          version: 1,
        },
      },
      expected: [
        {
          code: "SAMPLED_PATH_BOUND",
          path: "$.program.commands[1].samples",
        },
      ],
      id: "unbounded-sampled-path",
    },
    {
      document: {
        ...createNeutralEffectV1Document("standalone"),
        controls: [
          {
            defaultValue: 0.5,
            id: "strength",
            kind: "number",
            label: { en: "Strength", ru: "Сила" },
            max: 1,
            min: 0,
          },
        ],
      },
      expected: [{ code: "CONTROL_UNUSED", path: "$.controls[0]" }],
      id: "unused-control",
    },
    {
      document: {
        ...createNeutralEffectV1Document("standalone"),
        program: {
          commands: [
            { color: "#101820", op: "clear" },
            { op: "executeJavaScript" },
          ],
          kind: "graph",
          version: 1,
        },
      },
      expected: [{ code: "COMMAND_OP", path: "$.program.commands[1].op" }],
      id: "unknown-command",
    },
    {
      document: {
        ...createNeutralEffectV1Document("standalone"),
        clips: [{ duration: 1, layerId: "card", sceneId: "main", start: 0 }],
        layers: [{ id: "card", name: "Card", type: "customDraw" }],
        timeline: {
          phases: [],
          tracks: [
            {
              id: "card.opacity",
              keyframes: [
                { id: "start", time: 0, value: 0 },
                { id: "end", time: 1, value: 1 },
              ],
              property: "opacity",
              target: "card",
            },
          ],
        },
      },
      expected: [{ code: "TRACK_UNUSED", path: "$.timeline.tracks[0]" }],
      id: "unused-track",
    },
    {
      document: {
        ...createNeutralEffectV1Document("standalone"),
        timeline: {
          phases: [
            {
              duration: 1,
              id: "intro",
              sceneId: "main",
              start: 0,
            },
          ],
          tracks: [],
        },
      },
      expected: [{ code: "PHASE_UNUSED", path: "$.timeline.phases[0]" }],
      id: "unused-phase",
    },
    {
      document: {
        ...createNeutralEffectV1Document("standalone"),
        controls: [
          {
            defaultValue: 2,
            id: "fixed",
            kind: "number",
            max: 1,
            min: 1,
            step: 0,
          },
        ],
        program: {
          commands: [
            { color: "#101820", op: "clear" },
            {
              alpha: { op: "read", path: "controls.fixed" },
              fill: "#ffffff",
              height: 1,
              op: "fillRect",
              width: 1,
              x: 0,
              y: 0,
            },
          ],
          kind: "graph",
          version: 1,
        },
      },
      expected: [
        { code: "CONTROL_RANGE", path: "$.controls[0]" },
        { code: "CONTROL_STEP", path: "$.controls[0].step" },
        {
          code: "CONTROL_DEFAULT_RANGE",
          path: "$.controls[0].defaultValue",
        },
      ],
      id: "unusable-number-control",
    },
  ];
}
