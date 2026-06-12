import { forwardRef, memo } from "react";
import { EditIcon, DeleteIcon, BookIcon, BoxIcon } from "./Icons";
import { isoToDisplay } from "../utils/dateInput";
import { useI18n } from "../i18n";

interface InventoryProduct {
  code: string;
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  image?: string;
  manufacturer?: string;
}

export interface InventoryTableRowProps {
  product: InventoryProduct;
  nextLotExpiry: string | null;
  nowMs: number;
  noLotsLabel: string;
  editLabel: string;
  lotsLabel: string;
  deleteLabel: string;
  formatMoney: (value: number) => string;
  onEdit: (product: InventoryProduct) => void;
  onLots: (product: InventoryProduct) => void;
  onDelete: (code: string) => void;
}

export const InventoryTableRow = memo(
  forwardRef<HTMLTableRowElement, InventoryTableRowProps>(function InventoryTableRow(
    {
      product: p,
      nextLotExpiry,
      nowMs,
      noLotsLabel,
      editLabel,
      lotsLabel,
      deleteLabel,
      formatMoney,
      onEdit,
      onLots,
      onDelete,
    },
    ref
  ) {
  const { locale } = useI18n();
  const minStock = Number(p.minStock) || 0;
  const manufacturerLabel = p.manufacturer?.trim() || "—";
  const isLowStock = p.stock <= minStock;
  const isExpired = nextLotExpiry ? new Date(nextLotExpiry).getTime() < nowMs : false;
  const daysToExpiry = nextLotExpiry
    ? Math.ceil((new Date(nextLotExpiry).getTime() - nowMs) / (1000 * 60 * 60 * 24))
    : null;
  const isExpirySoon = daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 45;
  const rowClass = [
    isLowStock ? "inventory-row--low" : "",
    isExpired ? "inventory-row--expired" : isExpirySoon ? "inventory-row--expiring" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <tr ref={ref} className={rowClass || undefined}>
      <td className="inventory-col-code">
        <span className="inventory-code" title={p.code}>
          {p.code}
        </span>
      </td>
      <td>
        {p.image ? (
          <img src={p.image} alt={p.name} className="inventory-thumb" loading="lazy" decoding="async" />
        ) : (
          <div className="inventory-thumb inventory-thumb--placeholder">
            <BoxIcon size={14} />
          </div>
        )}
      </td>
      <td>
        <span className="inventory-name">{p.name}</span>
      </td>
      <td>
        <span className="inventory-category-pill">{p.category}</span>
      </td>
      <td className="inventory-col-manufacturer">
        <span className="inventory-muted">{manufacturerLabel}</span>
      </td>
      <td className="inventory-col-money">
        <span className="inventory-money inventory-money--cost">{formatMoney(p.purchasePrice)}</span>
      </td>
      <td className="inventory-col-money">
        <span className="inventory-money">{formatMoney(p.sellingPrice)}</span>
      </td>
      <td className="inventory-col-num">
        <span className={`inventory-stock-pill${isLowStock ? " is-low" : " is-ok"}`}>{p.stock}</span>
      </td>
      <td className="inventory-col-num">
        <span className="inventory-min-stock">{minStock}</span>
      </td>
      <td className="inventory-col-expiry">
        {nextLotExpiry ? (
          <span className={`inventory-expiry-pill${isExpired ? " is-expired" : isExpirySoon ? " is-soon" : ""}`}>
            {isoToDisplay(nextLotExpiry, locale)}
          </span>
        ) : (
          <span className="inventory-expiry-pill is-none">{noLotsLabel}</span>
        )}
      </td>
      <td className="inventory-col-actions">
        <div className="inventory-row-actions">
          <button
            type="button"
            className="inventory-action-btn inventory-action-btn--edit"
            title={editLabel}
            onClick={() => onEdit(p)}
          >
            <EditIcon size={14} />
            <span>{editLabel}</span>
          </button>
          <button
            type="button"
            className="inventory-action-btn inventory-action-btn--lots"
            title={lotsLabel}
            onClick={() => onLots(p)}
          >
            <BookIcon size={14} />
            <span>{lotsLabel}</span>
          </button>
          <button
            type="button"
            className="inventory-action-btn inventory-action-btn--delete"
            title={deleteLabel}
            onClick={() => onDelete(p.code)}
          >
            <DeleteIcon size={14} />
            <span>{deleteLabel}</span>
          </button>
        </div>
      </td>
    </tr>
  );
  })
);