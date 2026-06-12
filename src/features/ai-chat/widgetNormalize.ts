import { asArray, asString, normalizeTone } from "./helpers";
import type { Widget } from "./types/widget";

function normalizeMindMapChildren(value: unknown): string[] {
  return asArray<string | Record<string, unknown>>(value)
    .map((child) => {
      if (typeof child === "string") return child.trim();
      return asString(child.label ?? child.title ?? child.text).trim();
    })
    .filter(Boolean);
}

function normalizeMindMapWidget(raw: Record<string, unknown>): Widget {
  const directBranches = asArray<Record<string, unknown>>(raw.branches)
    .map((branch) => ({
      label: asString(branch.label ?? branch.title ?? branch.text),
      hint: asString(branch.hint ?? branch.detail ?? branch.body) || undefined,
      children: normalizeMindMapChildren(branch.children ?? branch.items),
    }))
    .filter((branch) => branch.label);

  if (directBranches.length > 0) {
    return {
      type: "mindmap",
      title: asString(raw.title) || undefined,
      layout: ["radial", "tree", "columns"].includes(asString(raw.layout))
        ? (raw.layout as "radial" | "tree" | "columns")
        : undefined,
      root: asString(raw.root ?? raw.center ?? raw.topic),
      subtitle: asString(raw.subtitle) || undefined,
      branches: directBranches,
    };
  }

  const items = asArray<Record<string, unknown>>(raw.items);
  const rootNode = items[0];
  const nestedBranches = asArray<Record<string, unknown>>(rootNode?.children ?? rootNode?.items)
    .map((branch) => ({
      label: asString(branch.label ?? branch.title ?? branch.text),
      hint: asString(branch.hint ?? branch.detail ?? branch.body) || undefined,
      children: normalizeMindMapChildren(branch.children ?? branch.items),
    }))
    .filter((branch) => branch.label);

  return {
    type: "mindmap",
    title: asString(raw.title) || undefined,
    layout: ["radial", "tree", "columns"].includes(asString(raw.layout))
      ? (raw.layout as "radial" | "tree" | "columns")
      : undefined,
    root: asString(raw.root ?? raw.center ?? raw.topic ?? rootNode?.label ?? rootNode?.title ?? rootNode?.text),
    subtitle: asString(raw.subtitle) || undefined,
    branches: nestedBranches,
  };
}

function formatComparisonKey(key: string) {
  const normalized = key.replace(/[_-]+/g, " ").trim();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function normalizeComparisonBullet(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const label = asString(record.label ?? record.title ?? record.text).trim();
    const detail = asString(record.detail ?? record.body ?? record.value).trim();
    if (label && detail) return `${label}: ${detail}`;
    return label || detail;
  }
  return "";
}

function normalizeBoardItems(value: unknown) {
  return asArray<unknown>(value)
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return asString(record.label ?? record.title ?? record.text ?? record.body).trim();
      }
      return "";
    })
    .filter(Boolean);
}

function normalizeTimelineItems(value: unknown) {
  return asArray<unknown>(value)
    .map((item, index) => {
      if (typeof item === "string") {
        const title = item.trim();
        return title ? { title, body: undefined, meta: undefined, tone: undefined } : null;
      }
      if (!item || typeof item !== "object") return null;

      const record = item as Record<string, unknown>;
      const title = asString(
        record.title ?? record.label ?? record.name ?? record.step ?? record.phase ?? record.event
      ).trim();
      const body =
        asString(record.body ?? record.text ?? record.detail ?? record.description ?? record.summary).trim() ||
        undefined;
      const meta =
        asString(record.meta ?? record.date ?? record.time ?? record.status ?? record.stage ?? record.deadline).trim() ||
        undefined;

      if (!title) return null;

      return {
        title: title || `Paso ${index + 1}`,
        body,
        meta,
        tone: normalizeTone(record.tone ?? record.level ?? record.severity ?? record.status),
      };
    })
    .filter(Boolean) as Array<{
    title: string;
    body?: string;
    meta?: string;
    tone?: "neutral" | "success" | "warning" | "danger";
  }>;
}

function normalizeChartSeries(raw: Record<string, unknown>) {
  const explicitLabels = asArray<unknown>(raw.labels ?? raw.categories ?? raw.xLabels)
    .map((label) => String(label).trim())
    .filter(Boolean);
  const sourceSeries = asArray<Record<string, unknown>>(raw.series ?? raw.datasets ?? raw.items);
  const derivedLabels: string[] = [];

  const series = sourceSeries.map((serie, index) => {
    const points = asArray<unknown>(serie.values ?? serie.data ?? serie.points);
    const values: number[] = [];

    points.forEach((point, pointIndex) => {
      if (typeof point === "number") {
        values.push(Number(point) || 0);
        return;
      }
      if (typeof point === "string") {
        values.push(Number(point) || 0);
        return;
      }
      if (point && typeof point === "object") {
        const record = point as Record<string, unknown>;
        values.push(Number(record.y ?? record.value ?? record.amount ?? 0) || 0);
        if (!explicitLabels.length) {
          const label = asString(record.x ?? record.label ?? record.name ?? record.date ?? record.category).trim();
          if (label) derivedLabels[pointIndex] = label;
        }
      }
    });

    return {
      name: asString(serie.name ?? serie.label ?? serie.title) || `Serie ${index + 1}`,
      values,
      color: asString(serie.color ?? serie.stroke) || undefined,
    };
  });

  const labels = explicitLabels.length
    ? explicitLabels
    : derivedLabels.filter(Boolean).length
      ? derivedLabels.map((label, index) => label || `${index + 1}`)
      : Array.from({ length: Math.max(0, ...series.map((serie) => serie.values.length)) }, (_, index) => `${index + 1}`);

  return {
    chartType: asString(raw.chartType ?? raw.variant ?? raw.mode) === "line" ? ("line" as const) : ("bar" as const),
    labels,
    series,
  };
}

