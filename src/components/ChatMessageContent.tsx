import React from "react";
import {
  InvalidWidget,
  WidgetRenderer,
  messageHasWidgetFence,
  segmentMessageByWidgets,
} from "../features/ai-chat";

interface ChatMessageContentProps {
  text: string;
  variant: "user" | "ai";
}

const BULLET_RE = /^[\s]*(?:[•\-*]|\d+\.)\s+/;
const TOKEN_RE = /\*\*([^*]+)\*\*|\*([^*]+)\*|_(.+?)_|([+\-]?\s*S\/\s*[\d,.]+)/g;
const KV_RE = /^\*\*([^*]+)\*\*:?\s*(.*)$/;

type InventoryRow = {
  name: string;
  code: string;
  stock: number;
  minStock: number;
};

type Block =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "kv"; title?: string; rows: Array<{ label: string; value: string; note?: string }> }
  | { type: "inventory"; title?: string; rows: InventoryRow[] };

const INVENTORY_LINE_RE =
  /^\*?([^*]+)\*?\s*\(Código:\s*([^)]+)\):\s*Stock actual\s*\*\*([^*]+)\*\*\s*\(Mínimo recomendado:\s*([^)]+)\)\s*$/i;

function normalizeMessageText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/([^\n])\s*•\s*/g, "$1\n• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let token = 0;
  let match: RegExpExecArray | null;

  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <React.Fragment key={`${keyPrefix}-plain-${token++}`}>
          {text.slice(lastIndex, match.index)}
        </React.Fragment>
      );
    }

    if (match[1]) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${token++}`} className="chat-md-strong">
          {match[1]}
        </strong>
      );
    } else if (match[2]) {
      nodes.push(
        <em key={`${keyPrefix}-em-${token++}`} className="chat-md-em">
          {match[2]}
        </em>
      );
    } else if (match[3]) {
      nodes.push(
        <em key={`${keyPrefix}-em2-${token++}`} className="chat-md-em">
          {match[3]}
        </em>
      );
    } else if (match[4]) {
      const amount = match[4].trim();
      const tone = amount.startsWith("-") ? "neg" : amount.startsWith("+") ? "pos" : "neutral";
      nodes.push(
        <span key={`${keyPrefix}-amount-${token++}`} className={`chat-md-amount chat-md-amount--${tone}`}>
          {amount}
        </span>
      );
    }

    lastIndex = TOKEN_RE.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(
      <React.Fragment key={`${keyPrefix}-plain-${token++}`}>{text.slice(lastIndex)}</React.Fragment>
    );
  }

  return nodes.length > 0 ? nodes : [text];
}

function stripBullet(line: string): string {
  return line.replace(BULLET_RE, "").trim();
}

function isBulletLine(line: string): boolean {
  return BULLET_RE.test(line);
}

function parseInventoryLine(line: string): InventoryRow | null {
  const content = stripBullet(line);
  const match = content.match(INVENTORY_LINE_RE);
  if (!match) return null;

  const stock = Number.parseFloat(match[3].replace(",", "."));
  const minStock = Number.parseFloat(match[4].replace(",", "."));
  if (Number.isNaN(stock) || Number.isNaN(minStock)) return null;

  return {
    name: match[1].trim(),
    code: match[2].trim(),
    stock,
    minStock,
  };
}

function parseKeyValueLine(line: string): { label: string; value: string; note?: string } | null {
  const content = stripBullet(line);
  const kv = content.match(KV_RE);
  if (!kv) return null;

  const label = kv[1].trim().replace(/:$/, "");
  let rest = kv[2].trim();

  const noteMatch = rest.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (noteMatch) {
    return { label, value: noteMatch[1].trim(), note: noteMatch[2].trim() };
  }

  return { label, value: rest };
}

function buildBlocks(text: string): Block[] {
  const lines = normalizeMessageText(text).split("\n");
  const blocks: Block[] = [];
  let bulletBuffer: string[] = [];
  let pendingTitle: string | undefined;

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;

    const kvRows = bulletBuffer
      .map(parseKeyValueLine)
      .filter((row): row is { label: string; value: string; note?: string } => row !== null);

    const inventoryRows = bulletBuffer
      .map(parseInventoryLine)
      .filter((row): row is InventoryRow => row !== null);

    if (inventoryRows.length === bulletBuffer.length && inventoryRows.length > 0) {
      blocks.push({ type: "inventory", title: pendingTitle, rows: inventoryRows });
      pendingTitle = undefined;
    } else if (kvRows.length === bulletBuffer.length && kvRows.length > 0) {
      blocks.push({ type: "kv", title: pendingTitle, rows: kvRows });
      pendingTitle = undefined;
    } else {
      if (pendingTitle) {
        blocks.push({ type: "paragraph", text: pendingTitle });
        pendingTitle = undefined;
      }
      blocks.push({ type: "list", items: [...bulletBuffer] });
    }

    bulletBuffer = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushBullets();
      return;
    }

    if (isBulletLine(line)) {
      bulletBuffer.push(line);
      return;
    }

    flushBullets();

    if (bulletBuffer.length === 0 && line.endsWith(":") && !line.includes("**")) {
      pendingTitle = line;
      return;
    }

    if (pendingTitle && !isBulletLine(line)) {
      blocks.push({ type: "paragraph", text: `${pendingTitle} ${line}` });
      pendingTitle = undefined;
      return;
    }

    if (pendingTitle) {
      blocks.push({ type: "paragraph", text: pendingTitle });
      pendingTitle = undefined;
    }

    blocks.push({ type: "paragraph", text: line });
  });

  flushBullets();
  if (pendingTitle) {
    blocks.push({ type: "paragraph", text: pendingTitle });
  }

  return blocks;
}

function hasRichFormatting(text: string): boolean {
  const normalized = normalizeMessageText(text);
  return normalized.includes("**") || normalized.includes("•") || BULLET_RE.test(normalized);
}

function isSummaryLayout(blocks: Block[]): boolean {
  return blocks.some((b) => b.type === "kv" && b.rows.length >= 3);
}

function isInventoryLayout(blocks: Block[]): boolean {
  return blocks.some((b) => b.type === "inventory" && b.rows.length >= 1);
}

function inventoryStatus(stock: number, minStock: number): { label: string; tone: "empty" | "critical" | "low" } {
  if (stock <= 0) return { label: "Agotado", tone: "empty" };
  if (stock <= minStock) return { label: "Crítico", tone: "critical" };
  return { label: "Bajo", tone: "low" };
}

function renderLegacyBlocks(blocks: Block[], keyPrefix: string) {
  return blocks.map((block, index) => {
    const blockKey = `${keyPrefix}-${index}`;
    if (block.type === "inventory") {
      return (
        <div key={`inv-${blockKey}`} className="chat-inventory-card">
              {block.title && (
            <p className="chat-inventory-title">{parseInline(block.title.replace(/:$/, ""), `inv-title-${blockKey}`)}</p>
              )}
              <div className="chat-inventory-meta">
                <span className="chat-inventory-count">{block.rows.length} productos</span>
              </div>
              <div className="chat-inventory-scroll">
                <table className="chat-inventory-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Código</th>
                      <th>Stock</th>
                      <th>Mín.</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => {
                      const status = inventoryStatus(row.stock, row.minStock);
                      return (
                        <tr
                          key={`inv-row-${blockKey}-${rowIndex}`}
                          className={`chat-inventory-row chat-inventory-row--${status.tone}`}
                        >
                          <td className="chat-inventory-name" title={row.name}>
                            {row.name}
                          </td>
                          <td className="chat-inventory-code">{row.code}</td>
                          <td className="chat-inventory-stock">{row.stock}</td>
                          <td className="chat-inventory-min">{row.minStock}</td>
                          <td>
                            <span className={`chat-inventory-badge chat-inventory-badge--${status.tone}`}>
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
        </div>
      );
    }

    if (block.type === "kv") {
      return (
        <div key={`kv-${blockKey}`} className="chat-summary-card">
              {block.title && (
            <p className="chat-summary-title">{parseInline(block.title.replace(/:$/, ""), `title-${blockKey}`)}</p>
              )}
              <div className="chat-kv-grid">
                {block.rows.map((row, rowIndex) => (
                  <div
                    key={`row-${blockKey}-${rowIndex}`}
                    className={`chat-kv-row${row.label.toLowerCase().includes("esperado") ? " is-highlight" : ""}`}
                  >
                    <span className="chat-kv-label">{row.label}</span>
                    <div className="chat-kv-value-wrap">
                      <span className="chat-kv-value">{parseInline(row.value, `val-${blockKey}-${rowIndex}`)}</span>
                      {row.note && <span className="chat-kv-note">{row.note}</span>}
                    </div>
                  </div>
                ))}
              </div>
        </div>
      );
    }

    if (block.type === "list") {
      return (
        <ul key={`ul-${blockKey}`} className="chat-md-list">
          {block.items.map((line, i) => (
            <li key={`li-${blockKey}-${i}`}>{parseInline(stripBullet(line), `li-${blockKey}-${i}`)}</li>
          ))}
        </ul>
      );
    }

    return (
      <p key={`p-${blockKey}`} className="chat-md-paragraph">
        {parseInline(block.text, `p-${blockKey}`)}
      </p>
    );
  });
}

export function ChatMessageContent({ text, variant }: ChatMessageContentProps) {
  const hasWidgets = variant === "ai" && messageHasWidgetFence(text);
  const segments = hasWidgets ? segmentMessageByWidgets(text) : [{ type: "text" as const, content: text }];
  const legacyBlocks = buildBlocks(text);
  const summary = variant === "ai" && isSummaryLayout(legacyBlocks);
  const inventory = variant === "ai" && isInventoryLayout(legacyBlocks);

  return (
    <div
      className={`chat-message-content chat-message-content--${variant}${
        hasRichFormatting(text) ? " is-rich" : ""
      }${summary ? " is-summary" : ""}${inventory ? " is-inventory" : ""}${hasWidgets ? " is-widget" : ""}`}
    >
      {segments.map((segment, segmentIndex) => {
        if (segment.type === "widget") {
          return (
            <div key={`widget-${segmentIndex}`} className="chat-widget-slot">
              <WidgetRenderer widget={segment.widget} />
            </div>
          );
        }

        if (segment.type === "widget-error") {
          return (
            <InvalidWidget
              key={`widget-error-${segmentIndex}`}
              title="Widget inválido"
              message={segment.message}
            />
          );
        }

        const blocks = buildBlocks(segment.content);
        return (
          <div key={`text-${segmentIndex}`} className="chat-message-segment">
            {renderLegacyBlocks(blocks, `seg-${segmentIndex}`)}
          </div>
        );
      })}
    </div>
  );
}