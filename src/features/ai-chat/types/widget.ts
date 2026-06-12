export type TableVariant = "default" | "compact" | "ledger";
export type CalloutTone = "neutral" | "success" | "warning" | "danger";

export type Widget =
  | {
      type: "stats";
      title?: string;
      items: Array<{
        label: string;
        value: string | number;
        hint?: string;
        tone?: CalloutTone;
      }>;
    }
  | {
      type: "table";
      title?: string;
      variant?: TableVariant;
      columns: string[];
      rows: Array<Array<string | number | boolean | null>>;
      footer?: Array<string | number | boolean | null>;
    }
  | {
      type: "callout";
      title?: string;
      body: string;
      tone?: CalloutTone;
    }
  | {
      type: "checklist";
      title?: string;
      items: Array<
        | string
        | {
            label?: string;
            text?: string;
            title?: string;
            checked?: boolean;
            hint?: string;
            body?: string;
          }
      >;
    }
  | {
      type: "mindmap";
      title?: string;
      layout?: "radial" | "tree" | "columns";
      root: string;
      subtitle?: string;
      branches: Array<{
        label: string;
        hint?: string;
        children?: string[];
      }>;
    }
  | {
      type: "timeline";
      title?: string;
      items: Array<{
        title: string;
        body?: string;
        meta?: string;
        tone?: CalloutTone;
      }>;
    }
  | {
      type: "comparison";
      title?: string;
      columns: Array<{
        title: string;
        body?: string;
        bullets?: string[];
        highlight?: string;
        tone?: CalloutTone;
      }>;
    }
  | {
      type: "board";
      title?: string;
      columns: Array<{
        title: string;
        items: string[];
        tone?: CalloutTone;
      }>;
    }
  | {
      type: "chart";
      title?: string;
      chartType?: "bar" | "line";
      labels: string[];
      series: Array<{
        name: string;
        values: number[];
        color?: string;
      }>;
      valuePrefix?: string;
      valueSuffix?: string;
    }
  | {
      type: "excel-preview";
      title?: string;
      filename: string;
      sheetName?: string;
      rowCount: number;
      columns: string[];
      rows: Array<Array<string | number | boolean | null>>;
      truncated?: boolean;
    }
  | {
      type: "sources";
      title?: string;
      items: Array<{
        label: string;
        entity?: string;
        id?: string | number;
        detail?: string;
      }>;
    }
  | {
      type: "actions";
      title?: string;
      items: Array<{
        label: string;
        action: "navigate" | "fill_input";
        value: string;
        tone?: CalloutTone;
      }>;
    }
  | {
      type: "summary-list";
      title?: string;
      tone?: CalloutTone;
      count?: string | number;
      items: Array<
        | string
        | {
            label?: string;
            detail?: string;
          }
      >;
      maxVisible?: number;
      overflowCount?: number;
      overflowLabel?: string;
    };

export type WidgetType = Widget["type"];