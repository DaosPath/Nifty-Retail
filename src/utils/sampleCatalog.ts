import type { AppLocale } from "../i18n";

export interface SampleCatalogCategory {
  name: string;
  items: string[];
}

export interface SampleCatalogConfig {
  categories: SampleCatalogCategory[];
  brands: string[];
  sizes: string[];
  barcodePrefix: string;
  lotPrefix: string;
  priceMin: number;
  priceMax: number;
  markupMin: number;
  markupMax: number;
}

const PERU_CATALOG: SampleCatalogConfig = {
  categories: [
    {
      name: "Abarrotes",
      items: [
        "Arroz",
        "Fideos",
        "Aceite Vegetal",
        "Azúcar Rubia",
        "Sal de Mesa",
        "Lentejas",
        "Garbanzos",
        "Atún en Trozos",
        "Mayonesa",
        "Ketchup",
        "Café Soluble",
        "Té Filtrante",
      ],
    },
    {
      name: "Bebidas",
      items: [
        "Gaseosa Inca Kola",
        "Gaseosa Coca Cola",
        "Gaseosa Fanta",
        "Agua Mineral Sin Gas",
        "Agua Mineral Con Gas",
        "Jugo de Naranja",
        "Bebida Energizante",
        "Cerveza Pilsen",
        "Cerveza Cristal",
      ],
    },
    {
      name: "Lácteos",
      items: [
        "Leche Evaporada",
        "Leche Fresca",
        "Yogurt de Fresa",
        "Yogurt de Durazno",
        "Queso Edam",
        "Queso Fresco",
        "Mantequilla con Sal",
      ],
    },
    {
      name: "Limpieza",
      items: [
        "Detergente en Polvo",
        "Lavavajillas Líquido",
        "Desinfectante de Pisos",
        "Jabón de Lavar",
        "Lejía Concentrada",
        "Limpiavidrios",
        "Bolsas de Basura",
      ],
    },
    {
      name: "Snacks",
      items: [
        "Papas Fritas",
        "Tortees",
        "Camotes Fritos",
        "Chifles Piuranos",
        "Galletas de Vainilla",
        "Galletas de Chocolate",
        "Chocolate de Taza",
        "Caramelos surtidos",
      ],
    },
    {
      name: "Cuidado Personal",
      items: [
        "Jabón de Tocador",
        "Champú Anticaspa",
        "Acondicionador",
        "Crema Dental",
        "Cepillo de Dientes",
        "Desodorante en Spray",
        "Papel Higiénico x4",
      ],
    },
  ],
  brands: [
    "Gloria",
    "Alicorp",
    "Nestlé",
    "Molitalia",
    "Primor",
    "Bolívar",
    "San Jorge",
    "Field",
    "Costa",
    "Inca Kola",
    "Coca Cola",
    "D'Onofrio",
    "Winter's",
  ],
  sizes: ["50g", "100g", "250g", "500g", "900g", "1kg", "500ml", "1L", "1.5L", "2.25L", "Botella", "Lata", "Paquete"],
  barcodePrefix: "775",
  lotPrefix: "L-GEN",
  priceMin: 0.5,
  priceMax: 20,
  markupMin: 0.15,
  markupMax: 0.4,
};

