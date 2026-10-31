import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { runMotionCli } from "../src/apps/cli/commands";
import { createStarterDocument } from "../src/apps/cli/starter";
import { exportMotionEffect } from "../src/apps/cli/export";
import { parseEffectV1Source } from "../src/sdk/effect-v1/index";

const faults = vi.hoisted(
  (): {
    writeCode: string | null;
    afterWrite: (() => void) | null;
    beforePublish: (() => Promise<void>) | null;
  } => ({ writeCode: null, afterWrite: null, beforePublish: null }),
);
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    open: async (...args: Parameters<typeof actual.open>) => {
      const handle = await actual.open(...args);
      if (String(args[0]).includes("motion-export-")) {
        const write = handle.writeFile.bind(handle);
        handle.writeFile = async (
          ...writeArgs: Parameters<typeof handle.writeFile>
        ) => {
          if (faults.writeCode) {
            await write("partial");
            throw Object.assign(new Error("controlled partial write"), {
              code: faults.writeCode,
            });
          }
          await write(...writeArgs);
          faults.afterWrite?.();
        };
      }
      return handle;
    },
    link: async (...args: Parameters<typeof actual.link>) => {
      await faults.beforePublish?.();
      return actual.link(...args);
    },
  };
});
const roots: string[] = [];
afterEach(async () => {
  faults.writeCode = null;
  faults.afterWrite = null;
  faults.beforePublish = null;
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function fixture(
  kind: "standalone" | "targetEffect" | "transition" = "standalone",
) {
  const base = resolve(".tmp/tests");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "cli-export-"));
  roots.push(root);
  const source = join(root, "исходный эффект.json");
  const output = join(root, "готовый эффект.sniptale-effect.json");
  await writeFile(
    source,
    JSON.stringify(createStarterDocument("sample", kind)),
  );
  return { root, source, output };
}

describe("portable CLI export", () => {
  it.each(["standalone", "targetEffect", "transition"] as const)(
    "exports %s with verifiable bytes and explicit static-only proof",
    async (kind) => {
      const { root, source, output } = await fixture(kind);
      const original = await readFile(source);
      let stdout = "";
      let stderr = "";
      expect(
        await runMotionCli(["export", source, "--output", output, "--json"], {
          cwd: root,
          packageRoot: root,
          version: "0.1.0",
          stdout: (value) => {
            stdout += value;
          },
          stderr: (value) => {
            stderr += value;
          },
        }),
      ).toBe(0);
      const bytes = await readFile(output);
      expect(JSON.parse(stdout)).toMatchObject({
        ok: true,
        output,
        byteLength: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        proof: { schema: "passed", runtime: "not-run" },
      });
      expect(stderr).toBe("");
      expect(parseEffectV1Source(bytes.toString()).ok).toBe(true);
      expect(await readFile(source)).toEqual(original);
    },
  );

  it("embeds a relative asset so the export works after the original is removed", async () => {
    const { root, source, output } = await fixture();
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><text>Привет 🌙</text></svg>';
    const document = createStarterDocument("sample", "standalone");
    document.assets = [
      { id: "mark", kind: "svg", mimeType: "image/svg+xml", path: "mark.svg" },
    ];
    document.program.commands.push({
      op: "image",
      assetId: "mark",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
    await writeFile(join(root, "mark.svg"), svg);
    await writeFile(source, JSON.stringify(document));
    expect((await exportMotionEffect(source, output)).ok).toBe(true);
    await rm(join(root, "mark.svg"));
    const copy = join(root, "copy.sniptale-effect.json");
    expect((await exportMotionEffect(output, copy)).ok).toBe(true);
    expect(
      parseEffectV1Source(await readFile(copy, "utf8")).document?.assets?.[0]
        ?.svgText,
    ).toBe(svg);
  });

  it("never replaces an existing destination or symlink target, including the source itself", async () => {
    const { root, source, output } = await fixture();
    const original = await readFile(source);
    await writeFile(output, "existing export");
    await expect(exportMotionEffect(source, output)).rejects.toMatchObject({
      code: "EEXIST",
    });
    await expect(exportMotionEffect(source, source)).rejects.toMatchObject({
      code: "EEXIST",
    });
    const alias = join(root, "alias.json");
    await symlink(output, alias);
    await expect(exportMotionEffect(source, alias)).rejects.toMatchObject({
      code: "EEXIST",
    });
    expect(await readFile(output, "utf8")).toBe("existing export");
    expect(await readFile(source)).toEqual(original);
  });

  it("lets exactly one concurrent writer publish a complete document", async () => {
    const { source, output } = await fixture();
    const results = await Promise.allSettled([
      exportMotionEffect(source, output),
      exportMotionEffect(source, output),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(parseEffectV1Source(await readFile(output, "utf8")).ok).toBe(true);
  });

  it.each(["EACCES", "ENOSPC"])(
    "does not publish after a partial write fails with %s",
    async (code) => {
      const { source, output } = await fixture();
      faults.writeCode = code;
      await expect(exportMotionEffect(source, output)).rejects.toMatchObject({
        code,
      });
      await expect(readFile(output)).rejects.toMatchObject({ code: "ENOENT" });
    },
  );

  it("retains a destination claimed by another process immediately before publication", async () => {
    const { source, output } = await fixture();
    faults.beforePublish = async () => {
      await writeFile(output, "other writer", { flag: "wx" });
    };
    await expect(exportMotionEffect(source, output)).rejects.toMatchObject({
      code: "EEXIST",
    });
    expect(await readFile(output, "utf8")).toBe("other writer");
  });

  it("does not create output for invalid source or an aborted operation", async () => {
    const { source, output } = await fixture();
    const signal = AbortSignal.abort();
    await expect(
      exportMotionEffect(source, output, { signal }),
    ).rejects.toThrow();
    await writeFile(source, "{");
    expect(await exportMotionEffect(source, output)).toMatchObject({
      ok: false,
      proof: { schema: "failed", runtime: "not-run" },
    });
    await expect(readFile(output)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not publish when cancellation arrives after the file write", async () => {
    const { source, output } = await fixture();
    const controller = new AbortController();
    faults.afterWrite = () => controller.abort();
    await expect(
      exportMotionEffect(source, output, { signal: controller.signal }),
    ).rejects.toThrow();
    await expect(readFile(output)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects a redirected staging directory", async () => {
    const { root, source, output } = await fixture();
    const other = await fixture();
    await symlink(other.root, join(root, ".tmp"), "dir");
    await expect(exportMotionEffect(source, output)).rejects.toMatchObject({
      code: "EXPORT_PATH",
    });
    await expect(readFile(output)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
