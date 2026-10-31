import semver from "semver";
import { join } from "node:path";
import { realpath } from "node:fs/promises";
import { readBoundedFile } from "./files.js";
import { MotionCliError } from "./errors.js";
import { MOTION_COMPATIBILITY } from "../../shared/compatibility.js";

export const PROJECT_FILE = "sniptale-motion.json";
export type MotionProjectContract = {
  schemaVersion: typeof MOTION_COMPATIBILITY.projectSchema;
  effectSchema: typeof MOTION_COMPATIBILITY.effectSchema;
  toolkitCompatibility: typeof MOTION_COMPATIBILITY.toolkitCompatibility;
  createdWith: string | null;
  legacy: boolean;
};
export function parseProjectContract(
  value: unknown,
): MotionProjectContract | null {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== MOTION_COMPATIBILITY.projectSchema ||
    !("effectSchema" in value) ||
    value.effectSchema !== MOTION_COMPATIBILITY.effectSchema
  )
    return null;
  if (
    "toolkitCompatibility" in value &&
    value.toolkitCompatibility !== MOTION_COMPATIBILITY.toolkitCompatibility
  )
    return null;
  let createdWith: string | null = null;
  if ("createdWith" in value && value.createdWith !== null) {
    if (
      typeof value.createdWith !== "string" ||
      semver.valid(value.createdWith) !== value.createdWith
    )
      return null;
    createdWith = value.createdWith;
  }
  return {
    schemaVersion: MOTION_COMPATIBILITY.projectSchema,
    effectSchema: MOTION_COMPATIBILITY.effectSchema,
    toolkitCompatibility: MOTION_COMPATIBILITY.toolkitCompatibility,
    createdWith,
    legacy: !("toolkitCompatibility" in value),
  };
}
export async function readProjectContract(
  cwd: string,
): Promise<{ root: string; contract: MotionProjectContract }> {
  const root = await realpath(cwd);
  let value: unknown;
  try {
    value = JSON.parse(
      (await readBoundedFile(join(root, PROJECT_FILE), 16_384)).toString(
        "utf8",
      ),
    );
  } catch {
    throw new MotionCliError(
      "PROJECT_REQUIRED",
      "Run init or enter a readable Sniptale Motion project.",
    );
  }
  const contract = parseProjectContract(value);
  if (!contract)
    throw new MotionCliError(
      "PROJECT_VERSION",
      "Unsupported project compatibility contract; project files were not changed.",
    );
  return { root, contract };
}
