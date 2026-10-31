const MAX_STRUCTURE_NODES = 50_000;
const MAX_STRUCTURE_STRING_CHARS = 3_000_000;
const MAX_STRUCTURE_DEPTH = 32;
export type StructuralBudget = {
  active: WeakSet<object>;
  nodes: number;
  stringChars: number;
};

export function createStructuralBudget(): StructuralBudget {
  return {
    active: new WeakSet(),
    nodes: MAX_STRUCTURE_NODES,
    stringChars: MAX_STRUCTURE_STRING_CHARS,
  };
}

export function isBoundedStructuredRecord(
  value: unknown,
  budget: StructuralBudget,
): boolean {
  return isRecord(value) && isBoundedStructuredValue(value, budget, 0);
}

export function isBoundedStructuredValue(
  value: unknown,
  budget: StructuralBudget,
  depth: number,
): boolean {
  if (!consumeNode(budget) || depth > MAX_STRUCTURE_DEPTH) return false;
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }
  if (typeof value === "string") {
    return consumeString(value, budget, 1_500_000);
  }
  if (Array.isArray(value)) {
    if (value.length > 10_000 || budget.active.has(value)) return false;
    budget.active.add(value);
    const valid = value.every((item) =>
      isBoundedStructuredValue(item, budget, depth + 1),
    );
    budget.active.delete(value);
    return valid;
  }
  if (!isRecord(value) || budget.active.has(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > 10_000) return false;
  budget.active.add(value);
  const valid = entries.every(
    ([key, item]) =>
      consumeString(key, budget, 256) &&
      isBoundedStructuredValue(item, budget, depth + 1),
  );
  budget.active.delete(value);
  return valid;
}

export function enterRecord(
  value: unknown,
  budget: StructuralBudget,
  maxEntries: number,
): value is Record<string, unknown> {
  if (
    !isRecord(value) ||
    budget.active.has(value) ||
    Object.keys(value).length > maxEntries ||
    !consumeNode(budget)
  ) {
    return false;
  }
  budget.active.add(value);
  return true;
}

export function leaveRecord(value: object, budget: StructuralBudget): void {
  budget.active.delete(value);
}

export function consumeNode(budget: StructuralBudget): boolean {
  budget.nodes -= 1;
  return budget.nodes >= 0;
}

export function consumeString(
  value: string,
  budget: StructuralBudget,
  maxLength: number,
  requireContent = false,
): boolean {
  if (
    value.length > maxLength ||
    (requireContent && value.length === 0) ||
    budget.stringChars < value.length
  ) {
    return false;
  }
  budget.stringChars -= value.length;
  return true;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
