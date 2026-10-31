export interface TimeFormatActions {
  formatSeconds(value: unknown, precision?: number): string;
  formatSecondsRange(start: unknown, end: unknown, precision?: number): string;
}
