import { mkdir, mkdtemp, open, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { expect, it } from "vitest";
import { readCommandOutput } from "./command-output.ts";

it("reads the original command descriptor from offset zero and bounds output size", async () => {
  await mkdir(resolve(".tmp/command-output-tests"), { recursive: true });
  const root = await mkdtemp(resolve(".tmp/command-output-tests/output-"));
  const handle = await open(join(root, "output"), "wx+");
  try {
    await handle.writeFile('{"result":"passed"}');
    expect(await readCommandOutput(handle)).toBe('{"result":"passed"}');
    await handle.truncate(64 * 1024 * 1024 + 1);
    await expect(readCommandOutput(handle)).rejects.toThrow("within 64 MiB");
  } finally {
    await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});
