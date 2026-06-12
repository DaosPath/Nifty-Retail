import React, { createContext, useContext, useMemo } from "react";
import {
  formatCurrency,
  getCurrencyMeta,
  getCurrencySymbol,
  normalizeCurrency,
  type CurrencyCode,
} from "../utils/currency";

export interface MoneyContextValue {
  currency: CurrencyCode;
  symbol: string;
  formatMoney: (amount: number) => string;
}

const MoneyContext = createContext<MoneyContextValue | null>(null);

export function MoneyProvider({
  currency,
  localeTag,
  children,
}: {
  currency?: string | null;
  localeTag: string;
  children: React.ReactNode;
}) {
  const value = useMemo<MoneyContextValue>(() => {
    const code = normalizeCurrency(currency);
    const meta = getCurrencyMeta(code);
    return {
      currency: code,
      symbol: getCurrencySymbol(code),
      formatMoney: (amount: number) => formatCurrency(amount, code, localeTag || meta.localeTag),
    };
  }, [currency, localeTag]);

  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>;
}

export function useMoney(): MoneyContextValue {
  const ctx = useContext(MoneyContext);
  if (!ctx) {
    throw new Error("useMoney must be used within MoneyProvider");
  }
  return ctx;
}