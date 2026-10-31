import ts from "typescript";

const LOOKUPS = new Set(["get", "has", "includes", "test"]);
const COERCIONS = new Set(["Boolean", "Number", "String"]);

/** Identifier and enum checks must inspect author data before conversion. */
export function findCoercedValidationLookups(file: string, source: string) {
  if (
    !file.startsWith("src/sdk/effect-v1/") ||
    !/validation[^/]*\.ts$/u.test(file)
  )
    return [];
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const violations: string[] = [];
  function visit(node: ts.Node) {
    const lookupArgument =
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      LOOKUPS.has(node.expression.name.text)
        ? node.arguments[0]
        : ts.isElementAccessExpression(node)
          ? node.argumentExpression
          : undefined;
    if (lookupArgument) {
      const argument = unwrap(lookupArgument);
      if (argument && ts.isCallExpression(argument)) {
        const callee = unwrap(argument.expression);
        const name =
          callee && ts.isIdentifier(callee)
            ? callee.text
            : callee &&
                ts.isPropertyAccessExpression(callee) &&
                ts.isIdentifier(callee.expression) &&
                callee.expression.text === "globalThis"
              ? callee.name.text
              : null;
        if (name !== null && COERCIONS.has(name)) {
          const { line } = ast.getLineAndCharacterOfPosition(
            argument.getStart(ast),
          );
          violations.push(
            `${file}:${line + 1}: validate identifier/enum types before lookup; ${name} coercion can accept malformed author data`,
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return violations;
}

function unwrap(node: ts.Expression): ts.Expression {
  while (node && ts.isParenthesizedExpression(node)) node = node.expression;
  return node;
}
