import { createHash } from "node:crypto";

import {
  EFFECT_V1_SCHEMA,
  type EffectV1Document,
  type EffectV1Kind,
} from "../../../src/sdk/effect-v1/index.js";

export const CORPUS_VERSION = "0.1.0";
export const CORPUS_FORMAT_VERSION = "sniptale.bundle-corpus.v1";
export const BUNDLE_MANIFEST_VERSION = "sniptale.bundle.v1";
export const BUNDLE_ENGINE = "sniptale.bundle.engine2";
export const BUNDLE_ENGINE_VERSION = "2.0";
export const EFFECT_FILE_SUFFIX = ".sniptale-effect.json";
export const BUNDLE_FILE_SUFFIX = ".sniptale-bundle.zip";
export const FIXED_TEST_SDK_COMMIT = "0".repeat(40);
export const FIXED_ZIP_TIMESTAMP = "1980-01-01T00:00:00.000Z";
export const FIXED_ZIP_MODE = 0o100644;
export const FIXED_ZIP_COMPRESSION_LEVEL = 9 as const;

export type CorpusExpectation = {
  accepted: boolean;
  artifact: string;
  effectKinds?: EffectV1Kind[];
  primaryCode?: string;
};

export type CorpusScenario = {
  entries: ReadonlyMap<string, Uint8Array>;
  expectation: CorpusExpectation;
};

export type CorpusSources = {
  documents: EffectV1Document[];
  scenarios: CorpusScenario[];
};

const encoder = new TextEncoder();
const SVG_SOURCE = encoder.encode(
  [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">',
    '  <g id="ring" fill="none" stroke="#7cf7ff" stroke-width="16">',
    '    <circle id="outer" cx="120" cy="120" r="92" />',
    "  </g>",
    '  <g id="core" fill="#ff8618">',
    '    <path id="diamond" d="M120 54 186 120 120 186 54 120Z" />',
    '    <circle id="center" cx="120" cy="120" r="22" fill="#101820" />',
    "  </g>",
    "</svg>",
    "",
  ].join("\n"),
);

