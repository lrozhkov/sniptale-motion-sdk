export interface Mp4ExportActions {
  localizeMp4ExportDialog(): void;
  openMp4ExportDialog(): Promise<void>;
  closeMp4ExportDialog(): void;
  updateMp4ExportSize(): Promise<void>;
  updateMp4ExportCustomSize(): Promise<void>;
  startMp4Export(event?: Event): Promise<void>;
}
