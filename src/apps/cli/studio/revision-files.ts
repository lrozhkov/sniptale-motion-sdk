import { constants } from "node:fs";
import { mkdir, open, realpath, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { readProject } from "../project.js";
import { resolveContainedFile } from "../files.js";
import {
  isRecord,
  isStudioEffectId,
} from "../../../shared/studio/revision-contract.js";
import { StudioRevisionError } from "./revision-error.js";

export const DOCUMENT_FILE = "effect.sniptale-effect.json";
export const COMMIT_FILE = "revision.json";
export const SELECTION_FILE = "current-revision.json";

export function isMissing(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

export async function effectDirectory(
  project: string,
  id: string,
): Promise<string> {
  if (!isStudioEffectId(id))
    throw new StudioRevisionError("EFFECT_ID", "Invalid project effect id.");
  const root = await readProject(project);
  const effects = join(root, "effects");
  if ((await realpath(effects)) !== effects)
    throw new StudioRevisionError(
      "PROJECT_PATH",
      "The effects directory must not be a symlink.",
    );
  const directory = await resolveContainedFile(effects, id);
  if (directory !== join(effects, id) || !(await stat(directory)).isDirectory())
    throw new StudioRevisionError(
      "PROJECT_PATH",
      "Expected a project effect directory.",
    );
  return directory;
}

export async function ownedDirectory(
  parent: string,
  name: string,
): Promise<string> {
  const directory = join(parent, name);
  try {
    await mkdir(directory);
  } catch (error) {
    if (!isRecord(error) || error.code !== "EEXIST") throw error;
  }
  if (
    (await resolveContainedFile(parent, name)) !== directory ||
    !(await stat(directory)).isDirectory()
  )
    throw new StudioRevisionError(
      "PROJECT_PATH",
      "Expected an ordinary project directory.",
    );
  return directory;
}

export async function writeExclusive(
  file: string,
  source: string,
): Promise<void> {
  const handle = await open(
    file,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.writeFile(source, "utf8");
    await handle.sync();
  } catch (error) {
    await handle.close();
    await rm(file).catch(() => undefined);
    throw error;
  }
  await handle.close();
}

export async function syncDirectory(directory: string): Promise<void> {
  // Windows does not support opening a directory for fsync through this API.
  if (process.platform === "win32") return;
  const handle = await open(
    directory,
    constants.O_RDONLY | constants.O_DIRECTORY,
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function stagingDirectory(project: string): Promise<string> {
  return ownedDirectory(
    await ownedDirectory(await readProject(project), ".tmp"),
    "studio",
  );
}
