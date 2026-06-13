export function buildSqlSchemaPrompt(locale: "es" | "en"): string {
  if (locale === "en") {
    return `SQLite schema (read-only):
- products(code TEXT PK, payload TEXT JSON, image_base64 TEXT)
  payload fields: code, name, category, purchasePrice, sellingPrice, stock, minStock, expiryDate?, warehouseStock?
- collections(name TEXT PK, payload TEXT JSON array)
  names: sales, cashSessions, lots, debts, suppliers, categories, warehouses, locations, manufacturers, stockMovements, stockPurchases, supplierDebts
- store_config(id=1, payload TEXT JSON): businessName, ruc, address, currency, tax, printer, sunat
- meta(id=1): schema_version, saved_at, storage_engine

Use json_extract(payload, '$.field') on products. Collections store JSON arrays in payload.
Always add LIMIT. Example:
SELECT code, json_extract(payload,'$.name') AS name, json_extract(payload,'$.stock') AS stock
FROM products WHERE CAST(json_extract(payload,'$.stock') AS INTEGER) <= CAST(json_extract(payload,'$.minStock') AS INTEGER)
LIMIT 50`;
  }

  return `Esquema SQLite (solo lectura):
- products(code TEXT PK, payload TEXT JSON, image_base64 TEXT)
  Campos en payload: code, name, category, purchasePrice, sellingPrice, stock, minStock, expiryDate?, warehouseStock?
- collections(name TEXT PK, payload TEXT JSON array)
  Claves: sales, cashSessions, lots, debts, suppliers, categories, warehouses, locations, manufacturers, stockMovements, stockPurchases, supplierDebts
- store_config(id=1, payload TEXT JSON): businessName, ruc, address, currency, tax, printer, sunat
- meta(id=1): schema_version, saved_at, storage_engine

Usa json_extract(payload, '$.campo') en products. Las colecciones guardan arreglos JSON en payload.
Siempre incluye LIMIT. Ejemplo:
SELECT code, json_extract(payload,'$.name') AS nombre, json_extract(payload,'$.stock') AS stock
FROM products
WHERE CAST(json_extract(payload,'$.stock') AS INTEGER) <= CAST(json_extract(payload,'$.minStock') AS INTEGER)
LIMIT 50`;
}

export function buildWidgetPrompt(locale: "es" | "en"): string {
  if (locale === "en") {
    return `You may embed UI widgets using fenced blocks:
\`\`\`nifty-widget
{"type":"stats","title":"Snapshot","items":[{"label":"Products","value":120}]}
\`\`\`
Supported types: stats, table, callout, actions, chart. Use actions to navigate: {"type":"actions","items":[{"label":"Open inventory","action":"navigate","value":"/inventory"}]}`;
  }

  return `Puedes incrustar widgets visuales con bloques:
\`\`\`nifty-widget
{"type":"stats","title":"Resumen","items":[{"label":"Productos","value":120,"tone":"success"}]}
\`\`\`
Tipos: stats, table, callout, actions, chart. Para navegar: {"type":"actions","items":[{"label":"Ver inventario","action":"navigate","value":"/inventario"}]}`;
}