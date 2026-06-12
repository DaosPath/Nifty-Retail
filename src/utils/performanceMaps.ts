export function buildProductByCodeMap<T extends { code: string }>(products: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const product of products) {
    map.set(product.code, product);
  }
  return map;
}

export function countInventoryAlerts(
  products: Array<{ stock: number; minStock: number }>,
  lots: Array<{ stock: number; expiryDate: string }>,
  expiryHorizonDays = 45
): number {
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  const now = Date.now();
  const horizonMs = expiryHorizonDays * 24 * 60 * 60 * 1000;
  let expiringCount = 0;
  for (const lot of lots) {
    if (lot.stock <= 0) continue;
    if (new Date(lot.expiryDate).getTime() - now <= horizonMs) {
      expiringCount += 1;
    }
  }
  return lowStockCount + expiringCount;
}