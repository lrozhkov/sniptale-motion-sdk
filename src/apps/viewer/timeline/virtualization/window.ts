export const TIMELINE_VIRTUALIZATION_THRESHOLD = 80;
export const TIMELINE_VIRTUAL_OVERSCAN_ROWS = 6;

export type TimelineVirtualWindow = {
  end: number;
  rowCount: number;
  rowHeight: number;
  start: number;
  virtualized: boolean;
  viewportRows: number;
};

export function calculateTimelineVirtualWindow(options: {
  overscan?: number;
  rowCount: number;
  rowHeight: number;
  scrollTop: number;
  threshold?: number;
  viewportHeight: number;
}): TimelineVirtualWindow {
  const rowCount = Math.max(0, Math.floor(Number(options.rowCount) || 0));
  const rowHeight = Math.max(1, Number(options.rowHeight) || 1);
  const viewportHeight = Math.max(
    rowHeight,
    Number(options.viewportHeight) || 0,
  );
  const viewportRows = Math.max(1, Math.ceil(viewportHeight / rowHeight));
  const threshold = Math.max(
    viewportRows,
    Math.floor(Number(options.threshold) || TIMELINE_VIRTUALIZATION_THRESHOLD),
  );
  if (rowCount <= threshold) {
    return {
      end: rowCount,
      rowCount,
      rowHeight,
      start: 0,
      virtualized: false,
      viewportRows,
    };
  }
  const overscan = Math.max(
    1,
    Math.floor(Number(options.overscan) || TIMELINE_VIRTUAL_OVERSCAN_ROWS),
  );
  const firstVisible = Math.max(
    0,
    Math.min(rowCount - 1, Math.floor(options.scrollTop / rowHeight)),
  );
  const start = Math.max(0, firstVisible - overscan);
  return {
    end: Math.min(rowCount, firstVisible + viewportRows + overscan),
    rowCount,
    rowHeight,
    start,
    virtualized: true,
    viewportRows,
  };
}

export function shouldRefreshTimelineVirtualWindow(
  window: TimelineVirtualWindow | null | undefined,
  scrollTop: number,
): boolean {
  if (!window?.virtualized) {
    return false;
  }
  const firstVisible = Math.max(0, Math.floor(scrollTop / window.rowHeight));
  const lastVisible = Math.min(
    window.rowCount,
    firstVisible + window.viewportRows,
  );
  const guardRows = Math.max(1, Math.floor(TIMELINE_VIRTUAL_OVERSCAN_ROWS / 2));
  return (
    firstVisible < window.start + guardRows ||
    lastVisible > window.end - guardRows
  );
}
