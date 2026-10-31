export function createSvgDataUrl(source: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(source))
    binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
