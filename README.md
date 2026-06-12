# Nifty Retail

Sistema de punto de venta e inventario para tiendas y bodegas, construido con **Tauri 2** + **React** + **TypeScript**.

## Características

- POS con escáner y múltiples métodos de pago
- Inventario, lotes, kardex y alertas de stock
- Catálogo (categorías, proveedores, almacenes)
- Caja, historial de ventas y reportes
- Deudas de clientes y proveedores
- Asistente IA integrado
- Tema claro/oscuro

## Requisitos

- Node.js 20+
- Rust (para Tauri)
- Windows 10/11 (build principal)

## Desarrollo

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run build
npm run tauri build
```

## Datos locales

La configuración y base de datos se guardan en `%LOCALAPPDATA%\com.niftypos.app\`.

## Licencia

MIT