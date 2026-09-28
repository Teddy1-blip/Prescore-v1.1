import type { ClassificationRule } from "../contracts/classification.ts";
import { CORE_CLASSIFICATION_RULES } from "./rules/core-rules.ts";

export const CLASSIFICATION_RULE_REGISTRY: readonly ClassificationRule[] = Object.freeze(
  [...CORE_CLASSIFICATION_RULES].sort((left, right) => right.priority - left.priority || left.code.localeCompare(right.code)),
);

export function validateClassificationRegistry(rules: readonly ClassificationRule[] = CLASSIFICATION_RULE_REGISTRY) {
  const codes = new Set<string>();
  for (const rule of rules) {
    if (!/^TXC-[A-Z0-9-]+-\d{3}$/.test(rule.code)) throw new Error(`Invalid classification rule code: ${rule.code}`);
    if (codes.has(rule.code)) throw new Error(`Duplicate classification rule code: ${rule.code}`);
    if (!rule.version) throw new Error(`Missing version for classification rule: ${rule.code}`);
    codes.add(rule.code);
  }
  return { count: rules.length, codes };
}
