import type { PrimitiveLayerReference } from "./canvas-model.js";

type DrawPosition = PrimitiveLayerReference & { x?: number; y?: number };
type DrawOpacity = { alpha?: number; opacity?: number };
export type TextDrawOptions = DrawPosition &
  DrawOpacity & {
    color?: string;
    font?: string;
    letterSpacing?: number;
    maxWidth?: number;
    text?: string | number;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    shadowBlur?: number;
    shadowColor?: string;
  };
export type CodeToken = { text: string; color?: string };
export type CodeLine = string | CodeToken[];
export type CodeBlockDrawOptions = DrawPosition & {
  lines?: CodeLine[];
  width?: number;
  lineHeight?: number;
  font?: string;
  focusLine?: number;
  progress?: number;
  accent?: string;
};
export type PathDrawOptions = PrimitiveLayerReference &
  DrawOpacity & {
    points?: { x: number; y: number }[];
    progress?: number;
    color?: string;
    closed?: boolean;
    fill?: string;
    width?: number;
    glow?: number;
    startProgress?: number;
  };
export type ParticlesDrawOptions = PrimitiveLayerReference &
  DrawOpacity & {
    count?: number;
    progress?: number;
    width?: number;
    height?: number;
    color?: string;
    seed?: number;
  };
