import type { EditorTimelineSource } from "../editor/timeline-source.js";
import type { ViewerSelection } from "../timeline/model/selection-model.js";

export interface ShellLayoutActions {
  setSidebarCollapsed(collapsed: boolean): void;
  setSidebarWidth(width: number): void;
  setTimelineEditorHeight(height: number): void;
  setPreviewZoom(zoom: unknown): void;
  setPreviewGuides(enabled: boolean): void;
  setPreviewSnap(enabled: boolean): void;
  beginSidebarWidthResize(event: MouseEvent): void;
  handleSidebarWidthResizerKeydown(event: KeyboardEvent): void;
  beginLayoutResize(event: MouseEvent): void;
  handleLayoutResizerKeydown(event: KeyboardEvent): void;
  togglePreviewFullscreen(): Promise<void>;
  syncFullscreenButton(): void;
  isPreviewFullscreenActive(): boolean;
}
export interface ShellActions {
  renderLocalizedShell(): void;
  syncPlaybackButtons(): void;
  setMoveLinkedKeys(enabled: boolean): void;
  createExpandedSceneIdSet(template?: EditorTimelineSource | null): Set<string>;
}
export interface ShellPanelActions {
  syncSidebarHeading(): void;
  setSidebarGroup(group: unknown): void;
  setActionsMenuOpen(open: boolean): void;
  toggleActionsMenu(): void;
  handleActionsMenuKeydown(event: KeyboardEvent): void;
  syncLocaleMenuOptions(): void;
  selectLocaleMenuOption(locale: unknown): void;
  setInspectorTab(tab: unknown): void;
  syncInspectorTabs(item?: ViewerSelection): void;
  setHealthTab(tab: unknown): void;
  syncHealthState(): void;
}
export interface ThemeActions {
  applyTheme(theme: unknown, options?: { persist?: boolean }): void;
  toggleTheme(): void;
  initializeTheme(): void;
  syncThemeButton(): void;
}
export interface KeyboardActions {
  handleGlobalSpaceKeydown(event: KeyboardEvent): void;
  handleGlobalKeydown(event: KeyboardEvent): void;
  hasOpenDropdownMenu(): boolean;
  isEditingFormControl(target: EventTarget | null): boolean;
  isTextEntryControl(target: EventTarget | null): boolean;
  isButtonLikeControl(target: EventTarget | null): boolean;
  shouldFocusInspectorFromEnter(target: EventTarget | null): boolean;
}
export interface AppEditingActions {
  deleteSelectedTimelineItem(): void;
  timelineDeltaFromPixels(
    deltaX: number,
    rect: { width: number },
    template?: EditorTimelineSource | null,
  ): number;
  cssEscape(value: string): string;
}
export interface DiagnosticActions {
  setPackStatus(text: string, variant: string): void;
  copyDiagnostics(): Promise<boolean>;
}
