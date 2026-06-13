import React, { useState, useEffect, useMemo, useDeferredValue, useCallback, useRef } from "react";
import { useI18n } from "../i18n";
import { useScanner } from "../hooks/useScanner";
import { CartIcon, DeleteIcon, CashIcon, CardIcon, YapeIcon, CheckIcon, EditIcon, UserIcon, TicketIcon } from "./Icons";
import { ProductCard, type ProductCardProduct } from "./ProductCard";
import type { StoreConfig } from "../App";
import type { Category } from "../types/catalog";
import { getActiveCategoryNames } from "../utils/catalogHelpers";
import { getCategoryAccent } from "../utils/categoryAccent";
import { getNextDocumentNumber } from "../utils/documents";
import { calculateSaleTax, resolveTaxConfig, taxLabel } from "../utils/tax";
import { useMoney } from "../hooks/useMoney";
import { SelectField, type SelectOption } from "./SelectField";

interface Product {
  code: string;
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  expiryDate?: string;
  image?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  customPrice?: number;
}

interface POSProps {
  products: Product[];
  categories: Category[];
  activeSession: any;
  debts: any[];
  storeConfig: StoreConfig;
  onCheckout: (
    items: any[], 
    subtotal: number, 
    discount: number, 
    total: number, 
    paymentMethod: string, 
    cashReceived: number, 
    cashChange: number,
    documentType: "ticket" | "boleta",
    selectedCustomerId?: string,
    customerDni?: string,
    customerName?: string
  ) => boolean | Promise<boolean>;
  onOpenCash: () => void;
}

