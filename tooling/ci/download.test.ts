import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { expect, it } from "vitest";
import { downloadPinnedArchive } from "./download.cjs";

it("publishes only bounded bytes with the pinned digest and removes failed downloads", async () => {
  mkdirSync(resolve(".tmp/download-tests"), { recursive: true });
  const root = mkdtempSync(resolve(".tmp/download-tests/archive-"));
  try {
    const text = "verified upstream archive";
    const digest = createHash("sha256").update(text).digest("hex");
    const fetchArchive: typeof fetch = () =>
      Promise.resolve(new Response(text));
    const file = join(root, "verified");
    await downloadPinnedArchive(
      "https://example.invalid/archive",
      file,
      digest,
      1024,
      fetchArchive,
    );
    expect(readFileSync(file, "utf8")).toBe(text);
    const denied = join(root, "denied");
    await expect(
      downloadPinnedArchive(
        "https://example.invalid/archive",
        denied,
        "0".repeat(64),
        1024,
        fetchArchive,
      ),
    ).rejects.toThrow("SHA-256");
    await expect(
      downloadPinnedArchive(
        "https://example.invalid/archive",
        denied,
        digest,
        2,
        fetchArchive,
      ),
    ).rejects.toThrow("byte limit");
    await expect(
      downloadPinnedArchive(
        "https://example.invalid/archive",
        denied,
        digest,
        1024,
        () => Promise.resolve(new Response("", { status: 503 })),
      ),
    ).rejects.toThrow("HTTP 503");
    expect(existsSync(denied)).toBe(false);
    expect(readdirSync(root)).toEqual(["verified"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
