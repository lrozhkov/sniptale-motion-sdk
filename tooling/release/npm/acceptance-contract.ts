export type AcceptanceInvoke = (
  label: string,
  args: readonly string[],
  cwd?: string,
  expected?: number,
) => Promise<unknown>;
