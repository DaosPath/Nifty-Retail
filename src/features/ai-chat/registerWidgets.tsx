import { dispatchWidgetAction } from "./routeActions";
import { registerWidgetRenderer } from "./widgetRegistry";
import type { Widget } from "./types/widget";

function toneClass(tone?: string) {
  return tone ? ` is-${tone}` : "";
}

function StatsWidget({ widget }: { widget: Extract<Widget, { type: "stats" }> }) {
  return (
    <section className="nifty-widget nifty-widget--stats">
      {widget.title ? <header className="nifty-widget-title">{widget.title}</header> : null}
      <div className="nifty-widget-stats-grid">
        {widget.items.map((item, index) => (
          <article key={`${item.label}-${index}`} className={`nifty-widget-stat${toneClass(item.tone)}`}>
            <span className="nifty-widget-stat-label">{item.label}</span>
            <strong className="nifty-widget-stat-value">{item.value}</strong>
            {item.hint ? <small>{item.hint}</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function TableWidget({ widget }: { widget: Extract<Widget, { type: "table" }> }) {
  return (
    <section className="nifty-widget nifty-widget--table">
      {widget.title ? <header className="nifty-widget-title">{widget.title}</header> : null}
      <div className="nifty-widget-table-wrap">
        <table className="nifty-widget-table">
          <thead>
            <tr>
              {widget.columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {widget.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell == null ? "—" : String(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CalloutWidget({ widget }: { widget: Extract<Widget, { type: "callout" }> }) {
  return (
    <section className={`nifty-widget nifty-widget--callout${toneClass(widget.tone)}`}>
      {widget.title ? <header className="nifty-widget-title">{widget.title}</header> : null}
      <p>{widget.body}</p>
    </section>
  );
}

function ActionsWidget({ widget }: { widget: Extract<Widget, { type: "actions" }> }) {
  return (
    <section className="nifty-widget nifty-widget--actions">
      {widget.title ? <header className="nifty-widget-title">{widget.title}</header> : null}
      <div className="nifty-widget-actions">
        {widget.items.map((item, index) => (
          <button
            key={`${item.label}-${index}`}
            type="button"
            className={`btn btn-secondary btn-sm nifty-widget-action${toneClass(item.tone)}`}
            onClick={() => dispatchWidgetAction(item)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function ChartWidget({ widget }: { widget: Extract<Widget, { type: "chart" }> }) {
  const series = widget.series[0];
  const max = Math.max(...(series?.values ?? [1]), 1);
  return (
    <section className="nifty-widget nifty-widget--chart">
      {widget.title ? <header className="nifty-widget-title">{widget.title}</header> : null}
      <div className="nifty-widget-bars">
        {widget.labels.map((label, index) => {
          const value = series?.values[index] ?? 0;
          const height = Math.max(8, Math.round((value / max) * 100));
          return (
            <div key={label} className="nifty-widget-bar">
              <div className="nifty-widget-bar-fill" style={{ height: `${height}%` }} title={String(value)} />
              <span>{label}</span>
              <strong>
                {widget.valuePrefix ?? ""}
                {value}
                {widget.valueSuffix ?? ""}
              </strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

let registered = false;

export function ensureWidgetRenderersRegistered() {
  if (registered) return;
  registerWidgetRenderer("stats", StatsWidget);
  registerWidgetRenderer("table", TableWidget);
  registerWidgetRenderer("callout", CalloutWidget);
  registerWidgetRenderer("actions", ActionsWidget);
  registerWidgetRenderer("chart", ChartWidget);
  registered = true;
}