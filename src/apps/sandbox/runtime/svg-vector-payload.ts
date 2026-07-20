export type SerializedSvgVectorPart = {
  cx: number;
  cy: number;
  fill: string | null;
  groupId: string | null;
  groupIds: string[];
  height?: number;
  id: string;
  opacity: number;
  pathData?: string;
  rx?: number;
  stroke: string | null;
  strokeLineCap: string;
  strokeLineJoin: string;
  strokeWidth: number;
  type: "path" | "rect";
  width?: number;
  x?: number;
  y?: number;
};

export type SerializedSvgVector = {
  height: number;
  parts: SerializedSvgVectorPart[];
  width: number;
};

const MAX_PARTS = 2_048;
const MAX_PATH_DATA_LENGTH = 1_500_000;

export function parseSerializedSvgVector(
  value: unknown,
): SerializedSvgVector | null {
  if (!isRecord(value)) {
    return null;
  }
  const width = readPositiveNumber(value.width);
  const height = readPositiveNumber(value.height);
  if (
    width === null ||
    height === null ||
    !Array.isArray(value.parts) ||
    value.parts.length > MAX_PARTS
  ) {
    return null;
  }
  const parts: SerializedSvgVectorPart[] = [];
  let pathDataLength = 0;
  for (const valuePart of value.parts) {
    const part = parsePart(valuePart);
    if (!part) {
      return null;
    }
    pathDataLength += part.pathData?.length ?? 0;
    if (pathDataLength > MAX_PATH_DATA_LENGTH) {
      return null;
    }
    parts.push(part);
  }
  return { height, parts, width };
}

function parsePart(value: unknown): SerializedSvgVectorPart | null {
  if (!isRecord(value) || (value.type !== "path" && value.type !== "rect")) {
    return null;
  }
  const id = readString(value.id, 512);
  const groupId = readNullableString(value.groupId, 512);
  const groupIds = readStringArray(value.groupIds, 64, 512);
  const fill = readNullableString(value.fill, 512);
  const stroke = readNullableString(value.stroke, 512);
  const strokeLineCap = readString(value.strokeLineCap, 32);
  const strokeLineJoin = readString(value.strokeLineJoin, 32);
  const cx = readFiniteNumber(value.cx);
  const cy = readFiniteNumber(value.cy);
  const opacity = readFiniteNumber(value.opacity);
  const strokeWidth = readFiniteNumber(value.strokeWidth);
  if (
    id === null ||
    groupId === undefined ||
    groupIds === null ||
    fill === undefined ||
    stroke === undefined ||
    strokeLineCap === null ||
    strokeLineJoin === null ||
    cx === null ||
    cy === null ||
    opacity === null ||
    strokeWidth === null
  ) {
    return null;
  }
  const common = {
    cx,
    cy,
    fill,
    groupId,
    groupIds,
    id,
    opacity,
    stroke,
    strokeLineCap,
    strokeLineJoin,
    strokeWidth,
  };
  if (value.type === "path") {
    const pathData = readString(value.pathData, MAX_PATH_DATA_LENGTH);
    return pathData === null ? null : { ...common, pathData, type: "path" };
  }
  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  const width = readFiniteNumber(value.width);
  const height = readFiniteNumber(value.height);
  const rx = readFiniteNumber(value.rx);
  return x === null ||
    y === null ||
    width === null ||
    height === null ||
    rx === null
    ? null
    : { ...common, height, rx, type: "rect", width, x, y };
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readPositiveNumber(value: unknown): number | null {
  const number = readFiniteNumber(value);
  return number !== null && number > 0 ? number : null;
}

function readString(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.length <= maxLength ? value : null;
}

function readNullableString(
  value: unknown,
  maxLength: number,
): string | null | undefined {
  return value === null ? null : (readString(value, maxLength) ?? undefined);
}

function readStringArray(
  value: unknown,
  maxItems: number,
  maxLength: number,
): string[] | null {
  return Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => typeof item === "string" && item.length <= maxLength)
    ? [...value]
    : null;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
