import {
  EFFECT_V1_SCHEMA,
  type EffectV1Document,
  type EffectV1Command,
  type EffectV1Kind,
} from "../../sdk/effect-v1/index.js";

export function createStarterDocument(
  id: string,
  kind: EffectV1Kind,
): EffectV1Document {
  const label = titleFromId(id);
  const inputCommands = createInputCommands(kind);
  const document: EffectV1Document = {
    assets: [],
    clips: [
      { duration: 3, layerId: "background", sceneId: "main", start: 0 },
      { duration: 3, layerId: "title", sceneId: "main", start: 0 },
    ],
    controls: [
      {
        defaultValue: "#5f7cff",
        id: "accent",
        kind: "color",
        group: "appearance",
        presentation: "color",
        label: { en: "Accent", ru: "Акцент" },
      },
    ],
    description: {
      en: `Agent-ready ${kind} starter.`,
      ru: `Стартовый шаблон ${kind} для агента.`,
    },
    duration: 3,
    id,
    kind,
    label: { en: label, ru: label },
    layers: [
      {
        height: 720,
        id: "background",
        name: "Background",
        type: "rect",
        width: 1280,
      },
      {
        height: 120,
        id: "title",
        name: "Title",
        text: label,
        type: "text",
        width: 900,
        x: 640,
        y: 360,
      },
    ],
    program: {
      commands: [
        ...inputCommands,
        {
          fill: { op: "read", path: "controls.accent" },
          height: 180,
          layerId: "background",
          op: "shape",
          radius: 32,
          shape: "roundRect",
          width: 920,
          x: {
            args: [
              140,
              {
                args: [{ op: "read", path: "progress" }, 80],
                op: "mul",
              },
            ],
            op: "add",
          },
          y: 270,
        },
        {
          align: "center",
          baseline: "middle",
          fill: "#ffffff",
          fontFamily: "system-ui",
          fontSize: 54,
          fontWeight: 650,
          layerId: "title",
          op: "text",
          text: label,
          x: 0,
          y: 0,
        },
      ],
      kind: "graph",
      version: 1,
    },
    scenes: [{ duration: 3, id: "main", label: "Main", start: 0 }],
    schemaVersion: EFFECT_V1_SCHEMA,
    timeline: { phases: [], tracks: [] },
  };
  if (kind === "standalone") {
    document.objectLayout = { width: 1280, height: 720, resize: "scale" };
  }
  return document;
}

function createInputCommands(kind: EffectV1Kind): EffectV1Command[] {
  if (kind === "targetEffect") {
    return [
      { op: "clear" },
      {
        fit: "cover",
        height: { op: "read", path: "height" },
        input: "source",
        layerId: "background",
        op: "image",
        width: { op: "read", path: "width" },
        x: 0,
        y: 0,
      },
    ];
  }
  if (kind === "transition") {
    return [
      { op: "clear" },
      {
        alpha: {
          args: [1, { op: "read", path: "progress" }],
          op: "sub",
        },
        fit: "cover",
        height: { op: "read", path: "height" },
        input: "from",
        layerId: "background",
        op: "image",
        width: { op: "read", path: "width" },
        x: 0,
        y: 0,
      },
      {
        alpha: { op: "read", path: "progress" },
        fit: "cover",
        height: { op: "read", path: "height" },
        input: "to",
        layerId: "background",
        op: "image",
        width: { op: "read", path: "width" },
        x: 0,
        y: 0,
      },
    ];
  }
  return [{ color: "#10131d", op: "clear" }];
}

function titleFromId(value: string): string {
  return value
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
