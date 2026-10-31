import { parseEffectV1Fixture } from "../../test/fixtures/effect-v1-documents.ts";
import { describe, expect, it } from "vitest";
import { createNeutralEffectV1Document } from "../../test/fixtures/effect-v1-documents.ts";
import {
  responseArray,
  responseEnvironment,
  responseField,
  responseNumber,
  responseString,
} from "../../test/fixtures/response.ts";
import { parseStudioReady } from "./studio-response.ts";

const ready = () => ({
  ok: true,
  command: "studio",
  project: "/project",
  url: "http://127.0.0.1:10001/?studioSession=token",
  viewerOrigin: "http://127.0.0.1:10001",
  sandboxOrigin: "http://127.0.0.1:10002",
});

describe("installed acceptance response boundaries", () => {
  it("observes checked nested fields and array entries", () => {
    const value: unknown = {
      diagnostics: [{ code: "FAILED" }],
      proof: { count: 3 },
    };
    expect(responseField(value, "diagnostics", 0, "code")).toBe("FAILED");
    expect(responseString(value, "diagnostics", 0, "code")).toBe("FAILED");
    expect(responseNumber(value, "proof", "count")).toBe(3);
    expect(responseArray(value, "diagnostics")).toHaveLength(1);
  });

  it("rejects missing, inherited and invalid indexed fields", () => {
    expect(() => responseField({}, "missing")).toThrow(
      "Response has no field missing.",
    );
    expect(() => responseField({}, "toString")).toThrow(
      "Response has no field toString.",
    );
    expect(() => responseField(null, "field")).toThrow(
      "Response must be an object.",
    );
    for (const index of [-1, 0.5, 1, NaN]) {
      expect(() => responseField(["value"], index)).toThrow(
        /Response array has no index/u,
      );
    }
    expect(() => responseField({ 0: "value" }, 0)).toThrow(
      "Response field must be an array.",
    );
  });

  it("rejects primitive mismatches without invoking conversion hooks", () => {
    const value = {
      toString: () => {
        throw new Error("Conversion must not run");
      },
    };
    expect(() => responseString({ field: value }, "field")).toThrow(
      "Response field must be a string.",
    );
    for (const value of ["3", null, NaN, Infinity]) {
      expect(() => responseNumber({ field: value }, "field")).toThrow(
        "Response field must be a finite number.",
      );
    }
    expect(() => responseArray({ field: {} }, "field")).toThrow(
      "Response field must be an array.",
    );
  });

  it("copies only string installer environment values", () => {
    const env = { DO_NOT_TRACK: "1" };
    const copy = responseEnvironment(env);
    env.DO_NOT_TRACK = "0";
    expect(copy).toEqual({ DO_NOT_TRACK: "1" });
    expect(() => responseEnvironment({ DO_NOT_TRACK: true })).toThrow(
      "Installer environment values must be strings.",
    );
  });

  it("uses SDK validation before a fixture becomes mutable", () => {
    const document = createNeutralEffectV1Document("standalone");
    expect(parseEffectV1Fixture(JSON.stringify(document))).toEqual(document);
    expect(() => parseEffectV1Fixture("{")).toThrow(
      /Effect fixture is invalid/u,
    );
    expect(() => parseEffectV1Fixture('{"program":{"commands":[]}}')).toThrow(
      /Effect fixture is invalid/u,
    );
  });

  it("projects readiness and rejects missing sessions or conflicting origins", () => {
    expect(parseStudioReady(ready())).toEqual({
      project: "/project",
      url: ready().url,
      viewerOrigin: ready().viewerOrigin,
      sandboxOrigin: ready().sandboxOrigin,
      session: "token",
    });
    for (const value of [
      { ...ready(), ok: false },
      { ...ready(), command: "doctor" },
      { ...ready(), url: "http://127.0.0.1:10001/" },
      { ...ready(), viewerOrigin: "http://127.0.0.1:10003" },
      { ...ready(), sandboxOrigin: ready().viewerOrigin },
    ]) {
      expect(() => parseStudioReady(value)).toThrow(/Studio readiness/u);
    }
    expect(() => parseStudioReady({ ...ready(), project: null })).toThrow(
      "Response field must be a string.",
    );
  });
});
