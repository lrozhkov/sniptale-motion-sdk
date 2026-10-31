import type { ViewerAppContext } from "../app/context.js";
import {
  FRAME_OBSERVATION_ATTRIBUTE,
  type FrameObservation,
} from "../../../shared/proof/frame-observation.js";

type FrameAuthority = {
  currentTemplate: object | null;
  frameSequence: number;
  sandboxRuntimeGeneration: number;
};
export type FrameAuthorityToken = {
  template: object;
  sequence: number;
  generation: number;
};
export function discardStaleFrame(
  ctx: { state: FrameAuthority & { staleResponses: number } },
  token: FrameAuthorityToken,
  response: { sequenceId?: unknown; bitmap?: unknown },
): boolean {
  if (
    response.sequenceId === token.sequence &&
    isCurrentFrame(ctx.state, token.template, token.sequence, token.generation)
  )
    return false;
  ctx.state.staleResponses += 1;
  const bitmap = response.bitmap;
  if (
    bitmap !== null &&
    typeof bitmap === "object" &&
    "close" in bitmap &&
    typeof bitmap.close === "function"
  ) {
    const result: unknown = Reflect.apply(bitmap.close, bitmap, []);
    void Promise.resolve(result).catch(() => {});
  }
  return true;
}
export function isCurrentFrame(
  state: FrameAuthority,
  template: object,
  sequence: number,
  generation: number,
): boolean {
  return (
    state.currentTemplate === template &&
    state.frameSequence === sequence &&
    state.sandboxRuntimeGeneration === generation
  );
}
export function publishFrameObservation(
  ctx: ViewerAppContext,
  frame: Omit<
    FrameObservation,
    "version" | "bindings" | "assetBitmapTransfers" | "assetEnvelopeTransfers"
  >,
): void {
  if (ctx.state.playing) return;
  const {
    controls,
    phases,
    tracks,
    inputFrames,
    layerGateReads,
    primitivePaintReads,
  } = ctx.state.lastBindingReads;
  const observation: FrameObservation = {
    ...frame,
    version: 1,
    assetBitmapTransfers: ctx.state.assetBitmapTransfers,
    assetEnvelopeTransfers: ctx.state.assetEnvelopeTransfers,
    bindings: {
      controls,
      phases,
      tracks,
      inputFrames,
      layerGateReads,
      primitivePaintReads,
    },
  };
  ctx.refs.renderStats.setAttribute(
    FRAME_OBSERVATION_ATTRIBUTE,
    JSON.stringify(observation),
  );
}
