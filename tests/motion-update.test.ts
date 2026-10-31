import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assessUpdate,
  MINIMUM_UPDATE_AGE_DAYS,
} from "../src/apps/cli/updates/assessment";
import {
  checkMotionUpdate,
  UPDATE_REGISTRY_URL,
} from "../src/apps/cli/updates/check";
import { MOTION_COMPATIBILITY } from "../src/shared/compatibility";

const now = Date.UTC(2026, 9, 31);
const DAY = 86_400_000;
function version(value: string) {
  const compatibility: Record<string, string> = { ...MOTION_COMPATIBILITY };
  return {
    name: "@sniptale/motion",
    version: value,
    engines: { node: ">=22.12.0" },
    sniptaleMotion: compatibility,
    dependencies: { "playwright-core": "1.64.1" },
    bundledDependencies: ["playwright-core"],
    dist: { integrity: `sha512-${Buffer.alloc(64).toString("base64")}` },
  };
}
function metadata() {
  return {
    name: "@sniptale/motion",
    "dist-tags": { latest: "0.3.0" },
    versions: {
      "0.1.0": version("0.1.0"),
      "0.2.0": version("0.2.0"),
      "0.3.0": version("0.3.0"),
    },
    time: {
      "0.1.0": new Date(now - 90 * DAY).toISOString(),
      "0.2.0": new Date(now - 10 * DAY).toISOString(),
      "0.3.0": new Date(now - DAY).toISOString(),
    },
  };
}
afterEach(() => vi.unstubAllGlobals());
describe("explicit npm update check", () => {
  it("cancels an oversized registry stream and does not echo malformed JSON", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => controller.enqueue(new Uint8Array(16_000_001)),
      cancel: () => {
        cancelled = true;
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(stream)),
    );
    const context = {
      cwd: ".",
      packageRoot: ".",
      version: "0.1.0",
      stdout: () => {},
      stderr: () => {},
    };
    await expect(
      checkMotionUpdate(context, undefined, "en"),
    ).rejects.toMatchObject({ code: "UPDATE_REGISTRY" });
    expect(cancelled).toBe(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("SECRET_REGISTRY_BODY")),
    );
    await expect(
      checkMotionUpdate(context, undefined, "en"),
    ).rejects.not.toThrow(/SECRET_REGISTRY_BODY/);
  });
  it("holds new releases for seven days and returns exact npm arguments for a compatible mature release", () => {
    expect(MINIMUM_UPDATE_AGE_DAYS).toBe(7);
    const value = assessUpdate(metadata(), "0.1.0", undefined, now, "v24.21.0");
    expect(value).toMatchObject({
      ok: true,
      status: "available",
      version: "0.2.0",
      latest: "0.3.0",
      install: {
        global: {
          command: "npm",
          args: expect.arrayContaining([
            "@sniptale/motion@0.2.0",
            "--ignore-scripts",
            "--engine-strict",
          ]),
        },
      },
    });
    expect(
      assessUpdate(metadata(), "0.1.0", "0.3.0", now, "v24.21.0"),
    ).toMatchObject({ status: "deferred" });
  });
  it("admits exactly seven days and never selects a version above the maintainer's latest tag", () => {
    const input = metadata();
    input.time["0.3.0"] = new Date(now - 7 * DAY).toISOString();
    expect(
      assessUpdate(input, "0.1.0", undefined, now, "v24.21.0"),
    ).toMatchObject({ version: "0.3.0" });
    input["dist-tags"].latest = "0.2.0";
    expect(
      assessUpdate(input, "0.1.0", undefined, now, "v24.21.0"),
    ).toMatchObject({ version: "0.2.0" });
  });
  it("checks an explicit prerelease without silently requiring or resolving latest", () => {
    const pre = "0.4.0-rc.1";
    const input = {
      name: "@sniptale/motion",
      "dist-tags": { next: pre },
      versions: { [pre]: version(pre) },
      time: { [pre]: new Date(now - 8 * DAY).toISOString() },
    };
    expect(assessUpdate(input, "0.1.0", pre, now, "v24.21.0")).toMatchObject({
      status: "available",
      version: pre,
      latest: null,
    });
    expect(
      assessUpdate(input, "0.1.0", undefined, now, "v24.21.0"),
    ).toMatchObject({ status: "deferred" });
  });
  it.each(["contract", "node", "unbundled"])(
    "does not offer installation for incompatible %s metadata",
    (kind) => {
      const input = metadata();
      if (kind === "contract")
        input.versions["0.2.0"].sniptaleMotion = {
          ...MOTION_COMPATIBILITY,
          toolkitCompatibility: "future",
        };
      if (kind === "node") input.versions["0.2.0"].engines.node = ">=99";
      if (kind === "unbundled")
        input.versions["0.2.0"].bundledDependencies = [];
      const result = assessUpdate(input, "0.1.0", undefined, now, "v24.21.0");
      expect(result.status).toBe("incompatible");
      expect("install" in result).toBe(false);
    },
  );
  it("allows an explicit compatible rollback and rejects selectors instead of resolving latest silently", () => {
    expect(
      assessUpdate(metadata(), "0.2.0", "0.1.0", now, "v24.21.0"),
    ).toMatchObject({ status: "rollback-available", version: "0.1.0" });
    expect(() =>
      assessUpdate(metadata(), "0.1.0", "latest", now, "v24.21.0"),
    ).toThrow();
  });
  it("fails closed for malformed integrity or metadata", () => {
    const input = metadata();
    input.versions["0.2.0"].dist.integrity = "SECRET";
    expect(() =>
      assessUpdate(input, "0.1.0", undefined, now, "v24.21.0"),
    ).toThrow();
    expect(() =>
      assessUpdate({}, "0.1.0", undefined, now, "v24.21.0"),
    ).toThrow();
  });
  it("uses one fixed public endpoint without credentials and handles an unpublished package", async () => {
    const request = vi.fn(async () => new Response("SECRET", { status: 404 }));
    vi.stubGlobal("fetch", request);
    const context = {
      cwd: ".",
      packageRoot: ".",
      version: "0.1.0",
      stdout: () => {},
      stderr: () => {},
    };
    expect(await checkMotionUpdate(context, undefined, "en")).toMatchObject({
      ok: true,
      status: "not-published",
    });
    expect(request).toHaveBeenCalledWith(
      UPDATE_REGISTRY_URL,
      expect.objectContaining({
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
      }),
    );
  });
  it("does not expose registry bodies, rejects invalid selectors before network access, and honors cancellation", async () => {
    const request = vi.fn(async () => new Response("SECRET", { status: 500 }));
    vi.stubGlobal("fetch", request);
    const context = {
      cwd: ".",
      packageRoot: ".",
      version: "0.1.0",
      stdout: () => {},
      stderr: () => {},
    };
    await expect(
      checkMotionUpdate(context, undefined, "en"),
    ).rejects.toMatchObject({ code: "UPDATE_REGISTRY" });
    await expect(
      checkMotionUpdate(context, undefined, "en"),
    ).rejects.not.toThrow(/SECRET/);
    request.mockClear();
    await expect(
      checkMotionUpdate(context, "latest", "en"),
    ).rejects.toMatchObject({ code: "ARGUMENTS" });
    await expect(
      checkMotionUpdate(
        { ...context, signal: AbortSignal.abort() },
        undefined,
        "en",
      ),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
