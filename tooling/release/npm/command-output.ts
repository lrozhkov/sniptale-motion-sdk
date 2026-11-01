import type { FileHandle } from "node:fs/promises";

export async function readCommandOutput(handle: FileHandle): Promise<string> {
  const before = await handle.stat();
  if (!before.isFile() || before.size > 64 * 1024 * 1024)
    throw new Error("Command output must be a regular file within 64 MiB.");
  const bytes = Buffer.alloc(before.size);
  let offset = 0;
  while (offset < bytes.length) {
    const result = await handle.read(
      bytes,
      offset,
      bytes.length - offset,
      offset,
    );
    if (result.bytesRead === 0) break;
    offset += result.bytesRead;
  }
  const after = await handle.stat();
  if (
    offset !== before.size ||
    after.size !== before.size ||
    after.mtimeMs !== before.mtimeMs
  )
    throw new Error("Command output changed while it was read.");
  return bytes.toString("utf8");
}
