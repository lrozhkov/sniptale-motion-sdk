import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { MotionCliError } from "./errors.js";

export function containsPath(root: string, target: string): boolean {
  const path = relative(root, target);
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

export async function readBoundedFile(
  file: string,
  maximumBytes: number,
): Promise<Buffer> {
  const handle = await open(
    file,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size > maximumBytes)
      throw new MotionCliError(
        "FILE_LIMIT",
        "Expected a regular file within the size limit.",
      );
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const after = await handle.stat();
    if (
      offset !== before.size ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      after.ctimeMs !== before.ctimeMs
    )
      throw new MotionCliError(
        "FILE_CHANGED",
        "The file changed while it was read. Retry after saving has completed.",
      );
    return bytes;
  } finally {
    await handle.close();
  }
}

export async function resolveContainedFile(
  root: string,
  path: string,
): Promise<string> {
  const target = resolve(root, path);
  if (!containsPath(root, target))
    throw new MotionCliError(
      "FILE_PATH",
      "The path is outside the permitted directory.",
    );
  const actual = await realpath(target);
  if (!containsPath(root, actual))
    throw new MotionCliError(
      "FILE_PATH",
      "The path resolves outside the permitted directory.",
    );
  return actual;
}
