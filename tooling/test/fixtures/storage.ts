import { mkdir, mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";

export async function createFixtureDirectory(prefix: string): Promise<string> {
  if (!/^[a-z0-9-]+$/i.test(prefix))
    throw new Error(
      "Fixture prefix must contain only letters, digits and dashes.",
    );
  const base = resolve(".tmp/tests");
  await mkdir(base, { recursive: true });
  return mkdtemp(join(base, prefix));
}
