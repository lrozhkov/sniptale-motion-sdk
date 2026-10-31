import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { request as httpRequest } from "node:http";
import { MAX_STUDIO_SOURCE_BYTES } from "../src/shared/studio/protocol";
import { startMotionStudio } from "../src/apps/cli/studio/server";
import {
  STUDIO_REVISIONS_ROUTE,
  STUDIO_SELECTION_ROUTE,
} from "../src/shared/studio/revision-contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { initProject, newEffect } from "../src/apps/cli/project";
import { createStarterDocument } from "../src/apps/cli/starter";
import {
  adoptStudioRevision,
  saveStudioRevision,
} from "../src/apps/cli/studio/revision-store";
import {
  listStudioRevisions,
  readStudioEffect,
  readStudioRevision,
} from "../src/apps/cli/studio/revision-reader";

interface Faults {
  id: string | null;
  writeCode: string | null;
  beforePublish: (() => Promise<void>) | null;
  beforeStage: (() => void) | null;
}
const faults = vi.hoisted((): Faults => ({
  id: null,
  writeCode: null,
  beforePublish: null,
  beforeStage: null,
}));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, randomUUID: () => faults.id ?? actual.randomUUID() };
});
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    open: async (...args: Parameters<typeof actual.open>) => {
      const file =
        typeof args[0] === "string" ? args[0].replaceAll("\\", "/") : "";
      if (
        file.includes("/revisions/") &&
        file.endsWith("/effect.sniptale-effect.json") &&
        faults.writeCode
      )
        throw Object.assign(new Error("controlled file failure"), {
          code: faults.writeCode,
        });
      if (file.includes("/.tmp/studio/revision-")) faults.beforeStage?.();
      return actual.open(...args);
    },
    link: async (...args: Parameters<typeof actual.link>) => {
      await faults.beforePublish?.();
      return actual.link(...args);
    },
  };
});
const roots: string[] = [];
afterEach(async () => {
  faults.id = faults.writeCode = null;
  faults.beforePublish = faults.beforeStage = null;
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function fixture() {
  const base = join(process.cwd(), ".tmp/tests");
  await mkdir(base, { recursive: true });
  const project = await mkdtemp(join(base, "revisions-"));
  roots.push(project);
  await initProject(project, ".", "0.1.0");
  const { file } = await newEffect(project, "sample", "standalone");
  const original = await readFile(file, "utf8");
  const loaded = await readStudioEffect(project, "sample");
  const document = createStarterDocument("sample", "standalone");
  document.label = { ru: "Правка viewer", en: "Viewer edit" };
  return {
    project,
    file,
    original,
    baseRevision: loaded.selection.fingerprint,
    source: JSON.stringify(document),
  };
}

describe("durable Studio revisions", () => {
  it("persists a self-contained editable revision without changing or adopting the source", async () => {
    const { project, file, original, source, baseRevision } = await fixture();
    const saved = await saveStudioRevision(project, "sample", {
      source,
      baseRevision,
    });
    expect(saved.sourceChanged).toBe(false);
    expect(await readFile(file, "utf8")).toBe(original);
    expect(
      (await readStudioEffect(project, "sample")).selection.revisionId,
    ).toBeNull();
    const revision = await readStudioRevision(
      project,
      "sample",
      saved.revision.revisionId,
    );
    expect(revision.source).toContain("Viewer edit");
    expect(await listStudioRevisions(project, "sample")).toEqual([
      saved.revision,
    ]);
    const selected = await adoptStudioRevision(
      project,
      "sample",
      saved.revision.revisionId,
    );
    expect(selected.revisionId).toBe(saved.revision.revisionId);
    expect((await readStudioEffect(project, "sample")).source).toBe(
      revision.source,
    );
    await adoptStudioRevision(project, "sample", null);
    expect(
      (await readStudioEffect(project, "sample")).selection.fingerprint,
    ).toBe(baseRevision);
    expect(await readFile(file, "utf8")).toBe(original);
  });

  it("preserves both versions when an external writer saves between source observation and commit", async () => {
    const { project, file, source, baseRevision } = await fixture();
    const external = createStarterDocument("sample", "standalone");
    external.label = { ru: "Внешняя правка", en: "External edit" };
    const externalSource = JSON.stringify(external);
    faults.beforePublish = async () => {
      await promisify(execFile)(
        process.execPath,
        [
          "-e",
          "require('node:fs').writeFileSync(process.argv[1], process.argv[2]);",
          file,
          externalSource,
        ],
        { cwd: project, timeout: 3000 },
      );
    };
    const saved = await saveStudioRevision(project, "sample", {
      source,
      baseRevision,
    });
    expect(saved.sourceChanged).toBe(true);
    expect(saved.revision.sourceRevisionAtSave).toBe(baseRevision);
    expect(await readFile(file, "utf8")).toBe(externalSource);
    expect(
      (await readStudioRevision(project, "sample", saved.revision.revisionId))
        .source,
    ).toContain("Viewer edit");
    expect((await readStudioEffect(project, "sample")).source).toContain(
      "External edit",
    );
  });

  it("never replaces an existing revision destination", async () => {
    const { project, file, original, source, baseRevision } = await fixture();
    faults.id = "12345678-1234-4123-8123-123456789abc";
    const first = await saveStudioRevision(project, "sample", {
      source,
      baseRevision,
    });
    const bytes = (
      await readStudioRevision(project, "sample", first.revision.revisionId)
    ).source;
    await expect(
      saveStudioRevision(project, "sample", {
        source: source.replace("Viewer edit", "replacement"),
        baseRevision,
      }),
    ).rejects.toMatchObject({ code: "EEXIST" });
    expect(
      (await readStudioRevision(project, "sample", first.revision.revisionId))
        .source,
    ).toBe(bytes);
    expect(await readFile(file, "utf8")).toBe(original);
  });

  it.each(["EACCES", "ENOSPC"])(
    "does not publish partial revisions after %s",
    async (code) => {
      const { project, file, original, source, baseRevision } = await fixture();
      faults.writeCode = code;
      await expect(
        saveStudioRevision(project, "sample", { source, baseRevision }),
      ).rejects.toMatchObject({ code });
      faults.writeCode = null;
      expect(await listStudioRevisions(project, "sample")).toEqual([]);
      expect(await readFile(file, "utf8")).toBe(original);
    },
  );

  it("does not publish interrupted writes or adopt an incomplete directory", async () => {
    const { project, file, original, source, baseRevision } = await fixture();
    faults.id = "12345678-1234-4123-8123-123456789abc";
    const controller = new AbortController();
    faults.beforeStage = () => controller.abort();
    await expect(
      saveStudioRevision(
        project,
        "sample",
        { source, baseRevision },
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(await listStudioRevisions(project, "sample")).toEqual([]);
    await expect(
      adoptStudioRevision(project, "sample", faults.id),
    ).rejects.toThrow();
    expect(await readFile(file, "utf8")).toBe(original);
    expect(
      (await readStudioEffect(project, "sample")).selection.revisionId,
    ).toBeNull();
  });

  it("leaves failed commit publication unavailable", async () => {
    const { project, file, original, source, baseRevision } = await fixture();
    faults.beforePublish = async () => {
      throw Object.assign(new Error("commit failed"), { code: "ENOSPC" });
    };
    await expect(
      saveStudioRevision(project, "sample", { source, baseRevision }),
    ).rejects.toMatchObject({ code: "ENOSPC" });
    expect(await listStudioRevisions(project, "sample")).toEqual([]);
    expect(await readFile(file, "utf8")).toBe(original);
  });

  it("rejects damaged revisions and unrelated selection metadata", async () => {
    const { project, source, baseRevision } = await fixture();
    const saved = await saveStudioRevision(project, "sample", {
      source,
      baseRevision,
    });
    await writeFile(
      join(
        project,
        "effects/sample/revisions",
        saved.revision.revisionId,
        "effect.sniptale-effect.json",
      ),
      source.replace("Viewer edit", "damaged"),
    );
    expect(await listStudioRevisions(project, "sample")).toEqual([]);
    await expect(
      adoptStudioRevision(project, "sample", saved.revision.revisionId),
    ).rejects.toMatchObject({ code: "REVISION_INVALID" });
    const selectionFile = join(project, "effects/sample/current-revision.json");
    await writeFile(selectionFile, '{"foreign":true}');
    await expect(
      adoptStudioRevision(project, "sample", null),
    ).rejects.toMatchObject({ code: "SELECTION_INVALID" });
    expect(await readFile(selectionFile, "utf8")).toBe('{"foreign":true}');
  });

  it("authenticates write APIs, redacts invalid payloads and adopts only by an explicit request", async () => {
    const { project, file, original, source, baseRevision } = await fixture();
    const packageRoot = join(project, ".tmp/package");
    await mkdir(join(packageRoot, "apps/viewer"), { recursive: true });
    await mkdir(join(packageRoot, "apps/sandbox"), { recursive: true });
    const studio = await startMotionStudio(project, packageRoot);
    try {
      const token = new URL(studio.url).searchParams.get("studioSession") ?? "";
      const headers = {
        "x-sniptale-session": token,
        "Content-Type": "application/json",
        Origin: studio.viewerOrigin,
      };
      const url = `${studio.viewerOrigin}${STUDIO_REVISIONS_ROUTE}`;
      const body = JSON.stringify({ effectId: "sample", source, baseRevision });
      expect(
        (
          await fetch(url, {
            method: "POST",
            headers: {
              "x-sniptale-session": token,
              "Content-Type": "application/json",
            },
            body,
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await fetch(url, {
            method: "POST",
            headers: { ...headers, Origin: "https://evil.example" },
            body,
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await fetch(url, {
            method: "POST",
            headers: { ...headers, "x-sniptale-session": "0".repeat(64) },
            body,
          })
        ).status,
      ).toBe(403);
      const rejected = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          effectId: "sample",
          source: "PRIVATE_DOCUMENT_MARKER",
          baseRevision,
        }),
      });
      expect(rejected.status).toBe(400);
      const error = await rejected.text();
      expect(error).not.toContain("PRIVATE_DOCUMENT_MARKER");
      expect(error).not.toContain(project);
      const oversized = await new Promise<number>((resolve, reject) => {
        const request = httpRequest(
          url,
          {
            method: "POST",
            headers: {
              ...headers,
              "Content-Length": MAX_STUDIO_SOURCE_BYTES * 2 + 4097,
            },
          },
          (response) => {
            response.resume();
            response.once("end", () => resolve(response.statusCode ?? 0));
          },
        );
        request.once("error", reject);
        request.end();
      });
      expect(oversized).toBe(413);
      const response = await fetch(url, { method: "POST", headers, body });
      expect(response.status).toBe(201);
      const saved: unknown = await response.json();
      expect(saved).toMatchObject({ ok: true, sourceChanged: false });
      const revisions = await listStudioRevisions(project, "sample");
      const revisionId = revisions[0]?.revisionId;
      expect(revisionId).toBeTruthy();
      expect(
        (await readStudioEffect(project, "sample")).selection.revisionId,
      ).toBeNull();
      expect(
        (
          await fetch(`${studio.viewerOrigin}${STUDIO_SELECTION_ROUTE}`, {
            method: "POST",
            headers,
            body: JSON.stringify({ effectId: "sample", revisionId }),
          })
        ).status,
      ).toBe(200);
      expect(
        (await readStudioEffect(project, "sample")).selection.revisionId,
      ).toBe(revisionId);
      expect(await readFile(file, "utf8")).toBe(original);
    } finally {
      await studio.close();
    }
  });

  it("rejects a symlinked destination and non-materialized asset content", async () => {
    const { project, source, baseRevision } = await fixture();
    const external = join(project, "external");
    await mkdir(external);
    await symlink(external, join(project, "effects/sample/revisions"));
    await expect(
      saveStudioRevision(project, "sample", { source, baseRevision }),
    ).rejects.toThrow();
    await rm(join(project, "effects/sample/revisions"));
    const doc = createStarterDocument("sample", "standalone");
    doc.assets = [
      { id: "mark", kind: "svg", mimeType: "image/svg+xml", path: "mark.svg" },
    ];
    await expect(
      saveStudioRevision(project, "sample", {
        source: JSON.stringify(doc),
        baseRevision,
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_INVALID" });
  });
});
