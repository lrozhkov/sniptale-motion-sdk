export type SvgTransformPart = {
  cx?: number;
  cy?: number;
  [key: string]: unknown;
};
export type SvgTransformCollection = { parts?: readonly unknown[] };
export type SvgPartTransformResult = {
  alpha?: number;
  composite?: GlobalCompositeOperation;
  filter?: string;
  originX?: number;
  originY?: number;
  rotate?: number;
  scale?: number;
  x?: number;
  y?: number;
};
export type SvgPartTransform = (
  part: SvgTransformPart,
  index: number,
  parsed?: SvgTransformCollection,
) => SvgPartTransformResult;
