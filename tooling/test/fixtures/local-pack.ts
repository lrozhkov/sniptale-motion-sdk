import {
  EFFECT_V1_KINDS,
  type EffectV1Command,
  type EffectV1Document,
  type EffectV1Kind,
  type EffectV1RuntimeInputName,
} from "../../../src/sdk/effect-v1/types.js";
import type { Stats } from "node:fs";
import { lstat, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "../../..");
const TEMP_ROOT = resolve(REPOSITORY_ROOT, ".tmp");
const DEFAULT_OUTPUT = resolve(TEMP_ROOT, "public/packs/demo");
const SVG_SOURCE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#5f7cff"/></svg>\n';
const KINDS = EFFECT_V1_KINDS;

export function createNeutralEffectV1Document(
  kind: EffectV1Kind,
): EffectV1Document {
  if (!KINDS.includes(kind)) {
    throw new Error("Unsupported Effect v1 kind.");
  }
  const inputCommands =
    kind === "targetEffect"
      ? [imageInputCommand("source")]
      : kind === "transition"
        ? [imageInputCommand("from"), imageInputCommand("to")]
        : [];
  const suffix = kind === "targetEffect" ? "target-effect" : kind;

  return {
    assets: [],
    clips: [],
    controls: [],
    description: {
      en: `Neutral ${kind} contract fixture.`,
      ru: `Нейтральная проверка контракта ${kind}.`,
    },
    duration: 2,
    id: `neutral-${suffix}`,
    kind,
    label: {
      en: `Neutral ${kind}`,
      ru: `Нейтральный ${kind}`,
    },
    layers: [],
    program: {
      commands: [{ color: "#101820", op: "clear" }, ...inputCommands],
      kind: "graph",
      version: 1,
    },
    scenes: [{ duration: 2, id: "main", start: 0 }],
    schemaVersion: "sniptale.effect.v1",
    timeline: { phases: [], tracks: [] },
  };
}

export async function generateNeutralLocalPack(output = DEFAULT_OUTPUT) {
  const root = resolve(output);
  assertTemporaryOutput(root);
  await prepareTemporaryOutput(root);

  const assetPath = resolve(root, "assets/neutral-mark.svg");
  const documents = KINDS.map(createNeutralEffectV1Document);
  const documentPaths = documents.map((document) =>
    resolve(root, `effects/${document.id}.sniptale-effect.json`),
  );
  const manifestPath = resolve(root, "manifest.json");
  const manifest = {
    assets: [
      {
        id: "neutral-mark",
        kind: "svg",
        mimeType: "image/svg+xml",
        path: "assets/neutral-mark.svg",
        size: Buffer.byteLength(SVG_SOURCE),
      },
    ],
    description: {
      en: "Generated neutral local test pack.",
      ru: "Сгенерированный нейтральный локальный тестовый pack.",
    },
    engineVersion: "2.0-prototype",
    label: { en: "Neutral test pack", ru: "Нейтральный тестовый pack" },
    modules: documents.map((document) => ({
      document: `effects/${document.id}.sniptale-effect.json`,
      id: document.id,
    })),
    packId: "sniptale.test.neutral-pack",
    templates: [],
    version: "0.0.0-test",
  };

  await rm(root, { force: true, recursive: true });
  await Promise.all([
    mkdir(resolve(root, "assets"), { recursive: true }),
    mkdir(resolve(root, "effects"), { recursive: true }),
  ]);
  await assertNoSymlinkAncestor(TEMP_ROOT, root);
  await assertRealTemporaryPath(root);
  await Promise.all([
    writeFile(assetPath, SVG_SOURCE, "utf8"),
    ...documents.map((document) =>
      writeFile(
        resolve(root, `effects/${document.id}.sniptale-effect.json`),
        `${JSON.stringify(document, null, 2)}\n`,
        "utf8",
      ),
    ),
    writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
  ]);

  return { assetPath, documentPaths, manifestPath, root };
}

async function prepareTemporaryOutput(output: string): Promise<void> {
  await assertNoSymlinkAncestor(REPOSITORY_ROOT, TEMP_ROOT);
  await mkdir(TEMP_ROOT, { recursive: true });
  await assertRealTemporaryPath(TEMP_ROOT, true);
  await assertNoSymlinkAncestor(TEMP_ROOT, output);
}

async function assertNoSymlinkAncestor(
  parent: string,
  target: string,
): Promise<void> {
  const pathFromParent = relative(parent, target);
  let current = parent;
  for (const segment of pathFromParent.split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    let stats: Stats;
    try {
      stats = await lstat(current);
    } catch (error) {
      if (
        error !== null &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      )
        return;
      throw error;
    }
    if (stats.isSymbolicLink()) {
      throw new Error(`Local pack output cannot cross symlink ${current}.`);
    }
  }
}

async function assertRealTemporaryPath(
  path: string,
  allowRoot = false,
): Promise<void> {
  const [repositoryRoot, temporaryRoot, realPath] = await Promise.all([
    realpath(REPOSITORY_ROOT),
    realpath(TEMP_ROOT),
    realpath(path),
  ]);
  if (
    !isContainedPath(repositoryRoot, temporaryRoot, true) ||
    !isContainedPath(temporaryRoot, realPath, allowRoot)
  ) {
    throw new Error(`Local pack fixtures must stay inside ${TEMP_ROOT}.`);
  }
}

function assertTemporaryOutput(output: string): void {
  const pathFromTemp = relative(TEMP_ROOT, output);
  if (
    pathFromTemp === "" ||
    pathFromTemp === ".." ||
    pathFromTemp.startsWith(`..${sep}`) ||
    isAbsolute(pathFromTemp)
  ) {
    throw new Error(
      `Local pack fixtures must be generated below ${TEMP_ROOT}.`,
    );
  }
}

function isContainedPath(
  root: string,
  target: string,
  allowRoot: boolean,
): boolean {
  const pathFromRoot = relative(root, target);
  return (
    (allowRoot && pathFromRoot === "") ||
    (pathFromRoot !== "" &&
      pathFromRoot !== ".." &&
      !pathFromRoot.startsWith(`..${sep}`) &&
      !isAbsolute(pathFromRoot))
  );
}

function imageInputCommand(
  input: EffectV1RuntimeInputName,
): Extract<EffectV1Command, { op: "image" }> {
  return {
    height: { op: "read", path: "height" },
    input,
    op: "image",
    width: { op: "read", path: "width" },
    x: 0,
    y: 0,
  };
}
