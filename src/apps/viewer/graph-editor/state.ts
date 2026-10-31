export type GraphEditorViewport = {
  templateId: string;
  timeEnd: number;
  timeStart: number;
  valueMax: number;
  valueMin: number;
};

export type GraphEditorState = {
  graphEditorPanSession: object | null;
  graphEditorEnabled: boolean;
  graphEditorLinkedHandles: boolean;
  graphEditorViewport: GraphEditorViewport | null;
};

export function createGraphEditorState(): GraphEditorState {
  return {
    graphEditorPanSession: null,
    graphEditorEnabled: false,
    graphEditorLinkedHandles: true,
    graphEditorViewport: null,
  };
}
