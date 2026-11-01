import { runQaWrapper } from "../runtime/wrapper-runner.ts";

const messageIndex = process.argv.indexOf("-m");
const commitMessage = messageIndex >= 0 ? process.argv[messageIndex + 1] : "";

await runQaWrapper("qa:closeout", async ({ run }) => {
  await run("checkpoint", "npm", ["run", "qa:checkpoint"]);
  await run("coverage", "npm", ["run", "qa:coverage"]);
  await run("build", "npm", ["run", "qa:build"]);

  if (commitMessage) {
    await run("git add", "git", ["add", "."]);
    await run("git commit", "git", ["commit", "-m", commitMessage]);
  }
});
