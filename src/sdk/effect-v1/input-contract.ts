import { EFFECT_V1_KINDS } from "./types.js";
import type { EffectV1InputContract, EffectV1Kind } from "./types.js";

const CONTRACTS: Record<EffectV1Kind, EffectV1InputContract> = {
  standalone: { optional: [], required: [] },
  targetEffect: { optional: [], required: ["source"] },
  transition: { optional: [], required: ["from", "to"] },
};

export function resolveEffectV1InputContract(
  kind: EffectV1Kind,
): EffectV1InputContract {
  return CONTRACTS[kind];
}

export function isEffectV1Kind(value: unknown): value is EffectV1Kind {
  return EFFECT_V1_KINDS.some((kind) => kind === value);
}
