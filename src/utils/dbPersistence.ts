export const DB_SCHEMA_VERSION = 2;
export const DB_SAVE_DEBOUNCE_MS = 650;

export interface DbPayload {
  schemaVersion?: number;
  savedAt?: string;
  products: unknown[];
  sales: unknown[];
  cashSessions: unknown[];
  lots?: unknown[];
  debts?: unknown[];
  suppliers?: unknown[];
  categories?: unknown[];
  warehouses?: unknown[];
  locations?: unknown[];
  manufacturers?: unknown[];
  stockMovements?: unknown[];
  stockPurchases?: unknown[];
  supplierDebts?: unknown[];
  storeConfig?: unknown;
}

export interface LoadDbResponse {
  content: string;
  source: "primary" | "backup" | "tmp" | "rotating_backup" | "default" | string;
  recovered: boolean;
  message?: string | null;
}

export interface SaveDbResponse {
  savedAt: string;
  backupCreated: boolean;
}

export interface DbHealth {
  dataDir?: string;
  dbPath: string;
  storageEngine?: string;
  primaryExists: boolean;
  primaryBytes?: number | null;
  backupExists: boolean;
  rotatingBackups: number;
  tmpExists: boolean;
  legacyJsonExists?: boolean;
  productsWithImages?: number;
}

export interface QueueDbSaveOptions {
  immediate?: boolean;
}

export function buildDbPayload(data: Omit<DbPayload, "schemaVersion" | "savedAt">): DbPayload {
  return {
    schemaVersion: DB_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    ...data,
  };
}

export function serializeDbPayload(data: Omit<DbPayload, "schemaVersion" | "savedAt">): string {
  return JSON.stringify(buildDbPayload(data));
}

export function parseDbContent(raw: string): DbPayload & Record<string, unknown> {
  const parsed = JSON.parse(raw) as DbPayload & Record<string, unknown>;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("La base de datos no tiene un formato válido.");
  }
  if (!Array.isArray(parsed.products)) parsed.products = [];
  if (!Array.isArray(parsed.sales)) parsed.sales = [];
  if (!Array.isArray(parsed.cashSessions)) parsed.cashSessions = [];
  return parsed;
}

let pendingSave: Promise<void> | null = null;
let pendingPayload: string | null = null;
let lastFlushedPayload: string | null = null;
let debounceTimer: number | null = null;
let saveInvoker: ((data: string) => Promise<SaveDbResponse>) | null = null;

export function registerDbSaveInvoker(invoker: (data: string) => Promise<SaveDbResponse>) {
  saveInvoker = invoker;
}

export async function flushPendingDbSave(): Promise<void> {
  if (!pendingPayload || !saveInvoker) return;
  if (pendingPayload === lastFlushedPayload) {
    pendingPayload = null;
    return;
  }

  const payload = pendingPayload;
  pendingPayload = null;
  await saveInvoker(payload);
  lastFlushedPayload = payload;
}

export function queueDbSave(data: string, options?: QueueDbSaveOptions): Promise<void> {
  pendingPayload = data;

  if (!saveInvoker) {
    return Promise.resolve();
  }

  if (options?.immediate) {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    const task = flushPendingDbSave().finally(() => {
      pendingSave = null;
    });
    pendingSave = task;
    return task;
  }

  if (pendingSave) {
    return pendingSave;
  }

  pendingSave = new Promise<void>((resolve) => {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
    }

    debounceTimer = window.setTimeout(async () => {
      debounceTimer = null;
      try {
        await flushPendingDbSave();
      } finally {
        pendingSave = null;
        resolve();
      }
    }, DB_SAVE_DEBOUNCE_MS);
  });

  return pendingSave;
}

export function installDbLifecycleGuards() {
  const flush = () => {
    if (!pendingPayload || !saveInvoker) return;
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    void flushPendingDbSave();
  };

  window.addEventListener("beforeunload", flush);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

export function recoveryBannerMessage(response: LoadDbResponse): string | null {
  if (!response.recovered && !response.message) return null;
  return response.message || "Se recuperó la base de datos desde un respaldo.";
}