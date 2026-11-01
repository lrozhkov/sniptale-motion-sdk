import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { expect, it } from "vitest";
import {
  resolveContainedFile,
  readBoundedFile,
} from "../src/apps/cli/files.js";

it("confines caller-selected files before and after canonical resolution", async () => {
  await mkdir(resolve(".tmp/contained-files"), { recursive: true });
  const directory = await mkdtemp(resolve(".tmp/contained-files/case-"));
  try {
    const root = join(directory, "root");
    const sibling = join(directory, "root-other");
    await mkdir(root);
    await mkdir(join(root, "nested"));
    await mkdir(sibling);
    await writeFile(join(root, "inside.txt"), "permitted");
    await writeFile(join(sibling, "outside.txt"), "private");
    for (const file of [
      "inside.txt",
      "nested/../inside.txt",
      join(root, "inside.txt"),
    ]) {
      const actual = await resolveContainedFile(root, file);
      expect(actual).toBe(await realpath(join(root, "inside.txt")));
      expect((await readBoundedFile(actual, 1024)).toString()).toBe(
        "permitted",
      );
    }
    for (const file of [
      "../root-other/outside.txt",
      "nested/../../root-other/outside.txt",
      join(sibling, "outside.txt"),
    ])
      await expect(resolveContainedFile(root, file)).rejects.toThrow(
        "outside the permitted directory",
      );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
