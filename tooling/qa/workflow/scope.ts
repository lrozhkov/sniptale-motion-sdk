function isUnitTest(file: string): boolean {
  return (
    /^(?:tests|tooling)\/.*\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(file) &&
    !/^tests\/(?:smoke(?:\/|\.)|fixtures\/)/u.test(file) &&
    !/^tooling\/test\//u.test(file)
  );
}
function isOrdinaryDocumentation(file: string): boolean {
  return (
    /^(?:(?:AGENTS|README|CONTRIBUTING|SECURITY)\.md|(?:docs|\.agents\/skills)\/.*\.md)$/u.test(
      file,
    ) &&
    !/^(?:docs\/authoring|\.agents\/skills\/create-effect)\//u.test(file) &&
    !/(?:boundary|sanitiz|security|asset|import|export|transport|codeql|workflow)/iu.test(
      file,
    )
  );
}
export function classifyScope(files: readonly string[]) {
  const full = files.some(
    (file) => !isUnitTest(file) && !isOrdinaryDocumentation(file),
  );
  return {
    full,
    coverage: files.some((file) => /^(src|tests|tooling)\//u.test(file)),
    build: full,
    security: full,
    owners: [
      ...new Set(
        files.map((file) =>
          file.startsWith("src/")
            ? file.split("/").slice(0, 3).join("/")
            : (file.split("/")[0] ?? file),
        ),
      ),
    ].sort(),
  };
}
export function parseCommitMessage(args: readonly string[]): string {
  if (
    args.length !== 2 ||
    args[0] !== "-m" ||
    !args[1]?.trim() ||
    args[1].startsWith("-")
  )
    throw new Error('Usage: npm run qa:closeout -- -m "message"');
  return args[1];
}
