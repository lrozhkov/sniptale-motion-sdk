export type CliContext = {
  signal?: AbortSignal;
  cwd: string;
  packageRoot: string;
  version: string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
};
