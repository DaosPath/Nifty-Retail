<div align="center">
  <img src="public/app-logo.svg" alt="Nifty Retail" width="120" height="120" />
  <h1>Nifty Retail</h1>
  <p><strong>Sistema de punto de venta moderno para tiendas y bodegas peruanas</strong></p>
  <p>
    <img alt="Tauri 2" src="https://img.shields.io/badge/Tauri_2-24C8D8?style=flat-square&logo=tauri&logoColor=white" />
    <img alt="React 19" src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
    <img alt="Rust" src="https://img.shields.io/badge/Rust-000000?style=flat-square&logo=rust&logoColor=white" />
    <img alt="License MIT" src="https://img.shields.io/badge/Licencia-MIT-green?style=flat-square" />
  </p>
</div>

---

## ✨ Características

### 🛒 Punto de Venta (POS)
- Venta rápida con búsqueda en tiempo real y escáner de código de barras USB
- Múltiples métodos de pago: efectivo, tarjeta, Yape, mixto
- Cálculo automático de vuelto y descuentos por ítem o total
- Impresión de boletas y comprobantes

### 📦 Inventario
- Control de stock con mínimos y alertas automáticas
- Ingreso de mercadería por lotes con trazabilidad
- Kardex detallado de movimientos por producto
- Alertas de stock bajo y productos por vencer

### 📂 Catálogo
- Gestión de productos, categorías, proveedores y almacenes
- Precios de compra y venta con márgenes calculados
- Importación/exportación de datos

### 💰 Caja y Finanzas
- Apertura y cierre de caja con cuadre automático
- Historial completo de ventas con filtros por fecha
- Control de deudas de clientes y proveedores
- Reportes de ventas, productos más vendidos y rentabilidad

### 🤖 Asistente IA
- Chat integrado con IA para consultas de negocio
- Análisis automático de datos de ventas e inventario

### ⚙️ Configuración
- Tema claro / oscuro (estilo Tambyto)
- Datos de la tienda, moneda y preferencias
- Soporte multiidioma (ES, EN)
- Facturación electrónica SUNAT (en desarrollo)

---

## 🏗️ Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 19 + TypeScript |
| **Desktop** | Tauri 2 (Rust) |
| **Estilos** | CSS puro con variables y temas |
| **Gráficos** | Chart.js |
| **Persistencia** | JSON local vía Tauri FS |
| **Build** | Vite 8 |

---

## 🚀 Inicio Rápido

### Requisitos previos

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) (stable)
- Windows 10/11 (plataforma principal)

### Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar en modo desarrollo (abre la ventana Tauri)
npm run tauri dev
```

### Build de producción

```bash
# Compilar el instalador (.msi / .exe)
npm run tauri build
```

El instalador generado se encuentra en `src-tauri/target/release/bundle/`.

---

## 📁 Estructura del Proyecto

```
nifty-planck/
├── public/             # Assets estáticos (logo, iconos SVG)
├── src/                # Código fuente React
│   ├── components/     # Componentes UI (POS, Inventory, etc.)
│   ├── features/       # Módulos de funcionalidad
│   ├── hooks/          # Custom hooks
│   ├── i18n/           # Traducciones (es, en)
│   ├── styles/         # Estilos adicionales
│   ├── types/          # Tipos TypeScript
│   ├── utils/          # Utilidades y helpers
│   ├── App.tsx         # Componente principal
│   └── index.css       # Sistema de diseño y estilos globales
├── src-tauri/          # Backend Rust (Tauri)
│   ├── icons/          # Iconos de la app (generados)
│   ├── src/            # Código Rust
│   └── tauri.conf.json # Configuración Tauri
├── DESIGN.md           # Sistema de diseño (tokens, colores, componentes)
└── package.json
```

---

## 🎨 Sistema de Diseño

El proyecto sigue el sistema de diseño **Tambyto** documentado en [`DESIGN.md`](DESIGN.md):

| Color | Hex | Uso |
|-------|-----|-----|
| 🟣 **Magenta** | `#C2117A` | Acciones principales, navegación activa |
| 🟡 **Amarillo** | `#FFED00` | Precios, totales, foco de teclado |
| 🔵 **Cian** | `#00B5E2` | Iconos de sistema, escáner, stock |

Soporta **modo oscuro** (por defecto) y **modo claro** con cambio instantáneo.

---

## 💾 Datos Locales

La base de datos y configuración se almacenan en:

```
%LOCALAPPDATA%\com.niftypos.app\
```

Los datos son un archivo JSON local — no se requiere servidor ni conexión a internet.

---

## 📄 Licencia

[MIT](LICENSE)