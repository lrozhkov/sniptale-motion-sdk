import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream, mkdirSync, openSync } from "node:fs";
import { join, relative } from "node:path";

const LOG_ROOT = join(".tmp", "qa-logs");
const SENSITIVE_ENVIRONMENT_KEY =
  /(?:token|secret|password|passwd|api[_-]?key|authorization|cookie|credential)/i;

export function createQaRun({
  wrapperId,
  repoRoot = process.cwd(),
  clock = () => new Date(),
  createId = randomUUID,
  terminalOut = process.stdout,
  terminalErr = process.stderr,
  environment = process.env,
  sensitiveValues = [],
} = {}) {
  if (!wrapperId) throw new Error("QA wrapper id is required.");

  const startedAt = clock();
  const day = startedAt.toISOString().slice(0, 10);
  const timestamp = startedAt.toISOString().replaceAll(/[:.]/g, "-");
  const slug = wrapperId.replaceAll(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const logPath = join(
    repoRoot,
    LOG_ROOT,
    day,
    `${slug}-${timestamp}-${process.pid}-${createId().slice(0, 8)}.log`,
  );
  mkdirSync(join(repoRoot, LOG_ROOT, day), { recursive: true, mode: 0o700 });
  const descriptor = openSync(logPath, "wx", 0o600);
  const log = createWriteStream(logPath, { fd: descriptor, autoClose: true });
  const logRelativePath = relative(repoRoot, logPath).replaceAll("\\", "/");
  const redactions = collectSensitiveValues(environment, sensitiveValues);
  let closed = false;

  writeLog(
    [
      `wrapper=${wrapperId}`,
      `startedAt=${startedAt.toISOString()}`,
      `cwd=${repoRoot}`,
      "",
    ].join("\n"),
  );
  writeTerminal(terminalOut, `[${wrapperId}] run log: ${logRelativePath}\n`);

  function writeLog(value) {
    if (!closed) log.write(sanitizeLogText(value, redactions));
  }

  function writeTerminal(stream, value) {
    stream.write(value);
    writeLog(value);
  }

  async function run(label, command, args = [], options = {}) {
    const commandLine = [command, ...args].map(renderArgument).join(" ");
    writeTerminal(terminalOut, `\n[${wrapperId}] ${label}\n`);
    writeLog(`command=${commandLine}\n`);
    const commandStartedAt = Date.now();

    await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: repoRoot,
        env: options.env ?? environment,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let settled = false;

      child.stdout.on("data", (chunk) => writeTerminal(terminalOut, chunk));
      child.stderr.on("data", (chunk) => writeTerminal(terminalErr, chunk));
      child.once("error", (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      });
      child.once("close", (code, signal) => {
        if (settled) return;
        settled = true;
        const durationMs = Date.now() - commandStartedAt;
        const outcome =
          code === 0
            ? `exitCode=0 durationMs=${durationMs}`
            : `exitCode=${code ?? "null"} signal=${signal ?? "none"} durationMs=${durationMs}`;
        writeLog(`${outcome}\n`);
        if (code === 0) {
          resolve();
          return;
        }
        const error = new Error(
          `${label} failed with ${
            signal ? `signal ${signal}` : `exit code ${code ?? 1}`
          }.`,
        );
        error.exitCode = Number.isInteger(code) ? code : 1;
        reject(error);
      });
    });
  }

  async function close(status) {
    if (closed) return;
    writeLog(
      `\nstatus=${status}\nfinishedAt=${clock().toISOString()}\nlog=${logRelativePath}\n`,
    );
    closed = true;
    await new Promise((resolve, reject) => {
      log.once("error", reject);
      log.once("close", resolve);
      log.end();
    });
  }

  return {
    logPath,
    logRelativePath,
    run,
    writeStderr: (value) => writeTerminal(terminalErr, value),
    writeStdout: (value) => writeTerminal(terminalOut, value),
    close,
  };
}

export async function runQaWrapper(wrapperId, execute, options) {
  const session = createQaRun({ wrapperId, ...options });
  try {
    await execute(session);
    await session.close("passed");
  } catch (error) {
    const detail =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    session.writeStderr(`\n[${wrapperId}] ${detail}\n`);
    await session.close("failed");
    process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
  }
  return session;
}

function renderArgument(value) {
  return /^[A-Za-z0-9_./:=@+-]+$/.test(value) ? value : JSON.stringify(value);
}

function collectSensitiveValues(environment, explicitValues) {
  const values = [
    ...explicitValues,
    ...Object.entries(environment)
      .filter(([key]) => SENSITIVE_ENVIRONMENT_KEY.test(key))
      .map(([, value]) => value),
  ];
  return [...new Set(values)]
    .filter((value) => typeof value === "string" && value.length >= 4)
    .sort((left, right) => right.length - left.length);
}

function sanitizeLogText(value, redactions) {
  let text = String(value);
  for (const sensitiveValue of redactions) {
    text = text.replaceAll(sensitiveValue, "[redacted]");
  }
  return text;
}