function normalizeSourceItems(value: unknown) {
  return asArray<unknown>(value)
    .map((item, index) => {
      if (typeof item === "string") {
        const label = item.trim();
        return label ? { label, entity: undefined, id: undefined, detail: undefined } : null;
      }
      if (!item || typeof item !== "object") return null;

      const record = item as Record<string, unknown>;
      const label =
        asString(record.label ?? record.title ?? record.name ?? record.source ?? record.record).trim() ||
        `Fuente ${index + 1}`;
      const entity = asString(record.entity ?? record.module ?? record.table ?? record.kind).trim() || undefined;
      const idValue = record.id ?? record.ref ?? record.reference ?? record.code;
      const id = typeof idValue === "string" || typeof idValue === "number" ? idValue : undefined;
      const detail =
        asString(record.detail ?? record.body ?? record.text ?? record.description ?? record.summary).trim() ||
        undefined;

      return { label, entity, id, detail };
    })
    .filter(Boolean) as Array<{ label: string; entity?: string; id?: string | number; detail?: string }>;
}

function normalizeActionItems(value: unknown) {
  return asArray<unknown>(value)
    .map((item) => {
      if (typeof item === "string") {
        const label = item.trim();
        return label ? { label, action: "fill_input" as const, value: label, tone: undefined } : null;
      }
      if (!item || typeof item !== "object") return null;

      const record = item as Record<string, unknown>;
      const rawAction = asString(record.action ?? record.kind ?? record.type ?? record.intent)
        .trim()
        .toLowerCase();
      const action = ["navigate", "open", "go_to", "goto", "route", "link"].includes(rawAction)
        ? ("navigate" as const)
        : ("fill_input" as const);
      const label = asString(record.label ?? record.title ?? record.text ?? record.name).trim();
      const value = asString(
        record.value ?? record.href ?? record.path ?? record.route ?? record.url ?? record.prompt ?? record.message ?? record.query ?? record.input
      ).trim();

      if (!label || !value) return null;

      return {
        label,
        action,
        value,
        tone: normalizeTone(record.tone ?? record.level),
      };
    })
    .filter(Boolean) as Array<{
    label: string;
    action: "navigate" | "fill_input";
    value: string;
    tone?: "neutral" | "success" | "warning" | "danger";
  }>;
}

