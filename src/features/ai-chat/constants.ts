/** Evento global para acciones de widgets (navegación, rellenar input, etc.). */
export const AI_WIDGET_ACTION_EVENT = "nifty:ai-widget-action";

/** Marcadores de bloque JSON embebido en mensajes del chat. */
export const WIDGET_FENCE_MARKERS = ["nifty-widget", "salus-widget"] as const;

export type WidgetFenceMarker = (typeof WIDGET_FENCE_MARKERS)[number];

export function isWidgetFenceOpen(line: string): boolean {
  const trimmed = line.trim();
  return WIDGET_FENCE_MARKERS.some((marker) => trimmed === `\`\`\`${marker}`);
}

export function isWidgetFenceClose(line: string): boolean {
  return line.trim() === "```";
}