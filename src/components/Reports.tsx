import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { useI18n } from "../i18n";
import { useMoney } from "../hooks/useMoney";
import type { CustomerDebt } from "./Debts";
import type { SupplierDebt } from "../types/stock";
import type { CashSession } from "../utils/cashSales";
import {
  CartIcon,
  BoxIcon,
  AlertIcon,
  ChartIcon,
  CalendarIcon,
  CashIcon,
  CheckIcon,
  DrawerIcon,
  KeyIcon,
  UserIcon,
} from "./Icons";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Product {
  code: string;
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  expiryDate?: string;
}

interface SaleItem {
  code: string;
  name: string;
  price: number;
  quantity: number;
}

interface Sale {
  id: string;
  timestamp: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
}

interface Lot {
  id: string;
  productCode: string;
  stock: number;
  expiryDate: string;
}

type Period = "hoy" | "7d" | "30d";

interface ReportsProps {
  sales: Sale[];
  products: Product[];
  lots: Lot[];
  debts: CustomerDebt[];
  supplierDebts: SupplierDebt[];
  cashSessions: CashSession[];
  activeSession: CashSession | null;
  onNavigateTab: (
    tab: "pos" | "inventory" | "alerts" | "cash" | "reports" | "debts"
  ) => void;
  theme: "dark" | "light";
}

function filterSalesByPeriod(sales: Sale[], period: Period): Sale[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === "hoy") {
    return sales.filter((s) => new Date(s.timestamp) >= startOfToday);
  }
  if (period === "7d") {
    const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
    return sales.filter((s) => new Date(s.timestamp) >= sevenDaysAgo);
  }
  const thirtyDaysAgo = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);
  return sales.filter((s) => new Date(s.timestamp) >= thirtyDaysAgo);
}

function prevPeriodSales(sales: Sale[], period: Period): Sale[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === "hoy") {
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    return sales.filter(
      (s) =>
        new Date(s.timestamp) >= startOfYesterday && new Date(s.timestamp) < startOfToday
    );
  }
  if (period === "7d") {
    const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(startOfToday.getTime() - 14 * 24 * 60 * 60 * 1000);
    return sales.filter(
      (s) =>
        new Date(s.timestamp) >= fourteenDaysAgo && new Date(s.timestamp) < sevenDaysAgo
    );
  }
  const thirtyDaysAgo = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(startOfToday.getTime() - 60 * 24 * 60 * 60 * 1000);
  return sales.filter(
    (s) =>
      new Date(s.timestamp) >= sixtyDaysAgo && new Date(s.timestamp) < thirtyDaysAgo
  );
}

const CHART_COLORS = [
  "#c2117a",
  "#00d4ff",
  "#eab308",
  "#16a34a",
  "#8b5cf6",
  "#f97316",
  "#ef4444",
  "#0891b2",
];

function ChartEmpty({
  message,
  hint,
  icon,
}: {
  message: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="reports-empty-state">
      <div className="reports-empty-icon" aria-hidden="true">
        {icon}
      </div>
      <strong>{message}</strong>
      <p>{hint}</p>
    </div>
  );
}

