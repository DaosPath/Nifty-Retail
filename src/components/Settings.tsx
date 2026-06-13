import React, { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppLocale } from "../i18n";
import { useI18n } from "../i18n";
import type { DbHealth } from "../utils/dbPersistence";
import type { StoreConfig } from "../types/store";
import type { Warehouse } from "../types/catalog";
import { getLocalizedWarehouseName } from "../utils/catalogHelpers";
import type { SunatConfig } from "../types/sunat";
import {
  allowsTaxJurisdiction,
  isTaxInclusiveLocked,
  normalizeTaxConfig,
  type TaxConfig,
} from "../utils/tax";
import {
  getTaxConfigFromPreset,
  getTaxPreset,
  TAX_PRESET_GROUPS,
  type TaxPresetId,
} from "../utils/taxPresets";
import {
  CURRENCY_CATALOG,
  formatCurrency,
  normalizeCurrency,
  type CurrencyCode,
} from "../utils/currency";
import { testSunatConnection } from "../utils/sunat/emitBoleta";
import { SelectField, type SelectOption } from "./SelectField";
import {
  SettingsIcon,
  PrinterIcon,
  FolderIcon,
  KeyIcon,
  TicketIcon,
  LockIcon,
  BoxIcon,
  HistoryIcon,
} from "./Icons";

interface SettingsProps {
  storeConfig: StoreConfig;
  warehouses: Warehouse[];
  onUpdateStoreConfig: (config: StoreConfig) => void | Promise<void>;
  theme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void | Promise<void>;
  language: AppLocale;
  onLanguageChange: (language: AppLocale) => void | Promise<void>;
  onCurrencyChange: (currency: CurrencyCode) => void | Promise<void>;
  productsCount: number;
  salesCount: number;
  onExportFullBackup: () => void;
  onImportFullBackup: (file: File) => Promise<boolean>;
  onClearSalesHistory: () => Promise<boolean>;
  onClearDebts: () => Promise<boolean>;
  onClearAllProducts: () => Promise<boolean>;
  onResetAllData: () => Promise<boolean>;
}

type StatusTone = "success" | "error" | "warning" | "info";

function statusTone(message: string): StatusTone {
  if (message.includes("✅")) return "success";
  if (message.includes("❌")) return "error";
  if (message.includes("⚠️")) return "warning";
  return "info";
}

