import path from "node:path";
import type { LegalOutputOptions } from "./model.ts";
import {
  assertContainedAbsolute,
  loadLegalSettings,
  rejectSymlinkSegments,
} from "./boundary.ts";
import { assembleLegalBundle } from "./materials.ts";
export async function prepareLegalOutput({
  repoRoot = process.cwd(),
  outputRoot = repoRoot,
  policyPath,
}: LegalOutputOptions = {}) {
  const root = path.resolve(repoRoot);
  const output = assertContainedAbsolute(root, outputRoot, "legal output root");
  const outputRelative = path.relative(root, output).split(path.sep).join("/");
  if (outputRelative !== "")
    await rejectSymlinkSegments(root, outputRelative, "legal output root");
  const settings = await loadLegalSettings(root, policyPath);
  const bundle = await assembleLegalBundle({
    repoRoot: root,
    settingsPath: policyPath,
  });
  return { root, output, settings, bundle };
}
