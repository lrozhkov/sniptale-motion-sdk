import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readDependencyEvidence,
  readRegistryEvidence,
} from "./dependency-registry.ts";
import type { RegistryPackage } from "./dependency-model.ts";

afterEach(() => vi.unstubAllGlobals());
const packages: RegistryPackage[] = [
  {
    name: "example",
    version: "1.0.0",
    integrity: "locked",
    resolved: "locked-url",
  },
];
function evidence() {
  return {
    name: "example",
    time: { "1.0.0": "2026-10-01T00:00:00Z", "2.0.0": "unrelated" },
    versions: {
      "1.0.0": { dist: { integrity: "locked", tarball: "locked-url" } },
      "2.0.0": { untrusted: "not part of this lock" },
    },
  };
}

describe("dependency registry receiving boundary", () => {
  it("retains only checked lock versions and independently owned evidence", () => {
    const source = evidence();
    const parsed = readRegistryEvidence(source, "example", packages);
    expect(parsed).toEqual({
      time: { "1.0.0": "2026-10-01T00:00:00Z" },
      versions: {
        "1.0.0": { dist: { integrity: "locked", tarball: "locked-url" } },
      },
    });
    source.versions["1.0.0"].dist.integrity = "changed";
    expect(parsed.versions?.["1.0.0"]?.dist.integrity).toBe("locked");
  });
  it.each([
    null,
    [],
    {},
    { ...evidence(), name: "other" },
    { ...evidence(), time: [] },
    { ...evidence(), versions: { "1.0.0": { dist: null } } },
    {
      ...evidence(),
      versions: { "1.0.0": { dist: { integrity: {}, tarball: "url" } } },
    },
  ])("rejects malformed remote evidence %#", (value) => {
    expect(() => readRegistryEvidence(value, "example", packages)).toThrow(
      "Invalid registry metadata",
    );
  });
  it("bounds evidence by bytes and disables redirects", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response('"я"'),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      readDependencyEvidence("https://registry.npmjs.org/example", 3),
    ).rejects.toThrow("size limit");
    expect(
      await readDependencyEvidence("https://registry.npmjs.org/example", 4),
    ).toBe("я");
    const call = fetch.mock.calls[0];
    expect(call?.[0]).toBe("https://registry.npmjs.org/example");
    expect(call?.[1]).toMatchObject({
      redirect: "error",
      headers: {
        "User-Agent": "sniptale-motion-dependency-audit",
        Accept: "application/json",
      },
    });
    expect(call?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });
  it("fails on unsuccessful HTTP responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof globalThis.fetch>(
        async () => new Response("unavailable", { status: 503 }),
      ),
    );
    await expect(
      readDependencyEvidence("https://registry.npmjs.org/example", 100),
    ).rejects.toThrow("503");
  });
});
