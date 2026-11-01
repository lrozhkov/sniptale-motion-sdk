import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inspectWorkflow, inspectWorkflowBoundary } from "./workflow-policy.ts";
import { readToolchain, parseToolchain } from "./toolchain.ts";
import { runWorkflowAudit } from "./lint.ts";

const source = readFileSync(".github/workflows/ci.yml", "utf8");
describe("checks-only workflows", () => {
  it("accepts the real Linux/Windows candidate and its locked tools", () => {
    expect(inspectWorkflowBoundary()).toEqual([]);
    expect(source).toContain("os: [ubuntu-24.04, windows-2025]");
    for (const command of [
      "qa",
      "build:npm",
      "test:npm",
      "lint:ci",
      "qa:security",
    ])
      expect(source).toContain(`node tooling/ci/npm.cjs run ${command}`);
    expect(source).toContain('MOTION_NPM_BROWSER_ACCEPT: "1"');
    expect(readToolchain().tools.map((tool) => tool.name)).toEqual([
      "actionlint",
      "zizmor",
      "osv-scanner",
      "gitleaks",
    ]);
  });
  it.each([
    [
      "foreign checkout",
      (value: string) =>
        value.replace(
          "persist-credentials: false",
          "persist-credentials: false\n          repository: untrusted/project",
        ),
      "Action inputs",
    ],
    [
      "runtime mirror",
      (value: string) =>
        value.replace(
          "package-manager-cache: false",
          "package-manager-cache: false\n          mirror: https://example.test/node",
        ),
      "Action inputs",
    ],
    [
      "broad artifact upload",
      (value: string) => value.replace(".tmp/npm-package/*.tgz", "**/*"),
      "only the candidate",
    ],
    [
      "conditional job",
      (value: string) =>
        value.replace(
          "    timeout-minutes: 30",
          "    if: false\n    timeout-minutes: 30",
        ),
      "must not be conditional",
    ],
    [
      "conditional step",
      (value: string) =>
        value.replace(
          "      - run: node tooling/ci/npm.cjs run qa",
          "      - if: false\n        run: node tooling/ci/npm.cjs run qa",
        ),
      "must not be conditional",
    ],
    [
      "undeclared command",
      (value: string) =>
        value.replace(
          "run: node tooling/ci/npm.cjs run qa",
          "run: node tooling/ci/npm.cjs publish",
        ),
      "declared check commands",
    ],
    [
      "unlocked Node",
      (value: string) =>
        value.replace("node-version: 24.21.0", "node-version: latest"),
      "locked runtime",
    ],
    [
      "permissions",
      (value: string) => value.replace("contents: read", "contents: write"),
      "read-only",
    ],
    [
      "token",
      (value: string) => value + "env:\n  NPM_TOKEN: unsafe\n",
      "secrets",
    ],
    [
      "event",
      (value: string) =>
        value.replace("workflow_dispatch:", "pull_request_target:"),
      "Only push",
    ],
    [
      "unpinned action",
      (value: string) =>
        value.replace(
          /actions\/checkout@[a-f0-9]{40}/gu,
          "actions/checkout@v7",
        ),
      "full SHA",
    ],
    [
      "credentials",
      (value: string) =>
        value.replace(
          "persist-credentials: false",
          "persist-credentials: true",
        ),
      "persist credentials",
    ],
    [
      "timeout",
      (value: string) =>
        value.replace("timeout-minutes: 30", "timeout-minutes: 90"),
      "timeout",
    ],
    [
      "publish",
      (value: string) =>
        value.replace(
          "run: node tooling/ci/npm.cjs run qa",
          "run: npm publish",
        ),
      "publication",
    ],
    [
      "interpolation",
      (value: string) =>
        value.replace(
          "run: node tooling/ci/npm.cjs run qa",
          "run: echo ${{ inputs.command }}",
        ),
      "interpolate",
    ],
    [
      "duplicate keys",
      (value: string) => value + "permissions: write-all\n",
      "unique",
    ],
    [
      "hidden failure",
      (value: string) =>
        value.replace(
          "    timeout-minutes: 30",
          "    continue-on-error: true\n    timeout-minutes: 30",
        ),
      "fail the job",
    ],
  ] as const)("rejects %s", (_name, mutate, expected) => {
    expect(inspectWorkflow(mutate(source)).join("\n")).toContain(expected);
  });
});
describe("CI release admission", () => {
  it("rejects fresh tools and Actions without normalizing their age", () => {
    const value = { platform: "linux-x64", ...readToolchain() };
    const now = Date.now();
    const date = new Date(now - 6 * 86400000).toISOString();
    expect(() =>
      parseToolchain(
        {
          ...value,
          tools: value.tools.map((tool) => ({ ...tool, publishedAt: date })),
        },
        now,
      ),
    ).toThrow("seven days");
    expect(() =>
      parseToolchain(
        { ...value, node: { ...value.node, publishedAt: date } },
        now,
      ),
    ).toThrow("seven days");
    expect(() =>
      parseToolchain(
        {
          ...value,
          actions: value.actions.map((action) => ({
            ...action,
            publishedAt: date,
          })),
        },
        now,
      ),
    ).toThrow("seven days");
    expect(() =>
      parseToolchain({
        ...value,
        tools: value.tools.map((tool) => ({ ...tool, sha256: "invalid" })),
      }),
    ).toThrow("SHA-256");
    expect(() =>
      parseToolchain({
        ...value,
        actions: value.actions.map((action) => ({ ...action, commit: "v1" })),
      }),
    ).toThrow("full commit SHA");
  });
});
describe("workflow linter proof semantics", () => {
  it.each([
    ["nonzero empty report", "process.stdout.write('[]');process.exitCode=1"],
    ["malformed report", "process.stdout.write('invalid')"],
    [
      "zero exit with findings",
      'process.stdout.write(JSON.stringify([{ident:"fixture"}]))',
    ],
  ])("rejects %s", (_label, script) => {
    expect(() => runWorkflowAudit(process.execPath, ["-e", script])).toThrow(
      /Workflow audit failed|JSON/u,
    );
  });
  it("requires the expected finding and exit code for a negative self-test", () => {
    const script =
      'process.stdout.write(JSON.stringify([{ident:"fixture"}]));process.exitCode=42';
    expect(() =>
      runWorkflowAudit(process.execPath, ["-e", script], {
        ident: "fixture",
        status: 14,
      }),
    ).toThrow("exit 14");
    expect(() =>
      runWorkflowAudit(process.execPath, ["-e", script], {
        ident: "different",
        status: 42,
      }),
    ).toThrow("different");
    expect(() =>
      runWorkflowAudit(process.execPath, ["-e", script], {
        ident: "fixture",
        status: 42,
      }),
    ).not.toThrow();
  });
  it("fails when the linter executable is unavailable", () => {
    expect(() => runWorkflowAudit(".tmp/ci/missing-executable", [])).toThrow(
      "ENOENT",
    );
  });
});
