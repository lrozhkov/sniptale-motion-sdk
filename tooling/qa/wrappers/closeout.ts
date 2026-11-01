import { initializeQaEnvironment } from "../runtime/environment.ts";
import { runQaWrapper } from "../runtime/wrapper-runner.ts";
import { closeCandidate } from "../workflow/closeout.ts";
import { parseCommitMessage } from "../workflow/scope.ts";

initializeQaEnvironment();
const message = parseCommitMessage(process.argv.slice(2));
await runQaWrapper("qa:closeout", (session) =>
  closeCandidate(message, session),
);
