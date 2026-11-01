import { runQaWrapper } from "../runtime/wrapper-runner.ts";

await runQaWrapper("qa:checkpoint", async ({ run }) => {
  await run("format check", "npm", ["run", "format"]);
  await run("typecheck", "npm", ["run", "typecheck"]);
  await run("product lint", "npm", ["run", "lint:product"]);
  await run("tooling lint", "npm", ["run", "lint:tooling"]);
  await run("test lint", "npm", ["run", "lint:tests"]);
  await run("license audit", "npm", ["run", "qa:licenses"]);
  await run("legal closure", "npm", ["run", "release:legal:check"]);
  await run("unit tests", "npm", ["run", "test"]);
  await run("guardrails", "node", [
    "--import",
    "tsx",
    "tooling/qa/policy/guardrails.ts",
  ]);
});