export const POS: React.FC<POSProps> = ({
  products,
  categories,
  activeSession,
  debts,
  storeConfig,
  onCheckout,
  onOpenCash,
}) => {
  const { t } = useI18n();
  const allCategory = t("common.all");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(allCategory);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [cashReceived, setCashReceived] = useState("");
  const [change, setChange] = useState(0);
  const [scanNotification, setScanNotification] = useState<string | null>(null);
  const [editingPriceCode, setEditingPriceCode] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState("");
  const categoriesScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollCategoriesLeft, setCanScrollCategoriesLeft] = useState(false);
  const [canScrollCategoriesRight, setCanScrollCategoriesRight] = useState(false);

  // Invoicing states
  const [documentType, setDocumentType] = useState<"ticket" | "boleta">("ticket");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerDni, setCustomerDni] = useState("");
  const [customerName, setCustomerName] = useState("");

  const productsByCode = useMemo(() => {
    const map = new Map<string, Product>();
    for (const product of products) map.set(product.code, product);
    return map;
  }, [products]);

  const categoryTabs = useMemo(() => {
    const fromCatalog = getActiveCategoryNames(categories);
    const merged = new Set(fromCatalog);
    for (const product of products) {
      if (product.category) merged.add(product.category);
    }
    return [allCategory, ...merged];
  }, [categories, products, allCategory]);

  const creditCustomerOptions = useMemo<SelectOption[]>(
    () =>
      debts.map((d) => ({
        value: d.id,
        label: d.customerName,
        hint: `Deuda S/ ${d.totalDebt.toFixed(2)}`,
      })),
    [debts]
  );

  useEffect(() => {
    setSelectedCategory((prev) => (prev === "Todos" || prev === "All" ? allCategory : prev));
  }, [allCategory]);

  const updateCategoriesScrollState = useCallback(() => {
    const el = categoriesScrollRef.current;
    if (!el) return;
    setCanScrollCategoriesLeft(el.scrollLeft > 6);
    setCanScrollCategoriesRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
  }, []);

  useEffect(() => {
    const el = categoriesScrollRef.current;
    if (!el) return;
    updateCategoriesScrollState();
    el.addEventListener("scroll", updateCategoriesScrollState, { passive: true });
    const observer = new ResizeObserver(updateCategoriesScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateCategoriesScrollState);
      observer.disconnect();
    };
  }, [categoryTabs, updateCategoriesScrollState]);

  const scrollCategories = useCallback((delta: number) => {
    categoriesScrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  const nextTicketNumber = useMemo(
    () => getNextDocumentNumber("ticket", storeConfig),
    [storeConfig]
  );
  const nextBoletaNumber = useMemo(
    () => getNextDocumentNumber("boleta", storeConfig),
    [storeConfig]
  );

  // Global scanner listener
  useScanner({
    onScan: (barcode) => {
      const prod = productsByCode.get(barcode);
      if (prod) {
        if (prod.stock <= 0) {
          showNotification(`⚠️ ${t("pos.noStock", { name: prod.name })}`);
          return;
        }
        addToCart(prod);
        showNotification(`🛒 ${t("pos.added", { name: prod.name })}`);
      } else {
        showNotification(`❌ ${t("pos.codeNotFound", { code: barcode })}`);
      }
    },
    enabled: true,
  });

  const showNotification = (msg: string) => {
    setScanNotification(msg);
    setTimeout(() => setScanNotification(null), 3000);
  };

  const saveCustomPrice = (code: string) => {
    if (tempPrice.trim() === "") {
      setCart(
        cart.map((item) =>
          item.product.code === code
            ? { ...item, customPrice: undefined }
            : item
        )
      );
      setEditingPriceCode(null);
      return;
    }
    const price = parseFloat(tempPrice);
    if (!isNaN(price) && price >= 0) {
      setCart(
        cart.map((item) =>
          item.product.code === code
            ? { ...item, customPrice: price }
            : item
        )
      );
    }
    setEditingPriceCode(null);
  };

  // Cart operations
  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.code === product.code);
    const currentQty = existing ? existing.quantity : 0;

    if (currentQty >= product.stock) {
      showNotification(`⚠️ Stock máximo alcanzado para ${product.name}`);
      return;
    }

    if (existing) {
      setCart(
        cart.map((item) =>
          item.product.code === product.code
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (code: string, delta: number) => {
    const item = cart.find((i) => i.product.code === code);
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart(cart.filter((i) => i.product.code !== code));
      return;
    }

    if (newQty > item.product.stock) {
      showNotification(`⚠️ Stock insuficiente (${item.product.stock} disp.)`);
      return;
    }

    setCart(
      cart.map((i) =>
        i.product.code === code ? { ...i, quantity: newQty } : i
      )
    );
  };

  const removeFromCart = (code: string) => {
    setCart(cart.filter((item) => item.product.code !== code));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Math
  const subtotal = cart.reduce(
    (sum, item) => sum + (item.customPrice ?? item.product.sellingPrice) * item.quantity,
    0
  );
  const discount = 0; // future feature: add discounts
  const taxConfig = useMemo(() => resolveTaxConfig(storeConfig), [storeConfig]);
  const taxBreakdown = useMemo(
    () => calculateSaleTax(subtotal, discount, taxConfig),
    [subtotal, discount, taxConfig]
  );
  const total = taxBreakdown.total;
  const { formatMoney } = useMoney();

  // Change calculation
  useEffect(() => {
    const received = parseFloat(cashReceived) || 0;
    if (received >= total) {
      setChange(received - total);
    } else {
      setChange(0);
    }
  }, [cashReceived, total]);

  const handleCheckout = async () => {
    if (cart.length === 0 || isCheckingOut) return;
    if (!activeSession) {
      alert("Debe abrir caja antes de registrar una venta.");
      onOpenCash();
      return;
    }

    const received = paymentMethod === "Efectivo" ? parseFloat(cashReceived) || 0 : total;
    if (paymentMethod === "Efectivo" && received < total) {
      alert("El efectivo recibido es menor al total de la venta.");
      return;
    }

    if (documentType === "boleta" && total >= 700) {
      if (!customerDni.trim() || !customerName.trim()) {
        alert("Para ventas de S/ 700.00 o más con Boleta de Venta, la SUNAT exige ingresar el DNI y Nombre del cliente.");
        return;
      }
    }

    if (paymentMethod === "Fiado" && !selectedCustomerId) {
      alert("Por favor seleccione un cliente para registrar el fiado.");
      return;
    }

    const checkoutItems = cart.map((item) => ({
      code: item.product.code,
      name: item.product.name,
      price: item.customPrice ?? item.product.sellingPrice,
      quantity: item.quantity,
    }));

    setIsCheckingOut(true);
    let completed = false;
    try {
      completed = !!(await onCheckout(
        checkoutItems,
        subtotal,
        discount,
        total,
        paymentMethod,
        received,
        paymentMethod === "Efectivo" ? received - total : 0,
        documentType,
        paymentMethod === "Fiado" ? selectedCustomerId : undefined,
        documentType === "boleta" ? customerDni : undefined,
        documentType === "boleta" ? customerName : undefined
      ));
    } finally {
      setIsCheckingOut(false);
    }

    if (!completed) return;

    // Reset checkout states
    setCart([]);
    setCashReceived("");
    setChange(0);
    setSelectedCustomerId("");
    setCustomerDni("");
    setCustomerName("");
    setDocumentType("ticket");
  };

  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = deferredSearchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch =
        !normalizedSearch ||
        p.name.toLowerCase().includes(normalizedSearch) ||
        p.code.includes(deferredSearchQuery);
      const matchesCategory =
        selectedCategory === allCategory || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, deferredSearchQuery, selectedCategory, allCategory]);

  const addToCartRef = useRef(addToCart);
  addToCartRef.current = addToCart;

  const handleAddProduct = useCallback((product: ProductCardProduct) => {
    addToCartRef.current(product as Product);
  }, []);

  return (
    <div className="pos-layout">
      {/* Scanner Alert Notification */}
      {scanNotification && (
        <div className="barcode-notif">
          <span>{scanNotification}</span>
        </div>
      )}

      {/* Products Left Side */}
      <div className="pos-products-side">
        <div className="pos-catalog-toolbar">
          <div className="pos-catalog-toolbar-top">
            <div className="pos-search-bar">
              <div className="search-input-wrapper">
                <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  id="barcode-input"
                  type="text"
                  className="pos-search-input scanner-target"
                  placeholder={t("pos.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <span className="pos-search-scanner-hint" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                    <line x1="7" y1="12" x2="17" y2="12" />
                  </svg>
                </span>
              </div>
            </div>

            <div className="pos-catalog-stats">
              <div className="pos-catalog-stat">
                <span className="pos-catalog-stat-label">
                  {filteredProducts.length === 1
                    ? t("pos.productsFound", { count: filteredProducts.length })
                    : t("pos.productsFoundPlural", { count: filteredProducts.length })}
                </span>
              </div>
              {cart.length > 0 && (
                <div className="pos-catalog-stat pos-catalog-stat--cart">
                  <span className="pos-catalog-stat-label">
                    {cart.length === 1
                      ? t("pos.items", { count: cart.length })
                      : t("pos.itemsPlural", { count: cart.length })}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="pos-categories-rail">
            <div className="pos-categories-rail-head">
              <span className="pos-categories-rail-label">{t("pos.categoriesLabel")}</span>
              <div className="pos-categories-scroll-controls">
                <button
                  type="button"
                  className="pos-categories-scroll-btn"
                  onClick={() => scrollCategories(-220)}
                  disabled={!canScrollCategoriesLeft}
                  aria-label={t("pos.scrollCategoriesLeft")}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="pos-categories-scroll-btn"
                  onClick={() => scrollCategories(220)}
                  disabled={!canScrollCategoriesRight}
                  aria-label={t("pos.scrollCategoriesRight")}
                >
                  ›
                </button>
              </div>
            </div>
            <div className={`pos-categories-shell${canScrollCategoriesLeft ? " can-scroll-left" : ""}${canScrollCategoriesRight ? " can-scroll-right" : ""}`}>
              <div className="pos-categories" ref={categoriesScrollRef}>
                {categoryTabs.map((cat) => {
                  const isAll = cat === allCategory;
                  const isActive = selectedCategory === cat;
                  const accent = isAll ? null : getCategoryAccent(cat);
                  const tabStyle = isAll
                    ? undefined
                    : ({
                        "--tab-accent": accent!.text,
                        "--tab-bg": accent!.bg,
                        "--tab-border": accent!.border,
                      } as React.CSSProperties);

                  return (
                    <button
                      key={cat}
                      type="button"
                      className={`category-tab${isActive ? " active" : ""}${isAll ? " is-all" : ""}`}
                      style={tabStyle}
                      onClick={() => setSelectedCategory(cat)}
                      aria-pressed={isActive}
                    >
                      {!isAll && <span className="category-tab-dot" aria-hidden="true" />}
                      <span className="category-tab-label">{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {selectedCategory !== allCategory && (
            <div className="pos-active-filter">
              <span className="pos-category-filter-label">{t("pos.filterLabel", { category: selectedCategory })}</span>
              <button
                type="button"
                className="pos-clear-filter-btn"
                onClick={() => setSelectedCategory(allCategory)}
              >
                {allCategory}
              </button>
            </div>
          )}
        </div>

        <div className="pos-products-scroll">
          <div className="pos-products-grid">
            {filteredProducts.map((p) => (
              <ProductCard
                key={p.code}
                product={p}
                soldOutLabel={t("pos.soldOut")}
                stockLabel={t("pos.stockLabel", { count: p.stock })}
                formatPrice={formatMoney}
                onAdd={handleAddProduct}
              />
            ))}
            {filteredProducts.length === 0 && (
              <div className="pos-empty-state">
                {t("pos.noProducts")}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`pos-cart-side ${cart.length > 0 ? "has-items" : ""}`}>
        <div className="pos-cart-header">
          <div className="pos-cart-header-title">
            <div className="pos-cart-header-icon" aria-hidden="true">
              <CartIcon size={18} />
            </div>
            <div>
              <h3>{t("pos.saleDetail")}</h3>
              {cart.length > 0 && (
                <span className="pos-cart-count">
                  {cart.length === 1
                    ? t("pos.items", { count: cart.length })
                    : t("pos.itemsPlural", { count: cart.length })}
                </span>
              )}
            </div>
          </div>
          {cart.length > 0 && (
            <button type="button" className="pos-cart-clear-btn" onClick={clearCart}>
              {t("pos.clearCart")}
            </button>
          )}
        </div>

        <div className="pos-cart-items">
          {cart.map((item) => {
            const unitPrice = item.customPrice ?? item.product.sellingPrice;
            const lineTotal = unitPrice * item.quantity;

            return (
              <div key={item.product.code} className="cart-item-card">
                <div className="cart-item-top">
                  <p className="cart-item-name">{item.product.name}</p>
                  <button
                    type="button"
                    className="cart-item-remove"
                    onClick={() => removeFromCart(item.product.code)}
                    title="Quitar del carrito"
                  >
                    <DeleteIcon size={15} />
                  </button>
                </div>

                <div className="cart-item-mid">
                  {editingPriceCode === item.product.code ? (
                    <div className="cart-item-price-edit">
                      <span className="cart-item-price-currency">S/</span>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control cart-item-price-input"
                        value={tempPrice}
                        onChange={(e) => setTempPrice(e.target.value)}
                        onBlur={() => saveCustomPrice(item.product.code)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveCustomPrice(item.product.code);
                          if (e.key === "Escape") setEditingPriceCode(null);
                        }}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="cart-item-price-row">
                      <span className="cart-item-price">S/ {unitPrice.toFixed(2)} c/u</span>
                      {item.customPrice !== undefined && (
                        <span className="special-price-badge">Especial</span>
                      )}
                      <button
                        type="button"
                        className="edit-price-btn"
                        onClick={() => {
                          setEditingPriceCode(item.product.code);
                          setTempPrice(unitPrice.toString());
                        }}
                        title="Editar precio especial"
                      >
                        <EditIcon size={12} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="cart-item-bottom">
                  <div className="cart-item-qty">
                    <button type="button" className="cart-qty-btn" onClick={() => updateQuantity(item.product.code, -1)}>−</button>
                    <span className="cart-qty-value">{item.quantity}</span>
                    <button type="button" className="cart-qty-btn" onClick={() => updateQuantity(item.product.code, 1)}>+</button>
                  </div>
                  <span className="cart-item-total">S/ {lineTotal.toFixed(2)}</span>
                </div>
              </div>
            );
          })}

          {cart.length === 0 && (
            <div className="pos-cart-empty">
              <div className="pos-cart-empty-visual" aria-hidden="true">
                <span className="pos-cart-empty-ring pos-cart-empty-ring--outer" />
                <span className="pos-cart-empty-ring pos-cart-empty-ring--inner" />
                <CartIcon size={36} />
              </div>
              <p>{t("pos.cartEmpty")}</p>
              <span>{t("pos.emptyCartHint")}</span>
              <div className="pos-cart-empty-steps">
                <div className="pos-cart-empty-step">
                  <span className="pos-cart-empty-step-num">1</span>
                  <span>{t("pos.emptyStepScan")}</span>
                </div>
                <div className="pos-cart-empty-step">
                  <span className="pos-cart-empty-step-num">2</span>
                  <span>{t("pos.emptyStepTap")}</span>
                </div>
                <div className="pos-cart-empty-step">
                  <span className="pos-cart-empty-step-num">3</span>
                  <span>{t("pos.emptyStepPay")}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="pos-cart-footer">
            <div className="pos-cart-totals">
              <div className="pos-subtotal-row">
                <span>{t("pos.subtotal")}</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
              {taxBreakdown.taxAmount > 0 && !taxConfig.taxInclusive && (
                <div className="pos-subtotal-row">
                  <span>{taxLabel(taxConfig, t)}</span>
                  <span>{formatMoney(taxBreakdown.taxAmount)}</span>
                </div>
              )}
              <div className="pos-total-box">
                <span className="pos-total-label">{t("pos.total")}</span>
                <span className="pos-total-amount">{formatMoney(total)}</span>
              </div>
            </div>

            <div className="pos-checkout-scroll">
              <section className="pos-checkout-section">
                <h4 className="pos-checkout-label">{t("pos.documentType")}</h4>
                <div className="pos-doc-options pos-doc-options--stacked">
                  <button
                    type="button"
                    className={`pos-doc-option ${documentType === "ticket" ? "active" : ""}`}
                    onClick={() => setDocumentType("ticket")}
                  >
                    <span className="pos-doc-option-title">
                      <TicketIcon size={14} />
                      {t("pos.documentTicket")}
                    </span>
                    <span className="pos-doc-option-series">{nextTicketNumber}</span>
                    <span className="pos-doc-option-hint">{t("pos.internalControl")}</span>
                  </button>
                  <button
                    type="button"
                    className={`pos-doc-option ${documentType === "boleta" ? "active" : ""}`}
                    onClick={() => setDocumentType("boleta")}
                  >
                    <span className="pos-doc-option-title">
                      <TicketIcon size={14} />
                      {t("pos.documentBoleta")}
                    </span>
                    <span className="pos-doc-option-series">{nextBoletaNumber}</span>
                    <span className="pos-doc-option-hint">{t("pos.sunatQr")}</span>
                  </button>
                </div>
              </section>

              <section className="pos-checkout-section">
                <h4 className="pos-checkout-label">{t("pos.paymentMethod")}</h4>
                <div className="pos-payment-grid">
                  <button
                    type="button"
                    className={`pos-payment-btn btn-payment-efectivo ${paymentMethod === "Efectivo" ? "active" : ""}`}
                    onClick={() => setPaymentMethod("Efectivo")}
                  >
                    <CashIcon size={16} /> {t("pos.cash")}
                  </button>
                  <button
                    type="button"
                    className={`pos-payment-btn btn-payment-tarjeta ${paymentMethod === "Tarjeta" ? "active" : ""}`}
                    onClick={() => setPaymentMethod("Tarjeta")}
                  >
                    <CardIcon size={16} /> {t("pos.card")}
                  </button>
                  <button
                    type="button"
                    className={`pos-payment-btn btn-payment-yape ${paymentMethod === "Yape" ? "active" : ""}`}
                    onClick={() => setPaymentMethod("Yape")}
                  >
                    <YapeIcon size={16} /> {t("pos.yape")}
                  </button>
                  <button
                    type="button"
                    className={`pos-payment-btn btn-payment-fiado ${paymentMethod === "Fiado" ? "active" : ""}`}
                    onClick={() => setPaymentMethod("Fiado")}
                  >
                    <UserIcon size={16} /> {t("pos.credit")}
                  </button>
                </div>
              </section>

              {paymentMethod === "Efectivo" && (
                <section className="pos-checkout-section pos-cash-section">
                  <div className="pos-cash-grid">
                    <div className="form-group">
                      <label>{t("pos.cashReceived")}</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="0.00"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t("pos.change")}</label>
                      <div className={`pos-change-display ${change > 0 ? "has-change" : ""}`}>
                        S/ {change.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {paymentMethod === "Fiado" && (
                <section className="pos-checkout-section">
                  <div className="form-group">
                    <SelectField
                      label={t("pos.creditCustomer")}
                      value={selectedCustomerId}
                      options={creditCustomerOptions}
                      onChange={(value) => {
                        setSelectedCustomerId(value);
                        const selected = debts.find((d) => d.id === value);
                        if (selected) {
                          setCustomerDni(selected.customerDni || "");
                          setCustomerName(selected.customerName || "");
                        } else {
                          setCustomerDni("");
                          setCustomerName("");
                        }
                      }}
                      placeholder={t("pos.selectCustomer")}
                      clearable
                      accent="magenta"
                    />
                    <p className="pos-checkout-hint">{t("pos.creditHint")}</p>
                  </div>
                </section>
              )}

              {(documentType === "boleta" || paymentMethod === "Fiado") && (
                <section className="pos-checkout-section pos-customer-section">
                  <h4 className={`pos-checkout-label ${total >= 700 && documentType === "boleta" ? "required" : ""}`}>
                    {t("pos.customerData")}
                    {total >= 700 && documentType === "boleta" ? t("pos.sunatRequired") : ""}
                  </h4>
                  <div className="form-group">
                    <label>{t("pos.dni")}</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder={t("pos.dniPlaceholder")}
                      value={customerDni}
                      onChange={(e) => setCustomerDni(e.target.value)}
                      disabled={paymentMethod === "Fiado" && selectedCustomerId !== ""}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("pos.fullName")}</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder={t("pos.namePlaceholder")}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      disabled={paymentMethod === "Fiado" && selectedCustomerId !== ""}
                    />
                  </div>
                </section>
              )}
            </div>

            <button
              type="button"
              className="btn btn-primary pos-checkout-btn"
              onClick={handleCheckout}
              disabled={isCheckingOut}
            >
              <CheckIcon size={18} />
              {isCheckingOut && documentType === "boleta" && storeConfig.sunat?.enabled
                ? t("pos.sendingSunat")
                : t("pos.registerAndPrint")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
