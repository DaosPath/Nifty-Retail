import { memo, type CSSProperties } from "react";
import { getCategoryAccent, shortProductCode } from "../utils/categoryAccent";

export interface ProductCardProduct {
  code: string;
  name: string;
  category: string;
  sellingPrice: number;
  stock: number;
  minStock: number;
  image?: string;
}

export interface ProductCardProps {
  product: ProductCardProduct;
  soldOutLabel: string;
  stockLabel: string;
  formatPrice: (value: number) => string;
  onAdd: (product: ProductCardProduct) => void;
}

export const ProductCard = memo(function ProductCard({
  product: p,
  soldOutLabel,
  stockLabel,
  formatPrice,
  onAdd,
}: ProductCardProps) {
  const isLowStock = p.stock > 0 && p.stock <= p.minStock;
  const isOutOfStock = p.stock === 0;
  const accent = getCategoryAccent(p.category);

  const cardStyle = {
    "--cat-bg": accent.bg,
    "--cat-border": accent.border,
    "--cat-text": accent.text,
    "--cat-glow": accent.glow,
  } as CSSProperties;

  const cardClass = [
    "product-card",
    isOutOfStock ? "disabled is-sold-out" : "",
    isLowStock ? "is-low-stock" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={cardClass}
      onClick={() => !isOutOfStock && onAdd(p)}
      aria-label={p.name}
      style={cardStyle}
    >
      <div className="product-card-accent" aria-hidden="true" />
      <div
        className={`product-card-media ${p.image ? "has-image" : "is-placeholder"}`}
      >
        {p.image ? (
          <img src={p.image} alt="" className="product-card-img" loading="lazy" decoding="async" />
        ) : (
          <div className="product-card-placeholder" aria-hidden="true">
            <svg
              className="product-card-placeholder-icon"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
        )}

        <span className="product-card-cat-pill" title={p.category}>
          {p.category}
        </span>

        <span
          className={`product-card-stock-pill ${
            isOutOfStock ? "out-of-stock" : isLowStock ? "low-stock" : "in-stock"
          }`}
        >
          {isOutOfStock ? soldOutLabel : stockLabel}
        </span>

        {isOutOfStock && <span className="product-card-sold-overlay" aria-hidden="true" />}

        {!isOutOfStock && (
          <span className="product-card-add-hint" aria-hidden="true">
            +
          </span>
        )}
      </div>

      <div className="product-card-info">
        <h4 className="product-card-name" title={p.name}>
          {p.name}
        </h4>
        <div className="product-card-footer">
          <span className="product-card-price">{formatPrice(p.sellingPrice)}</span>
          <span className="product-card-code" title={p.code}>
            {shortProductCode(p.code)}
          </span>
        </div>
      </div>
    </article>
  );
});