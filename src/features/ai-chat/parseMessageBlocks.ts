import { isWidgetFenceClose, isWidgetFenceOpen } from "./constants";
import { parseWidget } from "./widgetNormalize";
import type { Widget } from "./types/widget";

export type WidgetBlock = { type: "widget"; widget: Widget };
export type WidgetFenceErrorBlock = { type: "widget-error"; raw: string; message: string };
export type TextBlock = { type: "text"; content: string };

export type MessageSegment = WidgetBlock | WidgetFenceErrorBlock | TextBlock;

export function segmentMessageByWidgets(content: string): MessageSegment[] {
  const lines = content.replace(/\r/g, "").split("\n");
  const segments: MessageSegment[] = [];
  let textBuffer: string[] = [];
  let index = 0;

  const flushText = () => {
    if (textBuffer.length === 0) return;
    const text = textBuffer.join("\n").trim();
    if (text) segments.push({ type: "text", content: text });
    textBuffer = [];
  };

  while (index < lines.length) {
    const line = lines[index];

    if (isWidgetFenceOpen(line)) {
      flushText();
      const widgetLines: string[] = [];
      index += 1;
      while (index < lines.length && !isWidgetFenceClose(lines[index])) {
        widgetLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length && isWidgetFenceClose(lines[index])) {
        index += 1;
      }

      const raw = widgetLines.join("\n").trim();
      const widget = parseWidget(raw);
      if (widget) {
        segments.push({ type: "widget", widget });
      } else {
        segments.push({
          type: "widget-error",
          raw,
          message: "El bloque de widget no contiene JSON válido o el tipo no es reconocido.",
        });
      }
      continue;
    }

    textBuffer.push(line);
    index += 1;
  }

  flushText();
  return segments.length > 0 ? segments : content.trim() ? [{ type: "text", content: content.trim() }] : [];
}

export function messageHasWidgetFence(content: string): boolean {
  return content.replace(/\r/g, "").split("\n").some((line) => isWidgetFenceOpen(line));
}