export function createCorpusSources(): CorpusSources {
  const standalone = createNeutralDocument("neutral-standalone", "standalone");
  const targetEffect = createNeutralDocument(
    "neutral-target-effect",
    "targetEffect",
  );
  const transition = createNeutralDocument("neutral-transition", "transition");
  const assetDocument = createAssetDocument();
  const documents = [standalone, targetEffect, transition, assetDocument];
  const documentFiles = new Map(
    documents.map((document) => [
      documentPath(document.id),
      jsonBytes(document),
    ]),
  );
  const standalonePath = documentPath(standalone.id);
  const targetPath = documentPath(targetEffect.id);
  const transitionPath = documentPath(transition.id);
  const assetDocumentPath = documentPath(assetDocument.id);
  const assetPath = "assets/neutral-mark.svg";

  const standaloneManifest = createManifest({
    documents: [[standalone, documentFiles.get(standalonePath)!]],
    packId: "sniptale.conformance.standalone-minimal",
  });
  const targetManifest = createManifest({
    documents: [[targetEffect, documentFiles.get(targetPath)!]],
    packId: "sniptale.conformance.target-effect",
  });
  const transitionManifest = createManifest({
    documents: [[transition, documentFiles.get(transitionPath)!]],
    packId: "sniptale.conformance.transition",
  });
  const assetManifest = createManifest({
    assets: [createAssetDeclaration(assetPath, SVG_SOURCE)],
    documents: [[assetDocument, documentFiles.get(assetDocumentPath)!]],
    packId: "sniptale.effect-v1.conformance",
  });
  const multiManifest = createManifest({
    assets: [createAssetDeclaration(assetPath, SVG_SOURCE)],
    documents: [
      [standalone, documentFiles.get(standalonePath)!],
      [targetEffect, documentFiles.get(targetPath)!],
      [transition, documentFiles.get(transitionPath)!],
      [assetDocument, documentFiles.get(assetDocumentPath)!],
    ],
    packId: "sniptale.conformance.multi-effect-with-asset",
  });

  const standaloneEntry = standaloneManifest.effectDocuments[0];
  if (!standaloneEntry)
    throw new Error(
      "Standalone corpus manifest must contain its effect document.",
    );
  const scenarios: CorpusScenario[] = [
    rejected(
      "invalid/asset-mime-mismatch.sniptale-bundle.zip",
      "BUNDLE_ASSET_MIME_MISMATCH",
      entries([
        [assetPath, SVG_SOURCE],
        [assetDocumentPath, documentFiles.get(assetDocumentPath)!],
        [
          "manifest.json",
          jsonBytes({
            ...assetManifest,
            assets: [
              {
                ...assetManifest.assets[0],
                kind: "image",
                mimeType: "image/png",
              },
            ],
          }),
        ],
      ]),
    ),
    rejected(
      "invalid/forbidden-executable.sniptale-bundle.zip",
      "BUNDLE_EXECUTABLE_ENTRY_FORBIDDEN",
      entries([
        [standalonePath, documentFiles.get(standalonePath)!],
        ["manifest.json", jsonBytes(standaloneManifest)],
        ["renderer.js", encoder.encode("export default {};\n")],
      ]),
    ),
    rejected(
      "invalid/hash-mismatch.sniptale-bundle.zip",
      "BUNDLE_ENTRY_HASH_MISMATCH",
      entries([
        [standalonePath, documentFiles.get(standalonePath)!],
        [
          "manifest.json",
          jsonBytes({
            ...standaloneManifest,
            effectDocuments: [
              {
                ...standaloneManifest.effectDocuments[0],
                sha256: "0".repeat(64),
              },
            ],
          }),
        ],
      ]),
    ),
    rejected(
      "invalid/missing-document.sniptale-bundle.zip",
      "BUNDLE_ENTRY_MISSING",
      entries([["manifest.json", jsonBytes(standaloneManifest)]]),
    ),
    rejected(
      "invalid/size-mismatch.sniptale-bundle.zip",
      "BUNDLE_ENTRY_SIZE_MISMATCH",
      entries([
        [standalonePath, documentFiles.get(standalonePath)!],
        [
          "manifest.json",
          jsonBytes({
            ...standaloneManifest,
            effectDocuments: [
              {
                ...standaloneManifest.effectDocuments[0],
                byteLength: standaloneEntry.byteLength + 1,
              },
            ],
          }),
        ],
      ]),
    ),
    rejected(
      "invalid/undeclared-entry.sniptale-bundle.zip",
      "BUNDLE_ENTRY_UNDECLARED",
      entries([
        [standalonePath, documentFiles.get(standalonePath)!],
        ["extra.txt", encoder.encode("undeclared\n")],
        ["manifest.json", jsonBytes(standaloneManifest)],
      ]),
    ),
    rejected(
      "invalid/unsafe-manifest-path.sniptale-bundle.zip",
      "BUNDLE_ENTRY_PATH_UNSAFE",
      entries([
        [standalonePath, documentFiles.get(standalonePath)!],
        [
          "manifest.json",
          jsonBytes({
            ...standaloneManifest,
            effectDocuments: [
              {
                ...standaloneManifest.effectDocuments[0],
                path: `../escape${EFFECT_FILE_SUFFIX}`,
              },
            ],
          }),
        ],
      ]),
    ),
    rejected(
      "invalid/wrapper-directory.sniptale-bundle.zip",
      "BUNDLE_MANIFEST_MISSING",
      entries([
        [`wrapped/${standalonePath}`, documentFiles.get(standalonePath)!],
        ["wrapped/manifest.json", jsonBytes(standaloneManifest)],
      ]),
    ),
    rejected(
      "invalid/wrong-engine.sniptale-bundle.zip",
      "BUNDLE_ENGINE_UNSUPPORTED",
      entries([
        [standalonePath, documentFiles.get(standalonePath)!],
        [
          "manifest.json",
          jsonBytes({ ...standaloneManifest, engineVersion: "1.0" }),
        ],
      ]),
    ),
    accepted(
      "valid/asset-bearing-conformance.sniptale-bundle.zip",
      ["standalone"],
      entries([
        [assetPath, SVG_SOURCE],
        [assetDocumentPath, documentFiles.get(assetDocumentPath)!],
        ["manifest.json", jsonBytes(assetManifest)],
      ]),
    ),
    accepted(
      "valid/multi-effect-with-asset.sniptale-bundle.zip",
      ["standalone", "targetEffect", "transition", "standalone"],
      entries([
        [assetPath, SVG_SOURCE],
        [assetDocumentPath, documentFiles.get(assetDocumentPath)!],
        [standalonePath, documentFiles.get(standalonePath)!],
        [targetPath, documentFiles.get(targetPath)!],
        [transitionPath, documentFiles.get(transitionPath)!],
        ["manifest.json", jsonBytes(multiManifest)],
      ]),
    ),
    accepted(
      "valid/standalone-minimal.sniptale-bundle.zip",
      ["standalone"],
      entries([
        [standalonePath, documentFiles.get(standalonePath)!],
        ["manifest.json", jsonBytes(standaloneManifest)],
      ]),
    ),
    accepted(
      "valid/target-effect.sniptale-bundle.zip",
      ["targetEffect"],
      entries([
        [targetPath, documentFiles.get(targetPath)!],
        ["manifest.json", jsonBytes(targetManifest)],
      ]),
    ),
    accepted(
      "valid/transition.sniptale-bundle.zip",
      ["transition"],
      entries([
        [transitionPath, documentFiles.get(transitionPath)!],
        ["manifest.json", jsonBytes(transitionManifest)],
      ]),
    ),
  ];

  return { documents, scenarios };
}