export const Reports: React.FC<ReportsProps> = ({
  sales,
  products,
  lots,
  debts,
  supplierDebts,
  cashSessions,
  activeSession,
  onNavigateTab,
  theme,
}) => {
  const { t, locale, localeTag } = useI18n();
  const { formatMoney } = useMoney();
  const [period, setPeriod] = useState<Period>("7d");
  const [geminiKey, setGeminiKey] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const [analysisTime, setAnalysisTime] = useState("");

  const isLight = theme === "light";
  const periodLabel =
    period === "hoy" ? t("reports.periodToday") : period === "7d" ? t("reports.period7d") : t("reports.period30d");

  useEffect(() => {
    const key = localStorage.getItem("nifty_gemini_api_key") || "";
    setGeminiKey(key);
    setInputKey(key);
  }, []);

  const filteredSales = useMemo(() => filterSalesByPeriod(sales, period), [sales, period]);
  const previousSales = useMemo(() => prevPeriodSales(sales, period), [sales, period]);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const revenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
    const prevRevenue = previousSales.reduce((sum, s) => sum + s.total, 0);
    const revenueChange =
      prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;

    const transactions = filteredSales.length;
    const averageTicket = transactions > 0 ? revenue / transactions : 0;

    const getCostOfItems = (items: SaleItem[]) =>
      items.reduce((sum, item) => {
        const prod = products.find((p) => p.code === item.code);
        const cost = prod ? prod.purchasePrice : item.price * 0.6;
        return sum + cost * item.quantity;
      }, 0);

    const costOfGoods = filteredSales.reduce((sum, s) => sum + getCostOfItems(s.items), 0);
    const profit = revenue - costOfGoods;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    const todaySales = sales
      .filter((s) => new Date(s.timestamp) >= startOfToday)
      .reduce((sum, s) => sum + s.total, 0);
    const todayTickets = sales.filter((s) => new Date(s.timestamp) >= startOfToday).length;

    const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
    const criticalStockCount = products.filter((p) => p.stock === 0).length;

    const expiringCount = lots.filter((l) => {
      if (l.stock <= 0) return false;
      const diffDays = Math.ceil(
        (new Date(l.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffDays >= 0 && diffDays <= 45;
    }).length;

    const inventoryValue = products.reduce((sum, p) => sum + p.stock * p.purchasePrice, 0);

    const customerDebtTotal = debts.reduce((s, d) => s + d.totalDebt, 0);
    const customersWithDebt = debts.filter((d) => d.totalDebt > 0).length;
    const supplierDebtTotal = supplierDebts.reduce((s, d) => s + d.totalDebt, 0);
    const suppliersWithDebt = supplierDebts.filter((d) => d.totalDebt > 0).length;
    const creditSalesTotal = filteredSales
      .filter((s) => s.paymentMethod === "Fiado")
      .reduce((s, sale) => s + sale.total, 0);

    const closedSessions = cashSessions.filter((s) => s.endTime && s.difference != null);
    const totalCashDiff = closedSessions.reduce((s, sess) => s + (sess.difference || 0), 0);

    return {
      revenue,
      revenueChange,
      transactions,
      averageTicket,
      profit,
      margin,
      todaySales,
      todayTickets,
      lowStockCount,
      criticalStockCount,
      expiringCount,
      inventoryValue,
      customerDebtTotal,
      customersWithDebt,
      supplierDebtTotal,
      suppliersWithDebt,
      creditSalesTotal,
      totalCashDiff,
      closedSessionsCount: closedSessions.length,
    };
  }, [filteredSales, previousSales, products, lots, debts, supplierDebts, cashSessions, sales]);

  const getLocalSummary = useCallback(
    (s: typeof stats) => {
      const pText =
        period === "hoy"
          ? t("reports.periodToday").toLowerCase()
          : period === "7d"
            ? t("reports.period7d").toLowerCase()
            : t("reports.period30d").toLowerCase();

      if (s.revenue === 0) {
        return locale === "en"
          ? `Zero sales and revenue in ${pText}. Critical inventory: ${s.lowStockCount} low-stock SKUs, ${s.expiringCount} expiring lots. AR: ${formatMoney(s.customerDebtTotal)}, AP: ${formatMoney(s.supplierDebtTotal)}. Restock urgently.`
          : `Cero ventas e ingresos en ${pText}. Inventario crítico: ${s.lowStockCount} SKUs bajos, ${s.expiringCount} lotes por vencer. CxC: ${formatMoney(s.customerDebtTotal)}, CxP: ${formatMoney(s.supplierDebtTotal)}. Reabastecer con urgencia.`;
      }
      return locale === "en"
        ? `Sales ${formatMoney(s.revenue)} in ${pText} (${s.revenueChange >= 0 ? "+" : ""}${s.revenueChange.toFixed(1)}%). Net profit ${formatMoney(s.profit)} (${s.margin.toFixed(1)}% margin). Watch ${s.lowStockCount} low-stock items. AR ${formatMoney(s.customerDebtTotal)} vs AP ${formatMoney(s.supplierDebtTotal)}.`
        : `Ventas ${formatMoney(s.revenue)} en ${pText} (${s.revenueChange >= 0 ? "+" : ""}${s.revenueChange.toFixed(1)}%). Ganancia ${formatMoney(s.profit)} (margen ${s.margin.toFixed(1)}%). Vigilar ${s.lowStockCount} productos bajos. CxC ${formatMoney(s.customerDebtTotal)} vs CxP ${formatMoney(s.supplierDebtTotal)}.`;
    },
    [period, t, locale, formatMoney]
  );

  const generateAiAnalysis = useCallback(
    async (s: typeof stats) => {
      setAiLoading(true);
      setAnalysisTime(
        new Date().toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" })
      );

      if (geminiKey) {
        try {
          const prompt = `Resumen ejecutivo en español (máx 280 caracteres) para tienda POS. Período: ${periodLabel}. Ventas: ${formatMoney(s.revenue)} (${s.revenueChange.toFixed(1)}%). Transacciones: ${s.transactions}. Margen: ${s.margin.toFixed(1)}%. Stock bajo: ${s.lowStockCount}. Por vencer: ${s.expiringCount}. CxC clientes: ${formatMoney(s.customerDebtTotal)}. CxP proveedores: ${formatMoney(s.supplierDebtTotal)}. Sin viñetas.`;

          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          });

          if (!response.ok) throw new Error("Failed");
          const data = await response.json();
          setAiSummary(data.candidates[0].content.parts[0].text.trim());
        } catch {
          setAiSummary(getLocalSummary(s));
        } finally {
          setAiLoading(false);
        }
      } else {
        setAiSummary(getLocalSummary(s));
        setAiLoading(false);
      }
    },
    [geminiKey, periodLabel, formatMoney, getLocalSummary, localeTag]
  );

  useEffect(() => {
    generateAiAnalysis(stats);
  }, [period, geminiKey, sales, products, debts, supplierDebts]);

  const chartTheme = useMemo(
    () => ({
      grid: isLight ? "#f1f5f9" : "rgba(255, 255, 255, 0.03)",
      tick: isLight ? "#6b7280" : "#a4b0be",
      tooltipBg: isLight ? "#ffffff" : "rgba(18, 20, 28, 0.95)",
      tooltipTitle: isLight ? "#111827" : "#f5f6fa",
      tooltipBody: isLight ? "#4b5563" : "#a4b0be",
      tooltipBorder: isLight ? "#e2e8f0" : "rgba(255, 255, 255, 0.05)",
    }),
    [isLight]
  );

  const baseChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
          labels: { color: chartTheme.tick, font: { family: "Inter", size: 11 } },
        },
        tooltip: {
          backgroundColor: chartTheme.tooltipBg,
          titleColor: chartTheme.tooltipTitle,
          bodyColor: chartTheme.tooltipBody,
          borderColor: chartTheme.tooltipBorder,
          borderWidth: 1,
          padding: 10,
        },
      },
      scales: {
        y: {
          grid: { color: chartTheme.grid },
          ticks: { color: chartTheme.tick, font: { size: 10 } },
        },
        x: {
          grid: { display: false },
          ticks: { color: chartTheme.tick, font: { size: 10 } },
        },
      },
    }),
    [chartTheme]
  );

  const lineChartData = useMemo(() => {
    const dates: string[] = [];
    const values: number[] = [];
    const now = new Date();
    const pointsCount = period === "hoy" ? 8 : period === "7d" ? 7 : 10;

    for (let i = pointsCount - 1; i >= 0; i--) {
      const d = new Date();
      if (period === "hoy") {
        d.setHours(now.getHours() - i);
        dates.push(`${d.getHours()}:00`);
      } else if (period === "7d") {
        d.setDate(now.getDate() - i);
        dates.push(d.toLocaleDateString(localeTag, { day: "numeric", month: "short" }));
      } else {
        d.setDate(now.getDate() - i * 3);
        dates.push(d.toLocaleDateString(localeTag, { day: "numeric", month: "short" }));
      }
      values.push(0);
    }

    filteredSales.forEach((s) => {
      const saleDate = new Date(s.timestamp);
      if (period === "hoy") {
        const hourDiff = Math.floor((now.getTime() - saleDate.getTime()) / 3600000);
        if (hourDiff >= 0 && hourDiff < 8) values[7 - hourDiff] += s.total;
      } else if (period === "7d") {
        const dayDiff = Math.floor((now.getTime() - saleDate.getTime()) / (86400000));
        if (dayDiff >= 0 && dayDiff < 7) values[6 - dayDiff] += s.total;
      } else {
        const dayDiff = Math.floor((now.getTime() - saleDate.getTime()) / 86400000);
        if (dayDiff >= 0 && dayDiff < 30) values[9 - Math.floor(dayDiff / 3)] += s.total;
      }
    });

    return {
      labels: dates,
      datasets: [
        {
          label: t("reports.trendTitle"),
          data: values,
          borderColor: "#c2117a",
          backgroundColor: isLight ? "rgba(194, 17, 122, 0.08)" : "rgba(194, 17, 122, 0.12)",
          fill: true,
          tension: 0.4,
          borderWidth: 2.5,
          pointRadius: 4,
        },
      ],
    };
  }, [filteredSales, period, localeTag, isLight, t]);

  const paymentMixData = useMemo(() => {
    const methods = ["Efectivo", "Tarjeta", "Yape", "Fiado"] as const;
    const totals = methods.map((m) =>
      filteredSales.filter((s) => s.paymentMethod === m).reduce((sum, s) => sum + s.total, 0)
    );
    return {
      labels: [...methods],
      datasets: [
        {
          data: totals,
          backgroundColor: CHART_COLORS.slice(0, 4),
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    };
  }, [filteredSales]);

  const topProductsData = useMemo(() => {
    const map = new Map<string, number>();
    filteredSales.forEach((s) =>
      s.items.forEach((item) => {
        map.set(item.name, (map.get(item.name) || 0) + item.price * item.quantity);
      })
    );
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return {
      labels: sorted.map(([n]) => (n.length > 22 ? `${n.slice(0, 22)}…` : n)),
      datasets: [
        {
          data: sorted.map(([, v]) => v),
          backgroundColor: CHART_COLORS[0],
          borderRadius: 6,
        },
      ],
    };
  }, [filteredSales]);

  const categorySalesData = useMemo(() => {
    const map = new Map<string, number>();
    filteredSales.forEach((s) =>
      s.items.forEach((item) => {
        const prod = products.find((p) => p.code === item.code);
        const cat = prod?.category || "—";
        map.set(cat, (map.get(cat) || 0) + item.price * item.quantity);
      })
    );
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return {
      labels: sorted.map(([c]) => c),
      datasets: [
        {
          data: sorted.map(([, v]) => v),
          backgroundColor: CHART_COLORS,
          borderRadius: 6,
        },
      ],
    };
  }, [filteredSales, products]);

  const customerDebtsData = useMemo(() => {
    const sorted = [...debts]
      .filter((d) => d.totalDebt > 0)
      .sort((a, b) => b.totalDebt - a.totalDebt)
      .slice(0, 8);
    return {
      labels: sorted.map((d) =>
        d.customerName.length > 18 ? `${d.customerName.slice(0, 18)}…` : d.customerName
      ),
      datasets: [
        {
          data: sorted.map((d) => d.totalDebt),
          backgroundColor: "#f97316",
          borderRadius: 6,
        },
      ],
    };
  }, [debts]);

  const supplierDebtsData = useMemo(() => {
    const sorted = [...supplierDebts]
      .filter((d) => d.totalDebt > 0)
      .sort((a, b) => b.totalDebt - a.totalDebt)
      .slice(0, 8);
    return {
      labels: sorted.map((d) =>
        d.supplierName.length > 18 ? `${d.supplierName.slice(0, 18)}…` : d.supplierName
      ),
      datasets: [
        {
          data: sorted.map((d) => d.totalDebt),
          backgroundColor: "#ef4444",
          borderRadius: 6,
        },
      ],
    };
  }, [supplierDebts]);

  const inventoryByCategoryData = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      const val = p.stock * p.purchasePrice;
      if (val <= 0) return;
      map.set(p.category, (map.get(p.category) || 0) + val);
    });
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return {
      labels: sorted.map(([c]) => c),
      datasets: [
        {
          data: sorted.map(([, v]) => v),
          backgroundColor: CHART_COLORS,
          borderWidth: 0,
        },
      ],
    };
  }, [products]);

  const cashVarianceData = useMemo(() => {
    const closed = cashSessions
      .filter((s) => s.endTime && s.difference != null)
      .sort((a, b) => new Date(a.endTime!).getTime() - new Date(b.endTime!).getTime())
      .slice(-8);

    return {
      labels: closed.map((s) =>
        new Date(s.endTime!).toLocaleDateString(localeTag, { day: "numeric", month: "short" })
      ),
      datasets: [
        {
          label: t("reports.cashSessions"),
          data: closed.map((s) => s.difference ?? 0),
          backgroundColor: closed.map((s) =>
            (s.difference ?? 0) >= 0 ? "rgba(34, 197, 94, 0.75)" : "rgba(239, 68, 68, 0.75)"
          ),
          borderRadius: 6,
        },
      ],
    };
  }, [cashSessions, localeTag, t]);

  const creditTrendData = useMemo(() => {
    const dates: string[] = [];
    const values: number[] = [];
    const now = new Date();
    const points = period === "hoy" ? 8 : period === "7d" ? 7 : 10;

    for (let i = points - 1; i >= 0; i--) {
      const d = new Date();
      if (period === "hoy") {
        d.setHours(now.getHours() - i);
        dates.push(`${d.getHours()}:00`);
      } else if (period === "7d") {
        d.setDate(now.getDate() - i);
        dates.push(d.toLocaleDateString(localeTag, { day: "numeric", month: "short" }));
      } else {
        d.setDate(now.getDate() - i * 3);
        dates.push(d.toLocaleDateString(localeTag, { day: "numeric", month: "short" }));
      }
      values.push(0);
    }

    filteredSales
      .filter((s) => s.paymentMethod === "Fiado")
      .forEach((s) => {
        const saleDate = new Date(s.timestamp);
        if (period === "hoy") {
          const hourDiff = Math.floor((now.getTime() - saleDate.getTime()) / 3600000);
          if (hourDiff >= 0 && hourDiff < 8) values[7 - hourDiff] += s.total;
        } else if (period === "7d") {
          const dayDiff = Math.floor((now.getTime() - saleDate.getTime()) / 86400000);
          if (dayDiff >= 0 && dayDiff < 7) values[6 - dayDiff] += s.total;
        } else {
          const dayDiff = Math.floor((now.getTime() - saleDate.getTime()) / 86400000);
          if (dayDiff >= 0 && dayDiff < 30) values[9 - Math.floor(dayDiff / 3)] += s.total;
        }
      });

    return {
      labels: dates,
      datasets: [
        {
          label: t("reports.creditSales"),
          data: values,
          borderColor: "#f97316",
          backgroundColor: "rgba(249, 115, 22, 0.15)",
          fill: true,
          tension: 0.35,
        },
      ],
    };
  }, [filteredSales, period, localeTag, t]);

  const doughnutOptions = useMemo(
    () => ({
      ...baseChartOptions,
      scales: undefined,
      plugins: {
        ...baseChartOptions.plugins,
        legend: {
          display: true,
          position: "bottom" as const,
          labels: { color: chartTheme.tick, boxWidth: 12, padding: 14, font: { size: 11 } },
        },
      },
    }),
    [baseChartOptions, chartTheme]
  );

  const horizontalBarOptions = useMemo(
    () => ({
      ...baseChartOptions,
      indexAxis: "y" as const,
      scales: {
        x: {
          grid: { color: chartTheme.grid },
          ticks: { color: chartTheme.tick, font: { size: 10 } },
        },
        y: {
          grid: { display: false },
          ticks: { color: chartTheme.tick, font: { size: 10 } },
        },
      },
    }),
    [baseChartOptions, chartTheme]
  );

  const saveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("nifty_gemini_api_key", inputKey.trim());
    setGeminiKey(inputKey.trim());
    setShowKeyInput(false);
  };

  const hasPaymentData = paymentMixData.datasets[0].data.some((v) => v > 0);
  const netDebtPosition = stats.customerDebtTotal - stats.supplierDebtTotal;

  return (
    <div className="reports-page">
      <section className="reports-hero card-glass">
        <div className="reports-hero-glow" aria-hidden="true" />
        <div className="reports-hero-main">
          <div className="reports-hero-title-block">
            <div className="reports-hero-icon" aria-hidden="true">
              <ChartIcon size={26} />
            </div>
            <div>
              <p className="reports-hero-eyebrow">{t("reports.heroEyebrow")}</p>
              <h1 className="reports-hero-title">{t("headers.reports")}</h1>
              <p className="reports-hero-desc">{t("reports.heroDesc")}</p>
            </div>
          </div>
          <div className="reports-hero-controls">
            <span className={`reports-cash-badge${activeSession ? " is-open" : " is-closed"}`}>
              {activeSession ? t("reports.cashOpen") : t("reports.cashClosed")}
            </span>
            <div className="reports-period-toggle" role="tablist" aria-label={t("reports.liveView", { period: periodLabel })}>
              {(["hoy", "7d", "30d"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={period === p}
                  className={`reports-period-btn${period === p ? " is-active" : ""}`}
                  onClick={() => setPeriod(p)}
                >
                  {p === "hoy" ? t("reports.periodToday") : p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="reports-hero-stats" role="list" aria-label={t("reports.liveTitle")}>
          <div className="reports-hero-stat reports-hero-stat--revenue" role="listitem">
            <div className="reports-hero-stat-head">
              <span className="reports-hero-stat-icon">
                <CashIcon size={13} />
              </span>
              <span className="reports-hero-stat-label">{t("reports.totalSales")}</span>
            </div>
            <strong className="reports-hero-stat-value">{formatMoney(stats.revenue)}</strong>
            <span className={`reports-hero-stat-meta${stats.revenueChange >= 0 ? " is-up" : " is-down"}`}>
              {stats.revenueChange >= 0 ? "▲" : "▼"}{" "}
              {t("reports.vsPrev", { change: Math.abs(stats.revenueChange).toFixed(1) })}
            </span>
          </div>
          <div className="reports-hero-stat reports-hero-stat--tx" role="listitem">
            <div className="reports-hero-stat-head">
              <span className="reports-hero-stat-icon">
                <CartIcon size={13} />
              </span>
              <span className="reports-hero-stat-label">{t("reports.transactions")}</span>
            </div>
            <strong className="reports-hero-stat-value">
              {stats.transactions.toLocaleString(localeTag)}
            </strong>
            <span className="reports-hero-stat-meta">
              {t("reports.avgTicket", { amount: formatMoney(stats.averageTicket) })}
            </span>
          </div>
          <div className="reports-hero-stat reports-hero-stat--profit" role="listitem">
            <div className="reports-hero-stat-head">
              <span className="reports-hero-stat-icon">
                <CheckIcon size={13} />
              </span>
              <span className="reports-hero-stat-label">{t("reports.netProfit")}</span>
            </div>
            <strong className="reports-hero-stat-value">{formatMoney(stats.profit)}</strong>
            <span className="reports-hero-stat-meta">
              {t("reports.margin", { pct: stats.margin.toFixed(1) })}
            </span>
          </div>
          <div
            className={`reports-hero-stat reports-hero-stat--stock${stats.lowStockCount > 0 ? " is-alert" : ""}`}
            role="listitem"
          >
            <div className="reports-hero-stat-head">
              <span className="reports-hero-stat-icon">
                <BoxIcon size={13} />
              </span>
              <span className="reports-hero-stat-label">{t("reports.criticalStock")}</span>
            </div>
            <strong className="reports-hero-stat-value">
              {stats.lowStockCount.toLocaleString(localeTag)}
            </strong>
            <span className="reports-hero-stat-meta">
              {t("reports.skusOut", { count: stats.criticalStockCount })}
            </span>
          </div>
        </div>
      </section>

      <section className="reports-ai-card">
        <div className="reports-ai-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            <circle cx="12" cy="12" r="4" fill="currentColor" />
          </svg>
        </div>
        <div className="reports-ai-body">
          <div className="reports-ai-head">
            <div className="reports-ai-title-row">
              <h2 className="reports-ai-title">{t("reports.aiTitle")}</h2>
              <span className={`reports-ai-pill${geminiKey ? " is-live" : ""}`}>
                {geminiKey ? t("reports.aiLive") : t("reports.aiLocal")}
              </span>
              <button type="button" className="reports-ai-key-btn" onClick={() => setShowKeyInput(true)}>
                {t("reports.aiKey")}
              </button>
            </div>
            {aiLoading ? (
              <p className="reports-ai-loading">{t("reports.aiLoading")}</p>
            ) : (
              <p className="reports-ai-text">{aiSummary}</p>
            )}
            <p className="reports-ai-meta">
              {t("reports.aiMeta")}
              {analysisTime ? ` · ${analysisTime}` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="reports-ai-refresh"
          onClick={() => generateAiAnalysis(stats)}
          disabled={aiLoading}
        >
          {t("reports.aiRefresh")}
        </button>
      </section>

      {showKeyInput && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{t("reports.modalTitle")}</h3>
              <button type="button" className="modal-close" onClick={() => setShowKeyInput(false)}>×</button>
            </div>
            <form onSubmit={saveApiKey}>
              <p className="reports-modal-hint">{t("reports.modalDesc")}</p>
              <div className="form-group">
                <label>{t("reports.apiKeyLabel")}</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder={t("reports.apiKeyPlaceholder")}
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="reports-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowKeyInput(false)}>
                  {t("reports.cancel")}
                </button>
                <button type="submit" className="btn btn-primary">
                  {t("reports.saveActivate")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section className="reports-snapshot card-glass">
        <header className="reports-snapshot-head">
          <div>
            <p className="reports-snapshot-eyebrow">{t("reports.snapshotTitle")}</p>
            <h2>{t("reports.liveView", { period: periodLabel })}</h2>
            <p>{t("reports.snapshotDesc")}</p>
          </div>
          <span className="reports-live-dot" aria-hidden="true" title={t("reports.liveTitle")} />
        </header>

        <div className="reports-metrics-grid reports-metrics-grid--extended">
          <article className="reports-metric reports-metric--compact">
            <div className="reports-metric-top">
              <span className="reports-metric-label">{t("reports.salesToday")}</span>
              <span className="reports-metric-icon"><ChartIcon size={14} /></span>
            </div>
            <p className="reports-metric-value reports-metric-value--sm">{formatMoney(stats.todaySales)}</p>
            <p className="reports-metric-foot">
              {t("reports.salesTodayCount", { count: stats.todayTickets })}
            </p>
          </article>
          <article className={`reports-metric reports-metric--compact${stats.expiringCount > 0 ? " reports-metric--warning" : ""}`}>
            <div className="reports-metric-top">
              <span className="reports-metric-label">{t("reports.expiring")}</span>
              <span className="reports-metric-icon reports-metric-icon--warning"><CalendarIcon size={14} /></span>
            </div>
            <p className="reports-metric-value reports-metric-value--sm">{stats.expiringCount}</p>
            <p className="reports-metric-foot">{t("reports.expiringMeta")}</p>
          </article>
          <article className="reports-metric reports-metric--compact reports-metric--success">
            <div className="reports-metric-top">
              <span className="reports-metric-label">{t("reports.netProfit")}</span>
              <span className="reports-metric-icon reports-metric-icon--success"><CheckIcon size={14} /></span>
            </div>
            <p className="reports-metric-value reports-metric-value--sm">{formatMoney(stats.profit)}</p>
            <p className="reports-metric-foot">{t("reports.margin", { pct: stats.margin.toFixed(1) })}</p>
          </article>
          <article className="reports-metric reports-metric--compact">
            <div className="reports-metric-top">
              <span className="reports-metric-label">{t("reports.expectedCash")}</span>
              <span className="reports-metric-icon"><DrawerIcon size={14} /></span>
            </div>
            <p className="reports-metric-value reports-metric-value--sm">
              {formatMoney(activeSession ? activeSession.expectedCash : 0)}
            </p>
            <p className="reports-metric-foot">
              {activeSession ? t("reports.sessionOpen") : t("reports.noSession")}
            </p>
          </article>
          <article className="reports-metric reports-metric--compact">
            <div className="reports-metric-top">
              <span className="reports-metric-label">{t("reports.inventoryValue")}</span>
              <span className="reports-metric-icon"><BoxIcon size={14} /></span>
            </div>
            <p className="reports-metric-value reports-metric-value--sm">{formatMoney(stats.inventoryValue)}</p>
            <p className="reports-metric-foot">
              {t("reports.productCount", { count: products.length })}
            </p>
          </article>
          <article className={`reports-metric reports-metric--compact${stats.customerDebtTotal > 0 ? " reports-metric--warning" : ""}`}>
            <div className="reports-metric-top">
              <span className="reports-metric-label">{t("reports.customerDebt")}</span>
              <span className="reports-metric-icon reports-metric-icon--warning"><UserIcon size={14} /></span>
            </div>
            <p className="reports-metric-value reports-metric-value--sm">{formatMoney(stats.customerDebtTotal)}</p>
            <p className="reports-metric-foot">
              {t("reports.customerDebtMeta", { count: stats.customersWithDebt })}
            </p>
          </article>
          <article className={`reports-metric reports-metric--compact${stats.supplierDebtTotal > 0 ? " reports-metric--danger" : ""}`}>
            <div className="reports-metric-top">
              <span className="reports-metric-label">{t("reports.supplierDebt")}</span>
              <span className="reports-metric-icon reports-metric-icon--danger"><CashIcon size={14} /></span>
            </div>
            <p className="reports-metric-value reports-metric-value--sm">{formatMoney(stats.supplierDebtTotal)}</p>
            <p className="reports-metric-foot">
              {t("reports.supplierDebtMeta", { count: stats.suppliersWithDebt })}
            </p>
          </article>
        </div>
      </section>

      <div className="reports-bottom-grid">
        <section className="reports-chart-card card-glass">
          <header className="reports-section-head">
            <div className="reports-section-title">
              <span className="reports-section-icon"><ChartIcon size={18} /></span>
              <div>
                <h3>{t("reports.trendTitle")}</h3>
                <p className="reports-section-desc">{periodLabel}</p>
              </div>
            </div>
            <span className="reports-section-chip">{periodLabel}</span>
          </header>
          <div className="reports-chart-canvas">
            <Line data={lineChartData} options={baseChartOptions} />
          </div>
        </section>

        <section className="reports-actions-card card-glass">
          <header className="reports-section-head">
            <div className="reports-section-title">
              <span className="reports-section-icon"><KeyIcon size={18} /></span>
              <div>
                <h3>{t("reports.actionsTitle")}</h3>
                <p className="reports-section-desc">{t("reports.snapshotDesc")}</p>
              </div>
            </div>
          </header>
          <div className="reports-actions-list">
            <button type="button" className="reports-action reports-action--brand" onClick={() => onNavigateTab("pos")}>
              <span className="reports-action-icon"><CartIcon size={16} /></span>
              <span className="reports-action-copy">
                <strong>{t("reports.actionPos")}</strong>
                <small>{t("reports.actionPosDesc")}</small>
              </span>
              <span className="reports-action-arrow">→</span>
            </button>
            <button type="button" className="reports-action reports-action--success" onClick={() => onNavigateTab("inventory")}>
              <span className="reports-action-icon"><BoxIcon size={16} /></span>
              <span className="reports-action-copy">
                <strong>{t("reports.actionStock")}</strong>
                <small>{t("reports.actionStockDesc")}</small>
              </span>
              <span className="reports-action-arrow">→</span>
            </button>
            <button type="button" className="reports-action reports-action--info" onClick={() => onNavigateTab("cash")}>
              <span className="reports-action-icon"><DrawerIcon size={16} /></span>
              <span className="reports-action-copy">
                <strong>{t("reports.actionCash")}</strong>
                <small>{t("reports.actionCashDesc")}</small>
              </span>
              <span className="reports-action-arrow">→</span>
            </button>
            <button type="button" className="reports-action reports-action--danger" onClick={() => onNavigateTab("alerts")}>
              <span className="reports-action-icon"><AlertIcon size={16} /></span>
              <span className="reports-action-copy">
                <strong>{t("reports.actionAlerts")}</strong>
                <small>{t("reports.actionAlertsDesc", { count: stats.lowStockCount })}</small>
              </span>
              <span className="reports-action-arrow">→</span>
            </button>
            <button type="button" className="reports-action reports-action--warning" onClick={() => onNavigateTab("debts")}>
              <span className="reports-action-icon"><UserIcon size={16} /></span>
              <span className="reports-action-copy">
                <strong>{t("reports.actionDebts")}</strong>
                <small>{t("reports.actionDebtsDesc")}</small>
              </span>
              <span className="reports-action-arrow">→</span>
            </button>
          </div>
        </section>
      </div>

      <section className="reports-debt-overview card-glass">
        <header className="reports-section-head">
          <div className="reports-section-title">
            <span className="reports-section-icon"><CashIcon size={18} /></span>
            <div>
              <h3>{t("reports.debtOverview")}</h3>
              <p className="reports-section-desc">{t("reports.debtOverviewDesc")}</p>
            </div>
          </div>
        </header>
        <div className="reports-debt-kpis">
          <article className="reports-debt-kpi reports-debt-kpi--ar">
            <div className="reports-debt-kpi-head">
              <span className="reports-debt-kpi-icon"><UserIcon size={14} /></span>
              <span>{t("reports.arTotal")}</span>
            </div>
            <strong>{formatMoney(stats.customerDebtTotal)}</strong>
            <em>{stats.customersWithDebt} {locale === "en" ? "customers" : "clientes"}</em>
          </article>
          <article className="reports-debt-kpi reports-debt-kpi--ap">
            <div className="reports-debt-kpi-head">
              <span className="reports-debt-kpi-icon"><CashIcon size={14} /></span>
              <span>{t("reports.apTotal")}</span>
            </div>
            <strong>{formatMoney(stats.supplierDebtTotal)}</strong>
            <em>{stats.suppliersWithDebt} {locale === "en" ? "suppliers" : "proveedores"}</em>
          </article>
          <article className={`reports-debt-kpi reports-debt-kpi--net${netDebtPosition >= 0 ? " is-positive" : " is-negative"}`}>
            <div className="reports-debt-kpi-head">
              <span className="reports-debt-kpi-icon"><ChartIcon size={14} /></span>
              <span>{t("reports.netPosition")}</span>
            </div>
            <strong>{formatMoney(netDebtPosition)}</strong>
            <em>{t("reports.creditSales")}: {formatMoney(stats.creditSalesTotal)}</em>
          </article>
          <article className={`reports-debt-kpi reports-debt-kpi--cash${stats.totalCashDiff >= 0 ? " is-positive" : " is-negative"}`}>
            <div className="reports-debt-kpi-head">
              <span className="reports-debt-kpi-icon"><DrawerIcon size={14} /></span>
              <span>{t("reports.cashSessions")}</span>
            </div>
            <strong>{formatMoney(stats.totalCashDiff)}</strong>
            <em>
              {stats.closedSessionsCount}{" "}
              {locale === "en" ? "closed shifts" : "turnos cerrados"}
            </em>
          </article>
        </div>
      </section>

      <div className="reports-analytics-grid">
        <section className="reports-chart-card reports-chart-card--analytics reports-chart-card--third card-glass">
          <header className="reports-section-head">
            <div className="reports-section-title">
              <span className="reports-section-icon"><ChartIcon size={16} /></span>
              <div>
                <h3>{t("reports.paymentMix")}</h3>
                <p className="reports-section-desc">{t("reports.paymentMixDesc")}</p>
              </div>
            </div>
          </header>
          <div className="reports-chart-canvas reports-chart-canvas--doughnut">
            {hasPaymentData ? (
              <Doughnut data={paymentMixData} options={doughnutOptions} />
            ) : (
              <ChartEmpty
                message={t("reports.noData")}
                hint={t("reports.noDataHint")}
                icon={<ChartIcon size={22} />}
              />
            )}
          </div>
        </section>

        <section className="reports-chart-card reports-chart-card--analytics reports-chart-card--third card-glass">
          <header className="reports-section-head">
            <div className="reports-section-title">
              <span className="reports-section-icon"><BoxIcon size={16} /></span>
              <div>
                <h3>{t("reports.inventoryCategories")}</h3>
                <p className="reports-section-desc">{t("reports.inventoryCategoriesDesc")}</p>
              </div>
            </div>
          </header>
          <div className="reports-chart-canvas reports-chart-canvas--doughnut">
            {inventoryByCategoryData.datasets[0].data.length > 0 ? (
              <Doughnut data={inventoryByCategoryData} options={doughnutOptions} />
            ) : (
              <ChartEmpty
                message={t("reports.noData")}
                hint={t("reports.noDataHint")}
                icon={<BoxIcon size={22} />}
              />
            )}
          </div>
        </section>

        <section className="reports-chart-card reports-chart-card--analytics reports-chart-card--third card-glass">
          <header className="reports-section-head">
            <div className="reports-section-title">
              <span className="reports-section-icon"><ChartIcon size={16} /></span>
              <div>
                <h3>{t("reports.categorySales")}</h3>
                <p className="reports-section-desc">{t("reports.categorySalesDesc")}</p>
              </div>
            </div>
          </header>
          <div className="reports-chart-canvas reports-chart-canvas--bar">
            {categorySalesData.datasets[0].data.length > 0 ? (
              <Bar data={categorySalesData} options={baseChartOptions} />
            ) : (
              <ChartEmpty
                message={t("reports.noData")}
                hint={t("reports.noDataHint")}
                icon={<ChartIcon size={22} />}
              />
            )}
          </div>
        </section>

        <section className="reports-chart-card reports-chart-card--analytics reports-chart-card--wide card-glass">
          <header className="reports-section-head">
            <div className="reports-section-title">
              <span className="reports-section-icon"><CartIcon size={16} /></span>
              <div>
                <h3>{t("reports.topProducts")}</h3>
                <p className="reports-section-desc">{t("reports.topProductsDesc")}</p>
              </div>
            </div>
          </header>
          <div className="reports-chart-canvas reports-chart-canvas--bar">
            {topProductsData.datasets[0].data.length > 0 ? (
              <Bar data={topProductsData} options={horizontalBarOptions} />
            ) : (
              <ChartEmpty
                message={t("reports.noData")}
                hint={t("reports.noDataHint")}
                icon={<CartIcon size={22} />}
              />
            )}
          </div>
        </section>

        <section className="reports-chart-card reports-chart-card--analytics reports-chart-card--half card-glass">
          <header className="reports-section-head">
            <div className="reports-section-title">
              <span className="reports-section-icon"><UserIcon size={16} /></span>
              <div>
                <h3>{t("reports.customerDebtsChart")}</h3>
                <p className="reports-section-desc">{t("reports.customerDebtsDesc")}</p>
              </div>
            </div>
          </header>
          <div className="reports-chart-canvas reports-chart-canvas--bar">
            {customerDebtsData.datasets[0].data.length > 0 ? (
              <Bar data={customerDebtsData} options={horizontalBarOptions} />
            ) : (
              <ChartEmpty
                message={t("reports.noData")}
                hint={t("reports.noDataHint")}
                icon={<UserIcon size={22} />}
              />
            )}
          </div>
        </section>

        <section className="reports-chart-card reports-chart-card--analytics reports-chart-card--half card-glass">
          <header className="reports-section-head">
            <div className="reports-section-title">
              <span className="reports-section-icon"><CashIcon size={16} /></span>
              <div>
                <h3>{t("reports.supplierDebtsChart")}</h3>
                <p className="reports-section-desc">{t("reports.supplierDebtsDesc")}</p>
              </div>
            </div>
          </header>
          <div className="reports-chart-canvas reports-chart-canvas--bar">
            {supplierDebtsData.datasets[0].data.length > 0 ? (
              <Bar data={supplierDebtsData} options={horizontalBarOptions} />
            ) : (
              <ChartEmpty
                message={t("reports.noData")}
                hint={t("reports.noDataHint")}
                icon={<CashIcon size={22} />}
              />
            )}
          </div>
        </section>

        <section className="reports-chart-card reports-chart-card--analytics reports-chart-card--credit card-glass">
          <header className="reports-section-head">
            <div className="reports-section-title">
              <span className="reports-section-icon"><DrawerIcon size={16} /></span>
              <div>
                <h3>{t("reports.creditSales")}</h3>
                <p className="reports-section-desc">{t("reports.creditSalesDesc")}</p>
              </div>
            </div>
          </header>
          <div className="reports-chart-canvas">
            {stats.creditSalesTotal > 0 ? (
              <Line data={creditTrendData} options={baseChartOptions} />
            ) : (
              <ChartEmpty
                message={t("reports.noData")}
                hint={t("reports.noDataHint")}
                icon={<DrawerIcon size={22} />}
              />
            )}
          </div>
        </section>

        <section className="reports-chart-card reports-chart-card--analytics reports-chart-card--cash card-glass">
          <header className="reports-section-head">
            <div className="reports-section-title">
              <span className="reports-section-icon"><DrawerIcon size={16} /></span>
              <div>
                <h3>{t("reports.cashSessions")}</h3>
                <p className="reports-section-desc">{t("reports.cashSessionsDesc")}</p>
              </div>
            </div>
          </header>
          <div className="reports-chart-canvas reports-chart-canvas--bar">
            {cashVarianceData.datasets[0].data.length > 0 ? (
              <Bar data={cashVarianceData} options={baseChartOptions} />
            ) : (
              <ChartEmpty
                message={t("reports.noData")}
                hint={t("reports.noDataHint")}
                icon={<DrawerIcon size={22} />}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
};