export const Settings: React.FC<SettingsProps> = ({
  storeConfig,
  warehouses,
  onUpdateStoreConfig,
  theme,
  onThemeChange,
  language,
  onLanguageChange,
  onCurrencyChange,
  productsCount,
  salesCount,
  onExportFullBackup,
  onImportFullBackup,
  onClearSalesHistory,
  onClearDebts,
  onClearAllProducts,
  onResetAllData,
}) => {
  const { t, localeTag } = useI18n();
  const activeCurrency = normalizeCurrency(storeConfig.currency, language);
  const [localConfig, setLocalConfig] = useState<StoreConfig>(storeConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [sunatTestStatus, setSunatTestStatus] = useState<string | null>(null);
  const [isTestingSunat, setIsTestingSunat] = useState(false);
  const [dbHealth, setDbHealth] = useState<DbHealth | null>(null);

  const defaultSunat = (): SunatConfig => ({
    enabled: false,
    environment: "beta",
    solUsuario: "",
    solClave: "",
    certPath: "",
    certPassword: "",
  });

  useEffect(() => {
    setLocalConfig({
      ...storeConfig,
      tax: normalizeTaxConfig(storeConfig.tax, language),
      sunat:
        storeConfig.sunat && typeof storeConfig.sunat === "object"
          ? storeConfig.sunat
          : defaultSunat(),
    });
  }, [storeConfig, language]);

  useEffect(() => {
    invoke<DbHealth>("get_db_health")
      .then(setDbHealth)
      .catch(() => setDbHealth(null));
  }, []);

  const sunatConfig = localConfig.sunat || defaultSunat();

  const handleSunatChange = <K extends keyof SunatConfig>(field: K, value: SunatConfig[K]) => {
    setLocalConfig((prev) => ({
      ...prev,
      sunat: {
        ...(prev.sunat || defaultSunat()),
        [field]: value,
      },
    }));
  };

  const handleConfigChange = (field: keyof StoreConfig, value: string | number) => {
    setLocalConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const shortcuts = useMemo(
    () => [
      { action: t("settings.shortcutSearch"), keys: t("settings.shortcutKeysSearch") },
      { action: t("settings.shortcutAdd"), keys: t("settings.shortcutKeysAdd") },
      { action: t("settings.shortcutCheckout"), keys: t("settings.shortcutKeysCheckout") },
      { action: t("settings.shortcutTabs"), keys: t("settings.shortcutKeysTabs") },
      { action: t("settings.shortcutPrint"), keys: t("settings.shortcutKeysPrint") },
    ],
    [t]
  );

  const salesWarehouseOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: t("common.defaultWarehouse") },
      ...warehouses
        .filter((w) => w.active)
        .map((w) => ({
          value: w.id,
          label: getLocalizedWarehouseName(w, t),
          hint: w.isDefault ? t("common.defaultWarehouseTag").trim() : undefined,
        })),
    ],
    [warehouses, t]
  );

  const sunatEnvironmentOptions = useMemo<SelectOption[]>(
    () => [
      { value: "beta", label: t("settings.envBeta") },
      { value: "production", label: t("settings.envProduction") },
    ],
    [t]
  );

  const paperWidthOptions = useMemo<SelectOption[]>(
    () => [
      { value: "58mm", label: t("settings.paper58") },
      { value: "76mm", label: t("settings.paper76") },
      { value: "80mm", label: t("settings.paper80") },
    ],
    [t]
  );

  const handleSaveStoreInfo = async () => {
    setIsSaving(true);
    try {
      await onUpdateStoreConfig(localConfig);
      setImportStatus(`✅ ${t("settings.storeSaved")}`);
      setTimeout(() => setImportStatus(null), 2500);
    } catch {
      setImportStatus(`❌ ${t("settings.storeSaveError")}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportBackup = () => {
    const backup = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      storeConfig: localConfig,
      note: t("settings.exportNote"),
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `niftypos-config-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setImportStatus(`✅ ${t("settings.configExported")}`);
    setTimeout(() => setImportStatus(null), 3000);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const content = ev.target?.result as string;
        const parsed = JSON.parse(content);

        if (parsed.storeConfig) {
          const importedConfig: StoreConfig = {
            ...localConfig,
            ...parsed.storeConfig,
            lastTicketNumber: localConfig.lastTicketNumber,
            lastBoletaNumber: localConfig.lastBoletaNumber,
          };

          setLocalConfig(importedConfig);
          await onUpdateStoreConfig(importedConfig);
          setImportStatus(`✅ ${t("settings.configImported")}`);
        } else {
          setImportStatus(`⚠️ ${t("settings.configInvalid")}`);
        }
      } catch {
        setImportStatus(`❌ ${t("settings.configReadError")}`);
      }
      e.target.value = "";
      setTimeout(() => setImportStatus(null), 3500);
    };
    reader.readAsText(file);
  };

  const taxConfig: TaxConfig = normalizeTaxConfig(localConfig.tax, language);

  const handleTaxChange = <K extends keyof TaxConfig>(field: K, value: TaxConfig[K]) => {
    setLocalConfig((prev) => ({
      ...prev,
      tax: {
        ...(prev.tax || taxConfig),
        [field]: value,
      },
    }));
  };

  const handleTaxPresetApply = (presetId: TaxPresetId) => {
    const preset = getTaxPreset(presetId);
    if (!preset) return;
    setLocalConfig((prev) => ({
      ...prev,
      tax: getTaxConfigFromPreset(presetId),
      currency: preset.currency,
    }));
  };

  const activeTaxPreset = getTaxPreset(taxConfig.region);

  const runDangerAction = async (
    action: () => Promise<boolean>,
    successKey: string
  ) => {
    const ok = await action();
    if (ok) {
      setImportStatus(`✅ ${t(successKey)}`);
      setTimeout(() => setImportStatus(null), 3500);
    }
  };

  const handleResetClick = async () => {
    if (!showResetConfirm) {
      setShowResetConfirm(true);
      return;
    }
    const ok = await onResetAllData();
    setShowResetConfirm(false);
    if (ok) {
      setImportStatus(`✅ ${t("app.resetAllSuccess")}`);
      setTimeout(() => setImportStatus(null), 3500);
    }
  };

  const activeStatus = importStatus || sunatTestStatus;

  const localeLabel =
    language === "en" ? t("common.english") : t("common.spanish");
  const themeLabel = theme === "dark" ? t("common.dark") : t("common.light");
  const dbBackupMeta = dbHealth
    ? dbHealth.backupExists
      ? t("settings.statDbBackupOk")
      : t("settings.statDbBackupMissing")
    : t("settings.statSunatMeta");

  return (
    <div className="settings-page">
      <section className="settings-hero card-glass">
        <div className="settings-hero-glow" aria-hidden="true" />
        <div className="settings-hero-main">
          <div className="settings-hero-title-block">
            <div className="settings-hero-icon" aria-hidden="true">
              <SettingsIcon size={26} />
            </div>
            <div>
              <p className="settings-hero-eyebrow">{t("settings.heroEyebrow")}</p>
              <h1 className="settings-hero-title">{t("settings.title")}</h1>
              <p className="settings-hero-subtitle">{t("settings.subtitle")}</p>
            </div>
          </div>
          <div className="settings-hero-badges">
            {localConfig.businessName.trim() && (
              <span className="settings-pill settings-pill--store" title={localConfig.businessName}>
                {localConfig.businessName}
              </span>
            )}
            <span className="settings-pill settings-pill--currency">{activeCurrency}</span>
            <span className={`settings-pill settings-pill--theme${theme === "dark" ? " is-dark" : ""}`}>
              {themeLabel}
            </span>
            <span className="settings-pill settings-pill--lang">{localeLabel}</span>
          </div>
        </div>

        <div className="settings-hero-stats" role="list" aria-label={t("settings.title")}>
          <div className="settings-hero-stat settings-hero-stat--products" role="listitem">
            <div className="settings-hero-stat-head">
              <span className="settings-hero-stat-icon">
                <BoxIcon size={13} />
              </span>
              <span className="settings-hero-stat-label">{t("settings.products")}</span>
            </div>
            <strong className="settings-hero-stat-value">
              {productsCount.toLocaleString(localeTag)}
            </strong>
            <span className="settings-hero-stat-meta">{t("settings.statProductsMeta")}</span>
          </div>
          <div className="settings-hero-stat settings-hero-stat--sales" role="listitem">
            <div className="settings-hero-stat-head">
              <span className="settings-hero-stat-icon">
                <HistoryIcon size={13} />
              </span>
              <span className="settings-hero-stat-label">{t("settings.sales")}</span>
            </div>
            <strong className="settings-hero-stat-value">
              {salesCount.toLocaleString(localeTag)}
            </strong>
            <span className="settings-hero-stat-meta">{t("settings.statSalesMeta")}</span>
          </div>
          <div className="settings-hero-stat settings-hero-stat--locale" role="listitem">
            <div className="settings-hero-stat-head">
              <span className="settings-hero-stat-icon">
                <SettingsIcon size={13} />
              </span>
              <span className="settings-hero-stat-label">{t("settings.currency")}</span>
            </div>
            <strong className="settings-hero-stat-value settings-hero-stat-value--sm">
              {activeCurrency}
            </strong>
            <span className="settings-hero-stat-meta">
              {themeLabel} · {localeLabel}
            </span>
          </div>
          <div
            className={`settings-hero-stat settings-hero-stat--sunat${sunatConfig.enabled ? " is-active" : ""}`}
            role="listitem"
          >
            <div className="settings-hero-stat-head">
              <span className="settings-hero-stat-icon">
                <KeyIcon size={13} />
              </span>
              <span className="settings-hero-stat-label">{t("settings.sunat")}</span>
            </div>
            <strong className="settings-hero-stat-value settings-hero-stat-value--sm">
              {sunatConfig.enabled ? t("common.active") : t("common.inactive")}
            </strong>
            <span className="settings-hero-stat-meta">{dbBackupMeta}</span>
          </div>
        </div>
      </section>

      <nav className="settings-quick-nav" aria-label={t("settings.quickNavLabel")}>
        <a href="#settings-appearance">{t("settings.navAppearance")}</a>
        <a href="#settings-store">{t("settings.navStore")}</a>
        <a href="#settings-tax">{t("settings.navTax")}</a>
        <a href="#settings-sunat">{t("settings.navSunat")}</a>
        <a href="#settings-backup">{t("settings.navBackup")}</a>
      </nav>

      {activeStatus && (
        <div className={`settings-status settings-status--${statusTone(activeStatus)}`} role="status">
          {activeStatus}
        </div>
      )}

      <div className="settings-layout">
        <section className="settings-card" id="settings-appearance">
          <header className="settings-card-head">
            <div className="settings-card-title">
              <span className="settings-card-icon settings-card-icon--brand">🎨</span>
              <div>
                <h2>{t("settings.appearanceTitle")}</h2>
                <p>{t("settings.appearanceSubtitle")}</p>
              </div>
            </div>
          </header>

          <div className="settings-theme-grid">
            <button
              type="button"
              className={`settings-theme-card${theme === "dark" ? " is-active" : ""}`}
              onClick={() => onThemeChange("dark")}
            >
              <div className="settings-theme-card-head">
                <span>🌙 {t("settings.themeDark")}</span>
                {theme === "dark" && <span className="settings-theme-badge">{t("common.current")}</span>}
              </div>
              <div className="settings-theme-preview settings-theme-preview--dark">
                <div className="settings-theme-preview-bars">
                  <span />
                  <span />
                </div>
                <p>
                  {t("settings.themePreview")} <strong>{formatCurrency(14.9, activeCurrency, localeTag)}</strong>
                </p>
              </div>
              <p className="settings-theme-note">{t("settings.themeDarkNote")}</p>
            </button>

            <button
              type="button"
              className={`settings-theme-card${theme === "light" ? " is-active" : ""}`}
              onClick={() => onThemeChange("light")}
            >
              <div className="settings-theme-card-head">
                <span>☀️ {t("settings.themeLight")}</span>
                {theme === "light" && <span className="settings-theme-badge">{t("common.current")}</span>}
              </div>
              <div className="settings-theme-preview settings-theme-preview--light">
                <div className="settings-theme-preview-bars">
                  <span />
                  <span />
                </div>
                <p>
                  {t("settings.themePreview")} <strong>{formatCurrency(14.9, activeCurrency, localeTag)}</strong>
                </p>
              </div>
              <p className="settings-theme-note">{t("settings.themeLightNote")}</p>
            </button>
          </div>

          <p className="settings-hint">{t("settings.themeHint")}</p>
        </section>

        <section className="settings-card" id="settings-language">
          <header className="settings-card-head">
            <div className="settings-card-title">
              <span className="settings-card-icon settings-card-icon--brand">🌐</span>
              <div>
                <h2>{t("settings.languageTitle")}</h2>
                <p>{t("settings.languageSubtitle")}</p>
              </div>
            </div>
          </header>

          <div className="settings-theme-grid">
            <button
              type="button"
              className={`settings-theme-card${language === "es" ? " is-active" : ""}`}
              onClick={() => onLanguageChange("es")}
            >
              <div className="settings-theme-card-head">
                <span>🇵🇪 {t("settings.languageEs")}</span>
                {language === "es" && <span className="settings-theme-badge">{t("common.current")}</span>}
              </div>
              <div className="settings-theme-preview settings-theme-preview--dark">
                <p>{t("settings.languageEsNote")}</p>
              </div>
            </button>

            <button
              type="button"
              className={`settings-theme-card${language === "en" ? " is-active" : ""}`}
              onClick={() => onLanguageChange("en")}
            >
              <div className="settings-theme-card-head">
                <span>🇺🇸 {t("settings.languageEn")}</span>
                {language === "en" && <span className="settings-theme-badge">{t("common.current")}</span>}
              </div>
              <div className="settings-theme-preview settings-theme-preview--light">
                <p>{t("settings.languageEnNote")}</p>
              </div>
            </button>
          </div>

          <p className="settings-hint">{t("settings.languageHint")}</p>
        </section>

        <section className="settings-card" id="settings-currency">
          <header className="settings-card-head">
            <div className="settings-card-title">
              <span className="settings-card-icon settings-card-icon--brand">💱</span>
              <div>
                <h2>{t("settings.currencyTitle")}</h2>
                <p>{t("settings.currencySubtitle")}</p>
              </div>
            </div>
          </header>

          <div className="settings-currency-grid">
            {CURRENCY_CATALOG.map((item) => {
              const isActive = activeCurrency === item.code;
              return (
                <button
                  key={item.code}
                  type="button"
                  className={`settings-currency-card${isActive ? " is-active" : ""}`}
                  onClick={() => onCurrencyChange(item.code)}
                >
                  <span className="settings-currency-symbol">{item.symbol}</span>
                  <span className="settings-currency-code">{item.code}</span>
                  <span className="settings-currency-name">
                    {t(`currencies.${item.code}` as "currencies.PEN")}
                  </span>
                  <span className="settings-currency-sample">
                    {formatCurrency(149.9, item.code, localeTag)}
                  </span>
                  {isActive && <span className="settings-theme-badge">{t("common.current")}</span>}
                </button>
              );
            })}
          </div>

          <p className="settings-hint">{t("settings.currencyHint")}</p>
        </section>

        <section className="settings-card" id="settings-store">
          <header className="settings-card-head">
            <div className="settings-card-title">
              <span className="settings-card-icon"><TicketIcon size={18} /></span>
              <div>
                <h2>{t("settings.storeTitle")}</h2>
                <p>{t("settings.storeSubtitle")}</p>
              </div>
            </div>
          </header>

          <div className="settings-form-grid">
            <div className="settings-field">
              <label htmlFor="businessName">{t("settings.businessName")}</label>
              <input
                id="businessName"
                className="form-control"
                value={localConfig.businessName}
                onChange={(e) => handleConfigChange("businessName", e.target.value)}
              />
            </div>
            <div className="settings-field">
              <label htmlFor="ruc">{t("settings.ruc")}</label>
              <input
                id="ruc"
                className="form-control"
                value={localConfig.ruc}
                onChange={(e) => handleConfigChange("ruc", e.target.value)}
              />
            </div>
            <div className="settings-field settings-field--full">
              <label htmlFor="address">{t("settings.address")}</label>
              <input
                id="address"
                className="form-control"
                value={localConfig.address}
                onChange={(e) => handleConfigChange("address", e.target.value)}
              />
            </div>
            <div className="settings-field settings-field--full">
              <SelectField
                id="salesWarehouse"
                label={t("settings.salesWarehouse")}
                value={localConfig.salesWarehouseId || ""}
                options={salesWarehouseOptions}
                onChange={(value) =>
                  setLocalConfig((prev) => ({
                    ...prev,
                    salesWarehouseId: value || undefined,
                  }))
                }
                accent="cyan"
              />
              <span className="settings-field-hint">{t("settings.salesWarehouseHint")}</span>
            </div>
            <div className="settings-field">
              <label htmlFor="ticketSeries">{t("settings.ticketSeries")}</label>
              <input
                id="ticketSeries"
                className="form-control"
                value={localConfig.ticketSeries}
                onChange={(e) => handleConfigChange("ticketSeries", e.target.value.toUpperCase())}
              />
              <span className="settings-field-hint">
                {t("settings.seriesHint", {
                  last: localConfig.lastTicketNumber,
                  next: `${localConfig.ticketSeries}-${String(localConfig.lastTicketNumber + 1).padStart(8, "0")}`,
                })}
              </span>
            </div>
            <div className="settings-field">
              <label htmlFor="boletaSeries">{t("settings.boletaSeries")}</label>
              <input
                id="boletaSeries"
                className="form-control"
                value={localConfig.boletaSeries}
                onChange={(e) => handleConfigChange("boletaSeries", e.target.value.toUpperCase())}
              />
              <span className="settings-field-hint">
                {t("settings.seriesHint", {
                  last: localConfig.lastBoletaNumber,
                  next: `${localConfig.boletaSeries}-${String(localConfig.lastBoletaNumber + 1).padStart(8, "0")}`,
                })}
              </span>
            </div>
          </div>

          <footer className="settings-card-foot">
            <button type="button" className="btn btn-primary" onClick={handleSaveStoreInfo} disabled={isSaving}>
              {isSaving ? t("common.saving") : t("settings.saveStoreInfo")}
            </button>
          </footer>
        </section>

        <section className="settings-card" id="settings-tax">
          <header className="settings-card-head">
            <div className="settings-card-title">
              <span className="settings-card-icon settings-card-icon--brand">🧾</span>
              <div>
                <h2>{t("settings.taxTitle")}</h2>
                <p>{t("settings.taxSubtitle")}</p>
              </div>
            </div>
          </header>

          <div className="settings-tax-presets-wrap">
            <p className="settings-tax-presets-intro">{t("settings.taxPresetsIntro")}</p>
            {TAX_PRESET_GROUPS.map((group) => (
              <div key={group.id} className="settings-tax-preset-group">
                <h3 className="settings-tax-preset-group-title">{t(group.labelKey)}</h3>
                <div className="settings-tax-preset-grid">
                  {group.presetIds.map((presetId) => {
                    const preset = getTaxPreset(presetId);
                    if (!preset) return null;
                    const isActive = taxConfig.region === presetId;
                    return (
                      <button
                        key={presetId}
                        type="button"
                        className={`settings-tax-preset-card${isActive ? " is-active" : ""}`}
                        onClick={() => handleTaxPresetApply(presetId)}
                        aria-pressed={isActive}
                      >
                        <span className="settings-tax-preset-flag" aria-hidden="true">
                          {preset.flag}
                        </span>
                        <strong className="settings-tax-preset-name">{t(preset.nameKey)}</strong>
                        <span className="settings-tax-preset-rate">
                          {t(preset.taxLabelKey, { rate: preset.salesTaxRate })}
                        </span>
                        <span className="settings-tax-preset-authority">{t(preset.authorityKey)}</span>
                        <span className="settings-tax-preset-currency">{preset.currency}</span>
                        {isActive && (
                          <span className="settings-theme-badge">{t("common.current")}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {activeTaxPreset?.noteKey && (
            <p className="settings-tax-preset-note">{t(activeTaxPreset.noteKey)}</p>
          )}

          <div className="settings-form-grid settings-tax-custom-grid">
            <div className="settings-field">
              <label htmlFor="salesTaxRate">{t("settings.taxRate")}</label>
              <input
                id="salesTaxRate"
                type="number"
                min={0}
                max={30}
                step={0.01}
                className="form-control"
                value={taxConfig.salesTaxRate}
                onChange={(e) => handleTaxChange("salesTaxRate", parseFloat(e.target.value) || 0)}
              />
              <span className="settings-field-hint">{t("settings.taxRateHint")}</span>
            </div>
            {allowsTaxJurisdiction(taxConfig) && (
              <div className="settings-field">
                <label htmlFor="taxJurisdiction">{t("settings.taxJurisdiction")}</label>
                <input
                  id="taxJurisdiction"
                  className="form-control"
                  value={taxConfig.jurisdiction || ""}
                  onChange={(e) => handleTaxChange("jurisdiction", e.target.value)}
                  placeholder={t("settings.taxJurisdictionPlaceholder")}
                />
                <span className="settings-field-hint">{t("settings.taxJurisdictionHint")}</span>
              </div>
            )}
            <div className="settings-field settings-field--full">
              <label className="settings-toggle settings-toggle--inline">
                <input
                  type="checkbox"
                  checked={taxConfig.taxInclusive}
                  disabled={isTaxInclusiveLocked(taxConfig)}
                  onChange={(e) => handleTaxChange("taxInclusive", e.target.checked)}
                />
                <span className="settings-toggle-track" aria-hidden="true" />
                <span className="settings-toggle-label">{t("settings.taxInclusive")}</span>
              </label>
              <span className="settings-field-hint">
                {isTaxInclusiveLocked(taxConfig)
                  ? t("settings.taxInclusiveLocked")
                  : t("settings.taxInclusiveHint")}
              </span>
            </div>
          </div>

          <footer className="settings-card-foot">
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                await onUpdateStoreConfig(localConfig);
                setImportStatus(`✅ ${t("settings.taxSaved")}`);
                setTimeout(() => setImportStatus(null), 2500);
              }}
            >
              {t("settings.saveTax")}
            </button>
          </footer>
        </section>

        <section className="settings-card" id="settings-sunat">
          <header className="settings-card-head">
            <div className="settings-card-title">
              <span className="settings-card-icon settings-card-icon--info"><KeyIcon size={18} /></span>
              <div>
                <h2>{t("settings.sunatTitle")}</h2>
                <p>{t("settings.sunatSubtitle")}</p>
              </div>
            </div>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={sunatConfig.enabled}
                onChange={(e) => handleSunatChange("enabled", e.target.checked)}
              />
              <span className="settings-toggle-track" aria-hidden="true" />
              <span className="settings-toggle-label">{t("settings.sunatEnable")}</span>
            </label>
          </header>

          <div className="settings-form-grid">
            <div className="settings-field">
              <SelectField
                id="sunatEnv"
                label={t("settings.environment")}
                value={sunatConfig.environment}
                options={sunatEnvironmentOptions}
                onChange={(value) => handleSunatChange("environment", value as SunatConfig["environment"])}
                accent="amber"
              />
            </div>
            <div className="settings-field">
              <label htmlFor="solUsuario">{t("settings.solUser")}</label>
              <input
                id="solUsuario"
                className="form-control"
                placeholder="Ej: MODDATOS"
                value={sunatConfig.solUsuario}
                onChange={(e) => handleSunatChange("solUsuario", e.target.value)}
              />
            </div>
            <div className="settings-field">
              <label htmlFor="solClave">{t("settings.solPass")}</label>
              <input
                id="solClave"
                type="password"
                className="form-control"
                value={sunatConfig.solClave}
                onChange={(e) => handleSunatChange("solClave", e.target.value)}
              />
            </div>
            <div className="settings-field">
              <label htmlFor="certPassword">{t("settings.certPass")}</label>
              <input
                id="certPassword"
                type="password"
                className="form-control"
                value={sunatConfig.certPassword}
                onChange={(e) => handleSunatChange("certPassword", e.target.value)}
              />
            </div>
            <div className="settings-field settings-field--full">
              <label htmlFor="certPath">{t("settings.certPath")}</label>
              <input
                id="certPath"
                className="form-control"
                placeholder="C:\ruta\al\certificado.pfx"
                value={sunatConfig.certPath}
                onChange={(e) => handleSunatChange("certPath", e.target.value)}
              />
              <span className="settings-field-hint">{t("settings.certPathHint")}</span>
            </div>
          </div>

          <div className="settings-info-box">
            {t("settings.sunatInfo")}
            <br />
            {t("settings.sunatMeta", { ruc: localConfig.ruc, series: localConfig.boletaSeries })}
          </div>

          <footer className="settings-card-foot">
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                setIsSaving(true);
                try {
                  await onUpdateStoreConfig(localConfig);
                  setImportStatus(`✅ ${t("settings.sunatSaved")}`);
                  setTimeout(() => setImportStatus(null), 2500);
                } catch {
                  setImportStatus(`❌ ${t("settings.sunatSaveError")}`);
                } finally {
                  setIsSaving(false);
                }
              }}
              disabled={isSaving}
            >
              {isSaving ? t("common.saving") : t("settings.saveSunat")}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isTestingSunat}
              onClick={async () => {
                setIsTestingSunat(true);
                setSunatTestStatus(null);
                const result = await testSunatConnection(sunatConfig, localConfig.ruc);
                setSunatTestStatus(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
                setIsTestingSunat(false);
              }}
            >
              {isTestingSunat ? t("common.testing") : t("settings.testCert")}
            </button>
          </footer>
        </section>

        <section className="settings-card" id="settings-printer">
          <header className="settings-card-head">
            <div className="settings-card-title">
              <span className="settings-card-icon"><PrinterIcon size={18} /></span>
              <div>
                <h2>{t("settings.printerTitle")}</h2>
                <p>{t("settings.printerSubtitle")}</p>
              </div>
            </div>
          </header>

          <div className="settings-form-grid">
            <div className="settings-field">
              <SelectField
                id="paperWidth"
                label={t("settings.paperWidth")}
                value={localConfig.printer?.paperWidth || "76mm"}
                options={paperWidthOptions}
                onChange={(value) => {
                  setLocalConfig((prev) => ({
                    ...prev,
                    printer: {
                      ...(prev.printer || { autoPrintAfterSale: false, footerMessage: "" }),
                      paperWidth: value as "58mm" | "76mm" | "80mm",
                    },
                  }));
                }}
                accent="magenta"
              />
            </div>
            <div className="settings-field settings-field--toggle">
              <label className="settings-toggle settings-toggle--block">
                <input
                  type="checkbox"
                  checked={localConfig.printer?.autoPrintAfterSale || false}
                  onChange={(e) => {
                    setLocalConfig((prev) => ({
                      ...prev,
                      printer: {
                        ...(prev.printer || { paperWidth: "76mm", footerMessage: "" }),
                        autoPrintAfterSale: e.target.checked,
                      },
                    }));
                  }}
                />
                <span className="settings-toggle-track" aria-hidden="true" />
                <span className="settings-toggle-label">{t("settings.autoPrint")}</span>
              </label>
            </div>
            <div className="settings-field settings-field--full">
              <label htmlFor="footerMessage">{t("settings.footerMessage")}</label>
              <input
                id="footerMessage"
                className="form-control"
                value={localConfig.printer?.footerMessage || ""}
                onChange={(e) => {
                  setLocalConfig((prev) => ({
                    ...prev,
                    printer: {
                      ...(prev.printer || { paperWidth: "76mm", autoPrintAfterSale: false }),
                      footerMessage: e.target.value,
                    },
                  }));
                }}
                placeholder={t("settings.footerPlaceholder")}
              />
            </div>
          </div>

          <footer className="settings-card-foot">
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                await onUpdateStoreConfig(localConfig);
                setImportStatus(`✅ ${t("settings.printerSaved")}`);
                setTimeout(() => setImportStatus(null), 2500);
              }}
            >
              {t("settings.savePrinter")}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
              {t("settings.testPrint")}
            </button>
          </footer>
        </section>

        <section className="settings-card" id="settings-backup">
          <header className="settings-card-head">
            <div className="settings-card-title">
              <span className="settings-card-icon"><FolderIcon size={18} /></span>
              <div>
                <h2>{t("settings.backupTitle")}</h2>
                <p>{t("settings.backupSubtitle")}</p>
              </div>
            </div>
          </header>

          <p className="settings-hint">
            {t("settings.backupHint", {
              dataDir: dbHealth?.dataDir || "%LOCALAPPDATA%\\com.niftypos.app\\data",
              dbFile: dbHealth?.dbPath || "nifty_pos.db",
            })}
          </p>

          {dbHealth && (
            <div className="settings-db-health" role="list" aria-label={t("settings.backupTitle")}>
              <span className="settings-db-chip" role="listitem">
                {t("settings.dataFolder", { path: dbHealth.dataDir || "—" })}
              </span>
              <span className="settings-db-chip" role="listitem">
                {t("settings.dbEngine", { engine: dbHealth.storageEngine || "sqlite" })}
              </span>
              <span
                className={`settings-db-chip${dbHealth.backupExists ? " settings-db-chip--ok" : " settings-db-chip--warn"}`}
                role="listitem"
              >
                {t("settings.dbBackup", {
                  status: dbHealth.backupExists ? t("common.available") : t("common.unavailable"),
                })}
              </span>
              <span className="settings-db-chip" role="listitem">
                {t("settings.dbRotating", { count: dbHealth.rotatingBackups })}
              </span>
              {dbHealth.productsWithImages != null && dbHealth.productsWithImages > 0 && (
                <span className="settings-db-chip" role="listitem">
                  {t("settings.dbImages", { count: dbHealth.productsWithImages })}
                </span>
              )}
              {dbHealth.legacyJsonExists && (
                <span className="settings-db-chip settings-db-chip--warn" role="listitem">
                  {t("settings.dbLegacy")}
                </span>
              )}
              {dbHealth.primaryBytes != null && (
                <span className="settings-db-chip" role="listitem">
                  {t("settings.dbSize", { size: (dbHealth.primaryBytes / 1024).toFixed(1) })}
                </span>
              )}
            </div>
          )}

          <div className="settings-backup-grid">
            <button type="button" className="settings-backup-tile" onClick={handleExportBackup}>
              <span className="settings-backup-tile-icon" aria-hidden="true">
                <FolderIcon size={18} />
              </span>
              <span className="settings-backup-tile-label">{t("settings.exportConfig")}</span>
            </button>
            <label className="settings-backup-tile settings-backup-tile--file">
              <span className="settings-backup-tile-icon" aria-hidden="true">
                <FolderIcon size={18} />
              </span>
              <span className="settings-backup-tile-label">{t("settings.importConfig")}</span>
              <input type="file" accept=".json" onChange={handleImportBackup} />
            </label>
            <button type="button" className="settings-backup-tile" onClick={onExportFullBackup}>
              <span className="settings-backup-tile-icon" aria-hidden="true">
                <LockIcon size={18} />
              </span>
              <span className="settings-backup-tile-label">{t("settings.fullBackup")}</span>
            </button>
            <label className="settings-backup-tile settings-backup-tile--file">
              <span className="settings-backup-tile-icon" aria-hidden="true">
                <LockIcon size={18} />
              </span>
              <span className="settings-backup-tile-label">{t("settings.importFullBackup")}</span>
              <input
                type="file"
                accept=".json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const ok = await onImportFullBackup(file);
                    setImportStatus(
                      ok ? `✅ ${t("app.backupImportSuccess")}` : `❌ ${t("app.backupImportError")}`
                    );
                    setTimeout(() => setImportStatus(null), 4000);
                    e.target.value = "";
                  }
                }}
              />
            </label>
          </div>

          <div className="settings-danger-zone">
            <div className="settings-danger-head">
              <LockIcon size={16} />
              <div>
                <strong>{t("settings.dangerTitle")}</strong>
                <p>{t("settings.dangerSubtitle")}</p>
              </div>
            </div>
            <div className="settings-action-row">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => runDangerAction(onClearSalesHistory, "app.clearSalesSuccess")}
              >
                {t("settings.clearSales")}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => runDangerAction(onClearDebts, "app.clearDebtsSuccess")}
              >
                {t("settings.clearDebts")}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => runDangerAction(onClearAllProducts, "app.clearProductsSuccess")}
              >
                {t("settings.clearProducts")}
              </button>
              <button
                type="button"
                className={`btn btn-danger${showResetConfirm ? " is-confirm" : ""}`}
                onClick={handleResetClick}
              >
                {showResetConfirm ? t("settings.resetConfirm") : t("settings.resetAll")}
              </button>
            </div>
          </div>
        </section>

        <section className="settings-card settings-card--compact" id="settings-shortcuts">
          <header className="settings-card-head">
            <div className="settings-card-title">
              <span className="settings-card-icon settings-card-icon--brand">⌨️</span>
              <div>
                <h2>{t("settings.shortcutsTitle")}</h2>
                <p>{t("settings.shortcutsSubtitle")}</p>
              </div>
            </div>
          </header>

          <ul className="settings-shortcuts settings-shortcuts-grid">
            {shortcuts.map((item) => (
              <li key={item.action}>
                <span>{item.action}</span>
                <kbd>{item.keys}</kbd>
              </li>
            ))}
          </ul>
          <p className="settings-hint">{t("settings.shortcutsHint")}</p>
        </section>

        <section className="settings-card settings-card--about" id="settings-about">
          <header className="settings-card-head">
            <div className="settings-card-title">
              <span className="settings-card-icon">ℹ️</span>
              <div>
                <h2>{t("settings.aboutTitle")}</h2>
                <p>{t("settings.aboutSubtitle")}</p>
              </div>
            </div>
          </header>
          <dl className="settings-about-list">
            <div>
              <dt>{t("settings.version")}</dt>
              <dd>{t("settings.versionValue")}</dd>
            </div>
            <div>
              <dt>{t("settings.visualStyle")}</dt>
              <dd>{t("settings.visualStyleValue")}</dd>
            </div>
            <div>
              <dt>{t("settings.brandColors")}</dt>
              <dd>
                <span className="settings-color-chip settings-color-chip--magenta" />
                <span className="settings-color-chip settings-color-chip--yellow" />
                <span className="settings-color-chip settings-color-chip--cyan" />
                {t("settings.brandColorsValue")}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
};