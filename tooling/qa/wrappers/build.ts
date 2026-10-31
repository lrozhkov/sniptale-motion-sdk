import { runQaWrapper } from "../runtime/wrapper-runner.ts";

await runQaWrapper("qa:build", async ({ run }) => {
  await run("typecheck", "npm", ["run", "typecheck"]);
  await run("unit tests", "npm", ["run", "test"]);
  await run("coverage", "npm", ["run", "qa:coverage"]);
  await run("local fixture build", "npm", ["run", "build:local"]);
  await run("browser smoke", "npm", ["run", "test:smoke"]);
  await run("release build", "npm", ["run", "build"]);
});