const USA_CATALOG: SampleCatalogConfig = {
  categories: [
    {
      name: "Groceries",
      items: [
        "White Rice",
        "Spaghetti",
        "Olive Oil",
        "All-Purpose Flour",
        "Granulated Sugar",
        "Table Salt",
        "Black Beans",
        "Peanut Butter",
        "Canned Tomatoes",
        "Pasta Sauce",
        "Instant Oatmeal",
        "Maple Syrup",
      ],
    },
    {
      name: "Beverages",
      items: [
        "Coca-Cola Classic",
        "Pepsi Cola",
        "Sprite",
        "Bottled Spring Water",
        "Orange Juice",
        "Sports Drink",
        "Iced Tea",
        "Bud Light Beer",
        "Starbucks Cold Brew",
      ],
    },
    {
      name: "Dairy",
      items: [
        "Whole Milk",
        "2% Reduced Fat Milk",
        "Greek Yogurt",
        "Cheddar Cheese",
        "Salted Butter",
        "Cream Cheese",
        "Sour Cream",
        "Mozzarella Cheese",
      ],
    },
    {
      name: "Cleaning",
      items: [
        "Laundry Detergent",
        "Dish Soap",
        "Floor Cleaner",
        "Liquid Bleach",
        "Paper Towels",
        "Trash Bags",
        "All-Purpose Cleaner",
        "Glass Cleaner",
      ],
    },
    {
      name: "Snacks",
      items: [
        "Potato Chips",
        "Tortilla Chips",
        "Pretzels",
        "Microwave Popcorn",
        "Chocolate Bar",
        "Granola Bars",
        "Chocolate Chip Cookies",
        "Mixed Candy",
      ],
    },
    {
      name: "Personal Care",
      items: [
        "Bar Soap",
        "Anti-Dandruff Shampoo",
        "Hair Conditioner",
        "Toothpaste",
        "Toothbrush",
        "Deodorant Spray",
        "Toilet Paper 4-Pack",
        "Body Lotion",
      ],
    },
  ],
  brands: [
    "Kraft",
    "Heinz",
    "General Mills",
    "Kellogg's",
    "Nabisco",
    "Coca-Cola",
    "Pepsi",
    "Nestlé",
    "Campbell's",
    "Tide",
    "Dove",
    "Colgate",
    "Gillette",
    "Hershey's",
    "Frito-Lay",
    "Quaker",
    "Barilla",
    "Great Value",
    "Kirkland",
    "Lay's",
  ],
  sizes: [
    "8 oz",
    "12 oz",
    "16 oz",
    "24 oz",
    "32 oz",
    "1 lb",
    "2 lb",
    "16 fl oz",
    "32 fl oz",
    "64 fl oz",
    "1 gal",
    "Can",
    "Box",
    "Bag",
  ],
  barcodePrefix: "0",
  lotPrefix: "LOT-US",
  priceMin: 0.99,
  priceMax: 24.99,
  markupMin: 0.12,
  markupMax: 0.35,
};

export function getSampleCatalogConfig(locale: AppLocale): SampleCatalogConfig {
  return locale === "en" ? USA_CATALOG : PERU_CATALOG;
}

export interface GeneratedSampleProduct {
  code: string;
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  expiryDate: string;
  manufacturer?: string;
}

export interface GeneratedSampleLot {
  id: string;
  productCode: string;
  lotNumber: string;
  purchasePrice: number;
  initialQty: number;
  stock: number;
  expiryDate: string;
  createdAt: string;
}

function buildBarcode(config: SampleCatalogConfig, index: number): string {
  if (config.barcodePrefix === "775") {
    return `${config.barcodePrefix}${String(1000000000 + index)}`;
  }

  const body = String(10000000000 + index).slice(-11);
  return `${config.barcodePrefix}${body}`;
}

export function generateSampleCatalog(
  locale: AppLocale,
  count = 1000
): { products: GeneratedSampleProduct[]; lots: GeneratedSampleLot[] } {
  const config = getSampleCatalogConfig(locale);
  const products: GeneratedSampleProduct[] = [];
  const lots: GeneratedSampleLot[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const catObj = config.categories[i % config.categories.length];
    const baseItem = catObj.items[Math.floor(Math.random() * catObj.items.length)];
    const brand = config.brands[Math.floor(Math.random() * config.brands.length)];
    const size = config.sizes[Math.floor(Math.random() * config.sizes.length)];
    const name = `${baseItem} ${brand} ${size}`;
    const barcode = buildBarcode(config, i);

    const cost = parseFloat(
      (config.priceMin + Math.random() * (config.priceMax - config.priceMin)).toFixed(2)
    );
    const price = parseFloat(
      (cost * (1 + config.markupMin + Math.random() * (config.markupMax - config.markupMin))).toFixed(2)
    );
    const stock = Math.floor(Math.random() * 60);
    const minStock = 5 + Math.floor(Math.random() * 5);
    const expiryDays = 30 + Math.floor(Math.random() * 670);
    const expiry = new Date(now + expiryDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    products.push({
      code: barcode,
      name,
      category: catObj.name,
      purchasePrice: cost,
      sellingPrice: price,
      stock,
      minStock,
      expiryDate: expiry,
      manufacturer: brand,
    });

    lots.push({
      id: `lot_gen_${barcode}_${now}_${i}`,
      productCode: barcode,
      lotNumber: `${config.lotPrefix}-${100 + i}`,
      purchasePrice: cost,
      initialQty: stock,
      stock,
      expiryDate: expiry,
      createdAt: new Date().toISOString(),
    });
  }

  return { products, lots };
}