export function jsonBytes(value: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify(value, null, 2)}\n`);
}

export function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function createNeutralDocument(
  id: string,
  kind: EffectV1Kind,
): EffectV1Document {
  const inputCommands =
    kind === "targetEffect"
      ? [
          { op: "clear" },
          {
            fit: "cover",
            height: { op: "read", path: "height" },
            input: "source",
            op: "image",
            width: { op: "read", path: "width" },
            x: 0,
            y: 0,
          },
        ]
      : kind === "transition"
        ? [
            { op: "clear" },
            {
              alpha: {
                args: [1, { op: "read", path: "progress" }],
                op: "sub",
              },
              fit: "cover",
              height: { op: "read", path: "height" },
              input: "from",
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
              op: "image",
              width: { op: "read", path: "width" },
              x: 0,
              y: 0,
            },
          ]
        : [{ color: "#101820", op: "clear" }];
  const label = id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return {
    assets: [],
    clips: [],
    controls: [],
    description: {
      en: `Neutral ${kind} corpus fixture.`,
      ru: `Нейтральный corpus fixture ${kind}.`,
    },
    duration: 2,
    id,
    kind,
    label: { en: label, ru: label },
    layers: [],
    program: { commands: inputCommands, kind: "graph", version: 1 },
    scenes: [{ duration: 2, id: "main", label: "Main", start: 0 }],
    schemaVersion: EFFECT_V1_SCHEMA,
    timeline: { phases: [], tracks: [] },
  } as EffectV1Document;
}

function createAssetDocument(): EffectV1Document {
  const document = createNeutralDocument(
    "neutral-runtime-conformance",
    "standalone",
  );
  const path = "assets/neutral-mark.svg";
  return {
    ...document,
    assets: [
      {
        byteLength: SVG_SOURCE.byteLength,
        height: 240,
        id: "neutral-mark",
        kind: "svg",
        mimeType: "image/svg+xml",
        path,
        sha256: sha256(SVG_SOURCE),
        width: 240,
      },
    ],
    program: {
      commands: [
        { color: "#101820", op: "clear" },
        {
          assetId: "neutral-mark",
          height: 240,
          op: "svgParts",
          width: 240,
          x: 520,
          y: 240,
        },
      ],
      kind: "graph",
      version: 1,
    },
  } as EffectV1Document;
}

function createManifest({
  assets = [],
  documents,
  packId,
}: {
  assets?: Array<Record<string, unknown>>;
  documents: Array<[EffectV1Document, Uint8Array]>;
  packId: string;
}) {
  return {
    assets,
    effectDocuments: documents.map(([document, bytes]) => ({
      byteLength: bytes.byteLength,
      id: document.id,
      path: documentPath(document.id),
      schemaVersion: EFFECT_V1_SCHEMA,
      sha256: sha256(bytes),
    })),
    engineVersion: BUNDLE_ENGINE_VERSION,
    label: { en: "Neutral corpus pack", ru: "Нейтральный corpus pack" },
    manifestVersion: BUNDLE_MANIFEST_VERSION,
    packId,
    version: CORPUS_VERSION,
  };
}

function createAssetDeclaration(path: string, bytes: Uint8Array) {
  return {
    byteLength: bytes.byteLength,
    kind: "svg",
    mimeType: "image/svg+xml",
    path,
    sha256: sha256(bytes),
  };
}

function documentPath(id: string): string {
  return `effects/${id}${EFFECT_FILE_SUFFIX}`;
}

function entries(
  values: Array<[string, Uint8Array]>,
): ReadonlyMap<string, Uint8Array> {
  return new Map(values.sort(([left], [right]) => codePointOrder(left, right)));
}

function rejected(
  artifact: string,
  primaryCode: string,
  archiveEntries: ReadonlyMap<string, Uint8Array>,
): CorpusScenario {
  return {
    entries: archiveEntries,
    expectation: { accepted: false, artifact, primaryCode },
  };
}

function accepted(
  artifact: string,
  effectKinds: EffectV1Kind[],
  archiveEntries: ReadonlyMap<string, Uint8Array>,
): CorpusScenario {
  return {
    entries: archiveEntries,
    expectation: { accepted: true, artifact, effectKinds },
  };
}

export function codePointOrder(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
