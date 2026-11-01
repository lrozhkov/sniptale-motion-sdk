export function classifyScope(files: readonly string[]) {
  const source = files.some((file) => /^(src|tests|tooling)\//u.test(file));
  const dependency = files.some((file) =>
    /^(package(?:-lock)?\.json|\.npmrc)$|^tooling\/(?:ci|release|qa\/security|configs\/ci)\//u.test(
      file,
    ),
  );
  const security =
    dependency ||
    files.some((file) =>
      /(?:boundary|sanitiz|security|asset|import|export|transport|codeql|workflow)/iu.test(
        file,
      ),
    );
  return {
    coverage: source,
    build:
      source ||
      dependency ||
      files.some((file) =>
        /^(docs\/authoring|\.agents\/skills\/create-effect)\//u.test(file),
      ),
    security,
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
