import { runQaWrapper } from "../runtime/wrapper-runner.mjs";

await runQaWrapper("qa:checkpoint", async ({ run }) => {
  await run("format check", "npx", ["prettier", "--check", "."]);
  await run("typecheck", "npm", ["run", "typecheck"]);
  await run("license audit", "npm", ["run", "qa:licenses"]);
  await run("legal closure", "npm", ["run", "release:legal:check"]);
  await run("unit tests", "npm", ["run", "test"]);
  await run("guardrails", "node", ["tooling/qa/policy/guardrails.mjs"]);
});
