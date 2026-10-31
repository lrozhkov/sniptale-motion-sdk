import type { ImageAssetDrawOptions } from "./render-assets.js";
import type { SerializedSvgVectorPart } from "./svg-vector-payload.js";

export type SvgVectorAsset = {
  id?: string;
  cacheKey?: string;
  svgText?: string;
  svgVector?: unknown;
  bitmap?: ImageBitmap;
  width?: number;
  height?: number;
};
export type HydratedSvgPart =
  | (Extract<SerializedSvgVectorPart, { type: "path" }> & { path: Path2D })
  | Extract<SerializedSvgVectorPart, { type: "rect" }>;
export type ParsedSvgVector = {
  width: number;
  height: number;
  parts: HydratedSvgPart[];
};
export type SvgDrawOptions = ImageAssetDrawOptions & {
  partIds?: string[];
  partGroups?: string[];
  partFilter?: (part: HydratedSvgPart) => unknown;
  partTransform?: (
    part: HydratedSvgPart,
    index: number,
    parsed: ParsedSvgVector,
  ) => unknown;
};
