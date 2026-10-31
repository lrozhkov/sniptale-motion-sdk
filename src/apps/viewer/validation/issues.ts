import type { EditorValidationIssue, ValidationIssueTarget } from "./types.js";

export function createValidationIssue(
  message: string,
  target: ValidationIssueTarget = {},
): EditorValidationIssue {
  return {
    category:
      target.category ??
      categorizeValidationIssue({
        message,
        targetType: target.targetType ?? "effect",
      }),
    keyframeId: target.keyframeId ?? null,
    message,
    ...(target.messageKey === undefined
      ? {}
      : { messageKey: target.messageKey }),
    ...(target.messageParams === undefined
      ? {}
      : { messageParams: target.messageParams }),
    severity: target.severity ?? "error",
    targetId: target.targetId ?? null,
    targetType: target.targetType ?? "effect",
    trackId: target.trackId ?? null,
  };
}

export function categorizeValidationIssue(
  issue: { message?: string; targetType?: string } | null | undefined,
): string {
  const message = (issue?.message ?? "").toLowerCase();
  const targetType = (issue?.targetType ?? "").toLowerCase();
  if (
    targetType === "asset" ||
    message.includes("asset") ||
    message.includes("svg")
  ) {
    return message.includes("unsafe") ? "Security" : "Assets";
  }
  if (
    message.includes("unsafe") ||
    message.includes("forbidden") ||
    message.includes("remote")
  ) {
    return "Security";
  }
  if (
    targetType === "scene" ||
    targetType === "clip" ||
    targetType === "phase" ||
    targetType === "keyframe" ||
    message.includes("duration") ||
    message.includes("outside")
  ) {
    return "Timing";
  }
  if (
    message.includes("references missing") ||
    message.includes("duplicate") ||
    message.includes("missing")
  ) {
    return "Refs";
  }
  if (
    message.includes("contract") ||
    message.includes("gated") ||
    message.includes("gate")
  ) {
    return "Contract";
  }
  if (
    targetType === "track" ||
    message.includes("renderer") ||
    message.includes("binding")
  ) {
    return "Renderer";
  }
  return "Schema";
}
