import { useId, useMemo, useState } from "react";

export const NIFTY_CHART_COLORS = [
  "#c2117a",
  "#00b5e2",
  "#eab308",
  "#16a34a",
  "#8b5cf6",
  "#f97316",
  "#ef4444",
  "#0891b2",
] as const;

export interface ChartPoint {
  label: string;
  value: number;
  color?: string;
}

interface ChartThemeProps {
  theme: "dark" | "light";
  formatValue?: (value: number) => string;
}

function useChartTheme(theme: "dark" | "light") {
  return useMemo(
    () => ({
      grid: theme === "light" ? "#e2e8f0" : "rgba(255, 255, 255, 0.06)",
      tick: theme === "light" ? "#6b7280" : "#94a3b8",
      surface: theme === "light" ? "rgba(194, 17, 122, 0.06)" : "rgba(194, 17, 122, 0.12)",
    }),
    [theme]
  );
}

function compactValue(value: number, formatValue?: (v: number) => string): string {
  if (formatValue) return formatValue(value);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}

function buildSmoothLine(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    d += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function niceAxisMax(value: number): number {
  if (value <= 0) return 0;
  const padded = value * 1.08;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function buildYTicks(max: number, isEmpty: boolean): number[] {
  if (isEmpty || max <= 0) return [0];
  const steps = 4;
  return Array.from({ length: steps + 1 }, (_, i) => (max * (steps - i)) / steps);
}

interface NiftyLineChartProps extends ChartThemeProps {
  points: ChartPoint[];
  color?: string;
  fillFrom?: string;
  fillTo?: string;
  height?: number;
  emptyHint?: string;
}

export function NiftyLineChart({
  points,
  theme,
  formatValue,
  color = "#c2117a",
  fillFrom,
  fillTo,
  height = 260,
  emptyHint,
}: NiftyLineChartProps) {
  const gradId = useId();
  const palette = useChartTheme(theme);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const layout = useMemo(() => {
    const dataMax = Math.max(...points.map((p) => p.value), 0);
    const isEmpty = dataMax === 0;
    const axisMax = isEmpty ? 0 : niceAxisMax(dataMax);
    const yTicks = buildYTicks(axisMax, isEmpty);

    const coords = points.map((p, i) => {
      const xPct = points.length <= 1 ? 50 : (i / (points.length - 1)) * 100;
      const yPct =
        axisMax > 0 ? 100 - (p.value / axisMax) * 100 : isEmpty ? 72 : 100;
      return { ...p, xPct, yPct };
    });

    const svgCoords = coords.map((p) => ({ x: p.xPct, y: p.yPct }));
    const linePath = buildSmoothLine(svgCoords);
    const areaPath =
      !isEmpty && svgCoords.length > 0
        ? `${linePath} L ${svgCoords[svgCoords.length - 1].x} 100 L ${svgCoords[0].x} 100 Z`
        : "";

    return { dataMax, isEmpty, axisMax, yTicks, coords, linePath, areaPath };
  }, [points]);

  const resolvedFillFrom = fillFrom ?? color;
  const resolvedFillTo = fillTo ?? (theme === "light" ? "rgba(194, 17, 122, 0.02)" : "rgba(194, 17, 122, 0)");

  return (
    <div className="nifty-chart nifty-chart--line" style={{ height }}>
      <div className="nifty-line-chart-body">
        <div className="nifty-line-chart-yaxis" aria-hidden="true">
          {layout.yTicks.map((tick) => (
            <span key={tick} className="nifty-line-chart-ytick">
              {formatValue ? formatValue(tick) : compactValue(tick)}
            </span>
          ))}
        </div>

        <div className="nifty-line-chart-plot">
          <div className="nifty-line-chart-grid" aria-hidden="true">
            {layout.yTicks.map((tick) => (
              <div
                key={`grid-${tick}`}
                className="nifty-line-chart-grid-line"
                style={{ borderColor: palette.grid }}
              />
            ))}
          </div>

          {layout.isEmpty && emptyHint && (
            <p className="nifty-line-chart-empty-hint">{emptyHint}</p>
          )}

          <svg
            viewBox="0 0 100 100"
            className="nifty-line-chart-svg"
            preserveAspectRatio="none"
            role="img"
            aria-label="Gráfico de línea"
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={resolvedFillFrom} stopOpacity={0.35} />
                <stop offset="100%" stopColor={resolvedFillTo} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            {!layout.isEmpty && layout.areaPath && (
              <path d={layout.areaPath} fill={`url(#${gradId})`} vectorEffect="non-scaling-stroke" />
            )}
            {layout.linePath && (
              <path
                d={layout.linePath}
                fill="none"
                stroke={color}
                strokeWidth={layout.isEmpty ? 1.5 : 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={layout.isEmpty ? "4 4" : undefined}
                className={`nifty-chart-line-path${layout.isEmpty ? " is-flat" : ""}`}
                vectorEffect="non-scaling-stroke"
                opacity={layout.isEmpty ? 0.45 : 1}
              />
            )}
          </svg>

          {layout.coords.map((pt, i) => (
            <button
              type="button"
              key={`${pt.label}-${i}`}
              className={`nifty-line-chart-point${activeIndex === i ? " is-active" : ""}${layout.isEmpty ? " is-flat" : ""}`}
              style={{
                left: `${pt.xPct}%`,
                top: `${pt.yPct}%`,
                borderColor: color,
                color,
              }}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex(null)}
              aria-label={`${pt.label}: ${formatValue ? formatValue(pt.value) : compactValue(pt.value)}`}
            >
              {activeIndex === i && (
                <span className="nifty-line-chart-tooltip" role="tooltip">
                  <strong>{pt.label}</strong>
                  <em>{formatValue ? formatValue(pt.value) : compactValue(pt.value)}</em>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="nifty-line-chart-xaxis">
        {layout.coords.map((pt, i) => (
          <span key={`lbl-${pt.label}-${i}`} className="nifty-line-chart-xtick" style={{ color: palette.tick }}>
            {pt.label}
          </span>
        ))}
      </div>
    </div>
  );
}

interface NiftyVerticalBarChartProps extends ChartThemeProps {
  points: ChartPoint[];
  colors?: string[];
  singleColor?: string;
  height?: number;
}

export function NiftyVerticalBarChart({
  points,
  theme,
  formatValue,
  colors,
  singleColor,
  height = 240,
}: NiftyVerticalBarChartProps) {
  const palette = useChartTheme(theme);
  const maxVal = Math.max(...points.map((p) => Math.abs(p.value)), 1);

  return (
    <div className="nifty-chart nifty-chart--vbar" style={{ height }}>
      <div className="nifty-vbar-grid" aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <div key={ratio} className="nifty-vbar-grid-row" style={{ borderColor: palette.grid }}>
            <span style={{ color: palette.tick }}>{compactValue(maxVal * ratio, formatValue)}</span>
          </div>
        ))}
      </div>
      <div className="nifty-vbar-columns" role="list">
        {points.map((pt, i) => {
          const pct = (Math.abs(pt.value) / maxVal) * 100;
          const barColor =
            pt.color ?? colors?.[i % colors.length] ?? singleColor ?? NIFTY_CHART_COLORS[i % NIFTY_CHART_COLORS.length];
          const valueLabel = formatValue ? formatValue(Math.abs(pt.value)) : String(Math.abs(pt.value));
          const signedLabel = pt.value < 0 ? `−${valueLabel}` : valueLabel;
          return (
            <div key={`${pt.label}-${i}`} className="nifty-vbar-col" role="listitem" title={`${pt.label}: ${signedLabel}`}>
              <div className="nifty-vbar-track">
                <div
                  className="nifty-vbar-fill"
                  style={{
                    height: `${pct}%`,
                    background: `linear-gradient(180deg, ${barColor}, color-mix(in srgb, ${barColor} 65%, transparent))`,
                    boxShadow: `0 4px 14px color-mix(in srgb, ${barColor} 35%, transparent)`,
                  }}
                />
              </div>
              <span className="nifty-vbar-label" style={{ color: palette.tick }}>
                {pt.label.length > 10 ? `${pt.label.slice(0, 10)}…` : pt.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface NiftyHorizontalBarChartProps extends ChartThemeProps {
  points: ChartPoint[];
  color?: string;
  colors?: string[];
  height?: number;
}

export function NiftyHorizontalBarChart({
  points,
  theme,
  formatValue,
  color = "#c2117a",
  colors,
  height = 240,
}: NiftyHorizontalBarChartProps) {
  const palette = useChartTheme(theme);
  const maxVal = Math.max(...points.map((p) => Math.abs(p.value)), 1);

  return (
    <div className="nifty-chart nifty-chart--hbar" style={{ height }}>
      <div className="nifty-hbar-rows" role="list">
        {points.map((pt, i) => {
          const pct = (pt.value / maxVal) * 100;
          const barColor = colors?.[i] ?? color;
          return (
            <div key={`${pt.label}-${i}`} className="nifty-hbar-row" role="listitem">
              <span className="nifty-hbar-name" style={{ color: palette.tick }} title={pt.label}>
                {pt.label}
              </span>
              <div className="nifty-hbar-track" style={{ background: palette.grid }}>
                <div
                  className="nifty-hbar-fill"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${barColor}, color-mix(in srgb, ${barColor} 70%, #00b5e2))`,
                  }}
                />
              </div>
              <span className="nifty-hbar-value">
                {formatValue ? formatValue(pt.value) : compactValue(pt.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

const DONUT_GAP_DEG = 2.4;
const DONUT_CX = 50;
const DONUT_CY = 50;
const DONUT_OUTER_R = 42;
const DONUT_INNER_R = 27;

function polarPoint(cx: number, cy: number, r: number, angleFromTop: number) {
  const rad = ((angleFromTop - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSegmentPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle;
  if (sweep <= 0.01) return "";
  const largeArc = sweep > 180 ? 1 : 0;
  const outerStart = polarPoint(cx, cy, outerR, startAngle);
  const outerEnd = polarPoint(cx, cy, outerR, endAngle);
  const innerStart = polarPoint(cx, cy, innerR, endAngle);
  const innerEnd = polarPoint(cx, cy, innerR, startAngle);
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

function formatPercent(value: number, total: number): string {
  if (total <= 0) return "0%";
  const pct = (value / total) * 100;
  if (pct > 0 && pct < 0.1) return "<0.1%";
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  return `${pct.toFixed(1)}%`;
}

interface NiftyDonutChartProps extends ChartThemeProps {
  segments: DonutSegment[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function NiftyDonutChart({
  segments,
  theme,
  formatValue,
  height = 260,
  centerLabel,
  centerValue,
}: NiftyDonutChartProps) {
  const glowId = useId();
  const palette = useChartTheme(theme);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const hasData = total > 0;

  const arcs = useMemo(() => {
    if (!hasData) return [];
    const gapTotal = segments.length > 1 ? segments.length * DONUT_GAP_DEG : 0;
    const available = 360 - gapTotal;
    let cursor = 0;
    return segments.map((seg, index) => {
      const sweep = (seg.value / total) * available;
      const start = cursor + (segments.length > 1 ? DONUT_GAP_DEG / 2 : 0);
      const end = start + sweep;
      cursor = end + (segments.length > 1 ? DONUT_GAP_DEG / 2 : 0);
      return {
        ...seg,
        index,
        start,
        end,
        sweep,
        pct: (seg.value / total) * 100,
        path: donutSegmentPath(DONUT_CX, DONUT_CY, DONUT_INNER_R, DONUT_OUTER_R, start, end),
      };
    });
  }, [segments, total, hasData]);

  const displayCenter = centerValue ?? (formatValue ? formatValue(total) : compactValue(total));
  const centerIsLong = displayCenter.length > 11;
  const activeArc = activeIndex !== null ? arcs[activeIndex] : null;

  return (
    <div
      className={`nifty-chart nifty-chart--donut${hasData ? "" : " nifty-chart--donut-empty"}`}
      style={{ height }}
      onMouseLeave={() => setActiveIndex(null)}
    >
      <div className="nifty-donut-visual">
        <svg
          viewBox="0 0 100 100"
          className="nifty-donut-svg"
          role="img"
          aria-label="Gráfico circular"
        >
          <defs>
            <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {!hasData && (
            <circle
              cx={DONUT_CX}
              cy={DONUT_CY}
              r={(DONUT_OUTER_R + DONUT_INNER_R) / 2}
              fill="none"
              stroke={palette.grid}
              strokeWidth={DONUT_OUTER_R - DONUT_INNER_R}
              className="nifty-donut-track"
            />
          )}

          {arcs.map((arc) => {
            const isActive = activeIndex === null || activeIndex === arc.index;
            return (
              <path
                key={arc.label}
                d={arc.path}
                fill={arc.color}
                className={`nifty-donut-segment${isActive ? " is-lit" : " is-dim"}${
                  activeIndex === arc.index ? " is-active" : ""
                }`}
                filter={activeIndex === arc.index ? `url(#${glowId})` : undefined}
                onMouseEnter={() => setActiveIndex(arc.index)}
                onFocus={() => setActiveIndex(arc.index)}
                tabIndex={0}
                aria-label={`${arc.label}: ${formatPercent(arc.value, total)}`}
              />
            );
          })}
        </svg>

        <div className="nifty-donut-hole">
          {centerLabel && <span className="nifty-donut-hole-label">{centerLabel}</span>}
          <strong
            className={`nifty-donut-hole-value${centerIsLong ? " nifty-donut-hole-value--long" : ""}`}
            title={displayCenter}
          >
            {displayCenter}
          </strong>
          {activeArc && (
            <span className="nifty-donut-hole-focus">
              {activeArc.label} · {formatPercent(activeArc.value, total)}
            </span>
          )}
        </div>
      </div>

      <ul className="nifty-donut-legend nifty-scroll">
        {segments.map((seg, index) => {
          const pct = hasData ? (seg.value / total) * 100 : 0;
          const isActive = activeIndex === null || activeIndex === index;
          return (
            <li
              key={seg.label}
              className={`nifty-donut-legend-item${isActive ? " is-lit" : " is-dim"}${
                activeIndex === index ? " is-active" : ""
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              tabIndex={0}
            >
              <span className="nifty-donut-legend-swatch" style={{ background: seg.color }} />
              <div className="nifty-donut-legend-copy">
                <span className="nifty-donut-legend-label" title={seg.label}>
                  {seg.label}
                </span>
                <span className="nifty-donut-legend-value">
                  {formatValue ? formatValue(seg.value) : compactValue(seg.value)}
                </span>
              </div>
              <span className="nifty-donut-legend-pct">{formatPercent(seg.value, total)}</span>
              <span
                className="nifty-donut-legend-bar"
                style={{ width: `${Math.max(pct, hasData ? 2 : 0)}%`, background: seg.color }}
                aria-hidden="true"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}