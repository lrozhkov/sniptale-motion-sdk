import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "yaml";
import { readToolchain } from "./toolchain.ts";

const CHECK_COMMANDS = new Set([
  "node tooling/ci/npm.cjs ci --ignore-scripts",
  ...["ci:tools", "lint:ci", "qa:security", "qa", "build:npm", "test:npm"].map(
    (script) => `node tooling/ci/npm.cjs run ${script}`,
  ),
  "node node_modules/playwright-core/cli.js install --with-deps chromium",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function object(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Expected a workflow object.");
  return value;
}
function permissions(value: unknown): void {
  for (const access of Object.values(object(value)))
    if (access !== "read" && access !== "none")
      throw new Error("Workflow permissions must be read-only.");
}
export function inspectWorkflow(source: string): string[] {
  try {
    const document = parseDocument(source, { uniqueKeys: true });
    if (document.errors.length)
      throw new Error(document.errors.map((error) => error.message).join("; "));
    const input: unknown = document.toJS({ maxAliasCount: 0 });
    const workflow = object(input);
    const triggers = Object.keys(object(workflow.on));
    if (
      !triggers.length ||
      triggers.some(
        (event) => event !== "push" && event !== "workflow_dispatch",
      )
    )
      throw new Error("Only push and manual checks are authorized.");
    permissions(workflow.permissions);
    const toolchain = readToolchain();
    const actions = toolchain.actions;
    if (
      /secrets\s*\.|(?:NPM_TOKEN|NODE_AUTH_TOKEN)|\bnpm\s+publish\b|\bgit\s+push\b/iu.test(
        source,
      )
    )
      throw new Error(
        "Workflow publication commands and secrets are not authorized.",
      );
    const jobs = Object.values(object(workflow.jobs));
    if (!jobs.length) throw new Error("Workflow must contain checks.");
    for (const rawJob of jobs) {
      const job = object(rawJob);
      if (job.uses || job.environment)
        throw new Error(
          "Reusable workflows and deployment environments are not authorized.",
        );
      if (job.permissions !== undefined) permissions(job.permissions);
      if (
        typeof job["timeout-minutes"] !== "number" ||
        job["timeout-minutes"] <= 0 ||
        job["timeout-minutes"] > 60
      )
        throw new Error("Every CI job needs a timeout of at most 60 minutes.");
      if (
        job["continue-on-error"] !== undefined &&
        job["continue-on-error"] !== false
      )
        throw new Error("CI failures must fail the job.");
      if (!Array.isArray(job.steps) || job.steps.length === 0)
        throw new Error("Every CI job needs steps.");
      for (const rawStep of job.steps) {
        const step = object(rawStep);
        if (
          step["continue-on-error"] !== undefined &&
          step["continue-on-error"] !== false
        )
          throw new Error("CI failures must fail the step.");
        if (step.uses !== undefined) {
          if (
            typeof step.uses !== "string" ||
            !actions.some(
              (action) => step.uses === `${action.name}@${action.commit}`,
            )
          )
            throw new Error(
              "Actions must match the full SHA in the CI toolchain lock.",
            );
          if (
            step.uses.startsWith("actions/checkout@") &&
            object(step.with)["persist-credentials"] !== false
          )
            throw new Error("Checkout must not persist credentials.");
          if (
            step.uses.startsWith("actions/setup-node@") &&
            (object(step.with)["node-version"] !== toolchain.node.version ||
              object(step.with)["package-manager-cache"] !== false)
          )
            throw new Error(
              "Setup Node must match the locked runtime and disable package-manager caching.",
            );
        }
        if (
          step.run !== undefined &&
          (typeof step.run !== "string" || step.run.includes("${{"))
        )
          throw new Error(
            "Shell commands must not interpolate GitHub expressions.",
          );
        if (typeof step.run === "string" && !CHECK_COMMANDS.has(step.run))
          throw new Error("Only declared check commands are authorized in CI.");
      }
    }
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : "Invalid workflow."];
  }
}
export function workflowFiles(root = process.cwd()): string[] {
  const directory = join(root, ".github/workflows");
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/u.test(entry.name))
    .map((entry) => join(directory, entry.name))
    .sort();
}
export function inspectWorkflowBoundary(root = process.cwd()): string[] {
  const files = workflowFiles(root);
  if (!files.length)
    return [".github/workflows: checks-only CI workflow is required"];
  return files.flatMap((file) =>
    inspectWorkflow(readFileSync(file, "utf8")).map(
      (issue) => `${file}: ${issue}`,
    ),
  );
}
