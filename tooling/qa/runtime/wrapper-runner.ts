import { resolveToolCommand } from "../../process/command.ts";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream, mkdirSync, openSync } from "node:fs";
import { join, relative } from "node:path";

const LOG_ROOT = join(".tmp", "qa-logs");
const SENSITIVE_ENVIRONMENT_KEY =
  /(?:token|secret|password|passwd|api[_-]?key|authorization|cookie|credential)/i;

type TerminalWriter = { write(chunk: string | Uint8Array): boolean };
export type QaRunOptions = {
  wrapperId?: string;
  repoRoot?: string;
  clock?: () => Date;
  createId?: () => string;
  terminalOut?: TerminalWriter;
  terminalErr?: TerminalWriter;
  environment?: NodeJS.ProcessEnv;
  sensitiveValues?: readonly unknown[];
};
export type QaCommandOptions = { env?: NodeJS.ProcessEnv };
export type QaRunSession = ReturnType<typeof createQaRun>;

export function createQaRun({
  wrapperId,
  repoRoot = process.cwd(),
  clock = () => new Date(),
  createId = randomUUID,
  terminalOut = process.stdout,
  terminalErr = process.stderr,
  environment = process.env,
  sensitiveValues = [],
}: QaRunOptions = {}) {
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

  function writeLog(value: string) {
    if (!closed) log.write(sanitizeLogText(value, redactions));
  }

  function writeTerminal(stream: TerminalWriter, value: string | Uint8Array) {
    stream.write(value);
    writeLog(
      typeof value === "string" ? value : Buffer.from(value).toString("utf8"),
    );
  }

  async function run(
    label: string,
    command: string,
    args: readonly string[] = [],
    options: QaCommandOptions = {},
  ): Promise<void> {
    const commandLine = [command, ...args].map(renderArgument).join(" ");
    writeTerminal(terminalOut, `\n[${wrapperId}] ${label}\n`);
    writeLog(`command=${commandLine}\n`);
    const commandStartedAt = Date.now();

    await new Promise<void>((resolve, reject) => {
      const invocation = resolveToolCommand(command, args, environment);
      const child = spawn(invocation.command, invocation.args, {
        shell: false,
        cwd: repoRoot,
        env: options.env ?? environment,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let settled = false;

      child.stdout.on("data", (chunk: Buffer) =>
        writeTerminal(terminalOut, chunk),
      );
      child.stderr.on("data", (chunk: Buffer) =>
        writeTerminal(terminalErr, chunk),
      );
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
        const error = Object.assign(
          new Error(
            `${label} failed with ${
              signal ? `signal ${signal}` : `exit code ${code ?? 1}`
            }.`,
          ),
          { exitCode: code !== null && Number.isInteger(code) ? code : 1 },
        );
        reject(error);
      });
    });
  }

  async function close(status: "passed" | "failed") {
    if (closed) return;
    writeLog(
      `\nstatus=${status}\nfinishedAt=${clock().toISOString()}\nlog=${logRelativePath}\n`,
    );
    closed = true;
    await new Promise<void>((resolve, reject) => {
      log.once("error", reject);
      log.once("close", resolve);
      log.end();
    });
  }

  return {
    logPath,
    logRelativePath,
    run,
    writeStderr: (value: string) => writeTerminal(terminalErr, value),
    writeStdout: (value: string) => writeTerminal(terminalOut, value),
    close,
  };
}

export async function runQaWrapper(
  wrapperId: string,
  execute: (session: QaRunSession) => Promise<void>,
  options: Omit<QaRunOptions, "wrapperId"> = {},
): Promise<QaRunSession> {
  const session = createQaRun({ wrapperId, ...options });
  try {
    await execute(session);
    await session.close("passed");
  } catch (error) {
    const detail =
      error instanceof Error
        ? (error.stack ?? error.message)
        : "Unknown QA failure.";
    session.writeStderr(`\n[${wrapperId}] ${detail}\n`);
    await session.close("failed");
    process.exitCode =
      error !== null &&
      typeof error === "object" &&
      "exitCode" in error &&
      typeof error.exitCode === "number" &&
      Number.isInteger(error.exitCode) &&
      error.exitCode > 0 &&
      error.exitCode <= 255
        ? error.exitCode
        : 1;
  }
  return session;
}

function renderArgument(value: string) {
  return /^[A-Za-z0-9_./:=@+-]+$/.test(value) ? value : JSON.stringify(value);
}

function collectSensitiveValues(
  environment: NodeJS.ProcessEnv,
  explicitValues: readonly unknown[],
): string[] {
  const values = [
    ...explicitValues,
    ...Object.entries(environment)
      .filter(([key]) => SENSITIVE_ENVIRONMENT_KEY.test(key))
      .map(([, value]) => value),
  ];
  return [...new Set(values)]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.length >= 4,
    )
    .sort((left, right) => right.length - left.length);
}

function sanitizeLogText(
  value: string | Uint8Array,
  redactions: readonly string[],
) {
  let text =
    typeof value === "string" ? value : Buffer.from(value).toString("utf8");
  for (const sensitiveValue of redactions) {
    text = text.replaceAll(sensitiveValue, "[redacted]");
  }
  return text;
}
