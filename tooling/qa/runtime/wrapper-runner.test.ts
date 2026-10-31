import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createQaRun, runQaWrapper } from "./wrapper-runner.ts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("QA wrapper run logs", () => {
  it.each([0, -1, 1.5, 256, "0"])(
    "does not turn a failed wrapper into success for exitCode=%s",
    async (exitCode) => {
      const previous = process.exitCode;
      try {
        const output = createOutput();
        const session = await runQaWrapper(
          "qa:fixture",
          async () => {
            throw Object.assign(new Error("fixture failure"), { exitCode });
          },
          { repoRoot: createRoot(), terminalOut: output, terminalErr: output },
        );
        expect(process.exitCode).toBe(1);
        expect(readFileSync(session.logPath, "utf8")).toContain(
          "status=failed",
        );
      } finally {
        process.exitCode = previous;
      }
    },
  );
  it("tees stdout and stderr into a unique .tmp log with run metadata", async () => {
    const root = createRoot();
    const stdout = createOutput();
    const stderr = createOutput();
    const secret = "qa-fixture-secret";
    const session = createQaRun({
      wrapperId: "qa:checkpoint",
      repoRoot: root,
      clock: () => new Date("2026-07-18T10:11:12.345Z"),
      createId: () => "12345678-1234-1234-1234-123456789abc",
      terminalOut: stdout,
      terminalErr: stderr,
      environment: {
        ...process.env,
        EFFECT_SDK_QA_TEST_TOKEN: secret,
      },
    });

    await session.run("fixture", process.execPath, [
      "-e",
      'process.stdout.write(`visible-out ${process.env.EFFECT_SDK_QA_TEST_TOKEN}\\n`); process.stderr.write("visible-err\\n");',
    ]);
    await session.close("passed");

    expect(session.logRelativePath).toMatch(
      /^\.tmp\/qa-logs\/2026-07-18\/qa-checkpoint-.+\.log$/,
    );
    expect(stdout.value()).toContain(`run log: ${session.logRelativePath}`);
    expect(stdout.value()).toContain(`visible-out ${secret}`);
    expect(stderr.value()).toContain("visible-err");

    const log = readFileSync(session.logPath, "utf8");
    expect(log).toContain("wrapper=qa:checkpoint");
    expect(log).toContain(`command=${process.execPath} -e`);
    expect(log).toContain("visible-out");
    expect(log).not.toContain(secret);
    expect(log).toContain("visible-out [redacted]");
    expect(log).toContain("visible-err");
    expect(log).toContain("exitCode=0");
    expect(log).toContain("status=passed");
    expect(statSync(session.logPath).mode & 0o777).toBe(0o600);
  });

  it("retains failed command evidence and the child exit code", async () => {
    const root = createRoot();
    const session = createQaRun({
      wrapperId: "qa:build",
      repoRoot: root,
      createId: () => "87654321-1234-1234-1234-123456789abc",
      terminalOut: createOutput(),
      terminalErr: createOutput(),
    });

    await expect(
      session.run("failure fixture", process.execPath, [
        "-e",
        'process.stderr.write("failure-detail\\n"); process.exit(7);',
      ]),
    ).rejects.toMatchObject({ exitCode: 7 });
    await session.close("failed");

    const log = readFileSync(session.logPath, "utf8");
    expect(log).toContain("failure-detail");
    expect(log).toContain("exitCode=7");
    expect(log).toContain("status=failed");
  });
});

function createRoot(): string {
  const base = resolve(".tmp/tests");
  mkdirSync(base, { recursive: true });
  const root = mkdtempSync(join(base, "effect-sdk-qa-log-"));
  roots.push(root);
  return root;
}

function createOutput(): {
  value(): string;
  write(chunk: string | Uint8Array): boolean;
} {
  const chunks: string[] = [];
  return {
    value: () => chunks.join(""),
    write: (chunk) => {
      chunks.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
      );
      return true;
    },
  };
}
