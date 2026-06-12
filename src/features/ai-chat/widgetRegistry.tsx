import React from "react";
import type { Widget, WidgetType } from "./types/widget";

type WidgetRendererFn = React.FC<{ widget: Widget }>;

const widgetRenderers = new Map<WidgetType, WidgetRendererFn>();

export function registerWidgetRenderer<T extends WidgetType>(
  type: T,
  renderer: React.FC<{ widget: Extract<Widget, { type: T }> }>
) {
  widgetRenderers.set(type, renderer as WidgetRendererFn);
}

export function unregisterWidgetRenderer(type: WidgetType) {
  widgetRenderers.delete(type);
}

export function getRegisteredWidgetTypes(): WidgetType[] {
  return Array.from(widgetRenderers.keys());
}

export function hasWidgetRenderer(type: WidgetType): boolean {
  return widgetRenderers.has(type);
}

export function InvalidWidget({ title, message }: { title?: string; message: string }) {
  return (
    <section className="chat-widget-invalid">
      {title ? <div className="chat-widget-invalid-title">{title}</div> : null}
      <div className="chat-widget-invalid-body">{message}</div>
    </section>
  );
}

export function UnregisteredWidget({ widget }: { widget: Widget }) {
  return (
    <section className="chat-widget-unregistered">
      <div className="chat-widget-unregistered-head">
        <span className="chat-widget-unregistered-type">{widget.type}</span>
        {"title" in widget && widget.title ? <span className="chat-widget-unregistered-label">{widget.title}</span> : null}
      </div>
      <p className="chat-widget-unregistered-hint">
        Este tipo de widget está definido en el sistema pero aún no tiene un renderer registrado en Nifty Retail.
      </p>
    </section>
  );
}

export const WidgetRenderer: React.FC<{ widget: Widget }> = ({ widget }) => {
  const Renderer = widgetRenderers.get(widget.type);
  if (!Renderer) {
    return <UnregisteredWidget widget={widget} />;
  }
  return <Renderer widget={widget} />;
};