export interface PointerDragActions {
  bindPointerDrag(
    pointerId: number | null | undefined,
    target: unknown,
    onMove: (event: MouseEvent) => void,
    onEnd?: ((event: MouseEvent) => void) | null,
  ): void;
  shouldSuppressDragClick(event: unknown): boolean;
}