export function normalizeWidget(raw: Record<string, unknown>): Widget | null {
  const type = asString(raw.type);

  switch (type) {
    case "stats":
      return {
        type: "stats",
        title: asString(raw.title) || undefined,
        items: asArray<Record<string, unknown>>(raw.items ?? raw.stats ?? raw.metrics).map((item, index) => ({
          label: asString(item.label) || `Item ${index + 1}`,
          value: typeof item.value === "number" || typeof item.value === "string" ? item.value : "-",
          hint: asString(item.hint) || undefined,
          tone: normalizeTone(item.tone),
        })),
      };
    case "table":
      return {
        type: "table",
        title: asString(raw.title) || undefined,
        variant: ["default", "compact", "ledger"].includes(asString(raw.variant))
          ? (raw.variant as "default" | "compact" | "ledger")
          : undefined,
        columns: asArray<string>(raw.columns ?? raw.headers),
        rows: asArray<Array<string | number | boolean | null>>(raw.rows ?? raw.items),
        footer: Array.isArray(raw.footer) ? (raw.footer as Array<string | number | boolean | null>) : undefined,
      };
    case "callout":
      return {
        type: "callout",
        title: asString(raw.title) || undefined,
        body: asString(raw.body ?? raw.content ?? raw.text),
        tone: normalizeTone(raw.tone ?? raw.level),
      };
    case "checklist":
      return {
        type: "checklist",
        title: asString(raw.title) || undefined,
        items: asArray<string | Record<string, unknown>>(raw.items).map((item) => {
          if (typeof item === "string") return item;
          return {
            label: asString(item.label),
            text: asString(item.text),
            title: asString(item.title),
            checked: Boolean(item.checked ?? item.completed ?? item.done),
            hint: asString(item.hint),
            body: asString(item.body),
          };
        }),
      };
    case "mindmap":
      return normalizeMindMapWidget(raw);
    case "timeline":
      return {
        type: "timeline",
        title: asString(raw.title) || undefined,
        items: normalizeTimelineItems(raw.items ?? raw.steps ?? raw.events ?? raw.phases),
      };
    case "comparison":
      return {
        type: "comparison",
        title: asString(raw.title) || undefined,
        columns: asArray<Record<string, unknown>>(raw.columns ?? raw.items ?? raw.options ?? raw.scenarios)
          .map((column, index) => {
            const title = asString(
              column.title ?? column.label ?? column.name ?? column.criterio ?? column.estrategia ?? column.opcion ?? column.escenario
            ).trim();
            const body =
              asString(
                column.body ?? column.text ?? column.summary ?? column.descripcion ?? column.description ?? column.recomendacion
              ).trim() || undefined;
            const highlight =
              asString(column.highlight ?? column.impacto ?? column.resultado ?? column.metric ?? column.metrica).trim() ||
              undefined;
            const directBullets = asArray<unknown>(column.bullets ?? column.items ?? column.points)
              .map(normalizeComparisonBullet)
              .filter(Boolean);
            const reservedKeys = new Set([
              "title", "label", "name", "criterio", "estrategia", "opcion", "escenario",
              "body", "text", "summary", "descripcion", "description", "recomendacion",
              "highlight", "impacto", "resultado", "metric", "metrica", "bullets", "items", "points", "tone", "level",
            ]);
            const derivedBullets = directBullets.length
              ? directBullets
              : Object.entries(column)
                  .filter(([key, value]) => !reservedKeys.has(key) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean"))
                  .map(([key, value]) => `${formatComparisonKey(key)}: ${String(value).trim()}`)
                  .filter((bullet) => !highlight || bullet !== highlight);

            return {
              title: title || `Opción ${index + 1}`,
              body,
              bullets: derivedBullets,
              highlight,
              tone: normalizeTone(column.tone ?? column.level),
            };
          })
          .filter((column) => column.title || column.body || column.highlight || column.bullets.length),
      };
    case "board":
      return {
        type: "board",
        title: asString(raw.title) || undefined,
        columns: asArray<Record<string, unknown>>(raw.columns ?? raw.lists ?? raw.items ?? raw.groups).map((column, index) => ({
          title: asString(column.title ?? column.label ?? column.name) || `Columna ${index + 1}`,
          items: normalizeBoardItems(column.items ?? column.cards ?? column.children ?? column.entries),
          tone: normalizeTone(column.tone ?? column.level),
        })),
      };
    case "chart": {
      const normalizedChart = normalizeChartSeries(raw);
      return {
        type: "chart",
        title: asString(raw.title) || undefined,
        chartType: normalizedChart.chartType,
        labels: normalizedChart.labels,
        series: normalizedChart.series,
        valuePrefix: asString(raw.valuePrefix ?? raw.prefix) || undefined,
        valueSuffix: asString(raw.valueSuffix ?? raw.suffix) || undefined,
      };
    }
    case "excel-preview":
      return {
        type: "excel-preview",
        title: asString(raw.title) || undefined,
        filename: asString(raw.filename) || "reporte.xlsx",
        sheetName: asString(raw.sheetName) || undefined,
        rowCount: Number(raw.rowCount) || 0,
        columns: asArray<string>(raw.columns ?? raw.headers),
        rows: asArray<Array<string | number | boolean | null>>(raw.rows ?? raw.data),
        truncated: Boolean(raw.truncated),
      };
    case "sources":
      return {
        type: "sources",
        title: asString(raw.title) || undefined,
        items: normalizeSourceItems(raw.items ?? raw.sources ?? raw.references ?? raw.evidence),
      };
    case "actions":
      return {
        type: "actions",
        title: asString(raw.title) || undefined,
        items: normalizeActionItems(raw.items ?? raw.actions ?? raw.buttons ?? raw.ctas),
      };
    case "summary-list":
    case "summary_list":
    case "alert-list":
      return {
        type: "summary-list",
        title: asString(raw.title) || undefined,
        tone: normalizeTone(raw.tone ?? raw.level),
        count:
          typeof raw.count === "string" || typeof raw.count === "number"
            ? raw.count
            : typeof raw.totalCount === "string" || typeof raw.totalCount === "number"
              ? raw.totalCount
              : undefined,
        items: asArray<string | Record<string, unknown>>(raw.items ?? raw.entries).map((item) => {
          if (typeof item === "string") return item;
          return {
            label: asString(item.label ?? item.title ?? item.text),
            detail: asString(item.detail ?? item.meta ?? item.subtitle) || undefined,
          };
        }),
        maxVisible: Number(raw.maxVisible ?? 3) || undefined,
        overflowCount: Number(raw.overflowCount ?? raw.remainingCount ?? 0) || undefined,
        overflowLabel: asString(raw.overflowLabel ?? raw.moreLabel) || undefined,
      };
    default:
      return null;
  }
}

export function parseWidget(jsonText: string): Widget | null {
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
      return null;
    }
    return normalizeWidget(parsed as Record<string, unknown>);
  } catch {
    return null;
  }
}