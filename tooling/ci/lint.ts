import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { inspectWorkflowBoundary, workflowFiles } from "./workflow-policy.ts";

export function runWorkflowAudit(
  binary: string,
  args: readonly string[],
  expectedFinding?: { ident: string; status: number },
): void {
  const result = spawnSync(binary, args, {
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.signal || result.status === null)
    throw new Error(`Workflow linter did not complete: ${binary}.`);
  const findings: unknown = JSON.parse(result.stdout.trim() || "[]");
  if (!Array.isArray(findings))
    throw new Error("Workflow linter must return a JSON findings array.");
  if (expectedFinding !== undefined) {
    if (
      result.status !== expectedFinding.status ||
      !findings.some(
        (finding: unknown) =>
          finding !== null &&
          typeof finding === "object" &&
          (("ident" in finding && finding.ident === expectedFinding.ident) ||
            ("kind" in finding && finding.kind === expectedFinding.ident)),
      )
    )
      throw new Error(
        `Workflow linter did not reject ${expectedFinding.ident} with exit ${expectedFinding.status}. ${result.stderr}`,
      );
  } else if (result.status !== 0 || findings.length !== 0)
    throw new Error(
      `Workflow audit failed: ${result.stdout}\n${result.stderr}`,
    );
}

export function lintWorkflows(): void {
  const violations = inspectWorkflowBoundary();
  if (violations.length) throw new Error(violations.join("\n"));
  mkdirSync(resolve(".tmp/ci"), { recursive: true });
  const directory = mkdtempSync(resolve(".tmp/ci/workflow-fixtures-"));
  const actionlint = resolve(".tmp/ci/bin/actionlint");
  const zizmor = resolve(".tmp/ci/bin/zizmor");
  const files = workflowFiles();
  const valid = join(directory, "valid.yml");
  const syntax = join(directory, "syntax.yml");
  const security = join(directory, "security.yml");
  const template = readFileSync(resolve(".github/workflows/ci.yml"), "utf8");
  const actionArgs = ["-format", "{{json .}}"];
  const zizmorArgs = [
    "--offline",
    "--no-config",
    "--no-ignores",
    "--strict-collection",
    "--persona",
    "auditor",
    "--format",
    "json",
  ];
  try {
    writeFileSync(valid, template);
    writeFileSync(
      syntax,
      "on: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ${{ unknown.property }}\n",
    );
    writeFileSync(
      security,
      "on: push\npermissions: write-all\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo safe\n",
    );
    runWorkflowAudit(actionlint, [...actionArgs, valid]);
    runWorkflowAudit(actionlint, [...actionArgs, syntax], {
      ident: "expression",
      status: 1,
    });
    runWorkflowAudit(zizmor, [...zizmorArgs, valid]);
    runWorkflowAudit(zizmor, [...zizmorArgs, security], {
      ident: "excessive-permissions",
      status: 14,
    });
    runWorkflowAudit(actionlint, [...actionArgs, ...files]);
    runWorkflowAudit(zizmor, [...zizmorArgs, ...files]);
    process.stdout.write(
      `Workflow lint passed: ${files.length} workflow(s), both linter self-tests passed.\n`,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
)
  lintWorkflows();
