---
name: "NiftyPOS — Estilo Tambyto"
version: "alpha"
description: |
  Sistema de diseño para NiftyPOS (punto de venta para tiendas y bodegas peruanas).
  Basado en la identidad visual de alto impacto de la marca Tambyto.
  Soporta dos modos: 
  - Dark Tambyto (recomendado para jornadas largas, mínima fatiga visual)
  - Light (para entornos con mucha luz natural o preferencia personal)
  Los colores de marca (Magenta, Amarillo y Cian) se mantienen consistentes en ambos modos para reforzar la identidad.
  Los tokens semánticos priorizan legibilidad de precios/totales y claridad en acciones principales.
colors:
  # Colores de marca Tambyto (invariantes en ambos modos)
  brand-magenta: "#c2117a"
  brand-yellow: "#ffed00"
  brand-cyan: "#00b5e2"

  # Modo Oscuro (Dark Tambyto) - por defecto
  bg-main: "#0f0f12"
  bg-card: "#161622"
  bg-sidebar: "#0c0c12"
  text-primary: "#ffffff"
  text-secondary: "#a1a1aa"
  text-muted: "#71717a"

  # Modo Claro (Light variant)
  bg-main-light: "#f4f6f9"
  bg-card-light: "#ffffff"
  bg-sidebar-light: "#eef2f7"
  text-primary-light: "#1f2329"
  text-secondary-light: "#4b5563"
  text-muted-light: "#6b7280"

  # Estados y acentos semánticos (compartidos)
  accent-cta: "{colors.brand-magenta}"
  accent-price: "{colors.brand-yellow}"
  accent-system: "{colors.brand-cyan}"
  success: "#22c55e"
  warning: "{colors.brand-yellow}"
  danger: "#ef4444"

modes:
  dark:
    bg-main: "{colors.bg-main}"
    bg-card: "{colors.bg-card}"
    bg-sidebar: "{colors.bg-sidebar}"
    text-primary: "{colors.text-primary}"
    text-secondary: "{colors.text-secondary}"
    text-muted: "{colors.text-muted}"
  light:
    bg-main: "{colors.bg-main-light}"
    bg-card: "{colors.bg-card-light}"
    bg-sidebar: "{colors.bg-sidebar-light}"
    text-primary: "{colors.text-primary-light}"
    text-secondary: "{colors.text-secondary-light}"
    text-muted: "{colors.text-muted-light}"
typography:
  # Valores por defecto del sistema (pueden refinarse con fuentes locales)
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: "400"
    lineHeight: "1.5"
  price:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: "700"
  total:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.75rem"
    fontWeight: "700"
  heading:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: "600"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  # Navegación lateral
  sidebar-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    iconColor: "{colors.brand-cyan}"
  sidebar-item-active:
    backgroundColor: "{colors.brand-magenta}"
    textColor: "{colors.text-primary}"
    iconColor: "{colors.text-primary}"
    fontWeight: "600"
  # Tarjetas de producto
  product-card:
    backgroundColor: "{colors.bg-card}"
    border: "1.5px solid transparent"
    borderRadius: "{rounded.md}"
    textColor: "{colors.text-primary}"
  product-card-hover:
    borderColor: "{colors.brand-magenta}"
    boxShadow: "0 4px 15px rgba(194, 17, 122, 0.2)"
  # Precios y totales (máxima visibilidad)
  price:
    textColor: "{colors.brand-yellow}"
    fontWeight: "700"
  total-display:
    textColor: "{colors.brand-yellow}"
    fontSize: "1.75rem"
    fontWeight: "700"
  # Botones principales
  button-primary:
    backgroundColor: "{colors.brand-magenta}"
    textColor: "{colors.text-primary}"
    borderRadius: "{rounded.md}"
  button-primary-hover:
    backgroundColor: "#a80e65" # Magenta más oscuro para hover
  # Buscador
  search-input:
    backgroundColor: "{colors.bg-card}"
    borderColor: "transparent"
    focusBorderColor: "{colors.brand-yellow}"
    iconColor: "{colors.brand-cyan}"
  # Badges y estados
  badge-category:
    backgroundColor: "rgba(255,255,255,0.06)"
    textColor: "{colors.brand-magenta}"
  badge-stock-stable:
    textColor: "{colors.brand-cyan}"
  badge-stock-critical:
    textColor: "{colors.brand-yellow}"
  # Indicador de escáner
  scanner-indicator:
    backgroundColor: "{colors.brand-cyan}"
    animation: "pulse 2s infinite"
  # Caja y estados
  caja-open:
    color: "{colors.success}"
  caja-closed:
    color: "{colors.text-muted}"
---

# NiftyPOS — Guía de Rediseño de UI (Estilo Tambyto)

> **Estándar**: Este documento sigue la especificación **DESIGN.md** de Google Labs (Stitch) para que agentes de IA y herramientas de diseño puedan interpretar de forma precisa y consistente la identidad visual del sistema.

## Overview

NiftyPOS es un sistema de punto de venta (POS) desktop para tiendas y bodegas peruanas, construido con Tauri + React.

Este sistema de diseño **Tambyto** define dos variantes de tema para adaptarse a diferentes condiciones de trabajo:

- **Dark Tambyto** (modo por defecto): Optimizado para jornadas largas. Reduce fatiga visual con fondos muy oscuros y alto contraste en elementos críticos.
- **Light**: Versión clara para entornos con buena iluminación natural, preferencias personales o tiendas con mucha luz. Mantiene los mismos acentos de marca para consistencia de identidad.

**Objetivos principales**:
- **Alta velocidad de lectura** de precios y totales (el dato más crítico en caja).
- **Jerarquía visual clara**: el cajero sabe instintivamente dónde hacer clic o dónde mirar.
- **Consistencia de marca**: el software se siente como una extensión del local físico en ambos modos.
- **Flexibilidad**: Soporte nativo de cambio de tema persistente sin perder la identidad Tambyto.

**Principios de diseño**:
- Los colores de marca (Magenta, Amarillo y Cian) son **invariantes** y se usan con el mismo significado semántico en ambos modos.
- El **Amarillo** se reserva para precios y totales (ajustando ligeramente su tono en light para mejor contraste).
- El **Magenta** se usa para acciones principales y estados activos.
- El **Cian** identifica elementos de sistema (escáner, íconos, stock normal).
- Máximo contraste en elementos de decisión rápida.
- Animaciones sutiles que guían sin distraer.

## Colores

Los tokens de marca principales (**brand-magenta**, **brand-yellow**, **brand-cyan**) son **invariantes** y conservan su significado semántico en ambos modos.

### Modo Oscuro — Dark Tambyto (por defecto)

| Token            | Valor      | Uso principal                                      |
|------------------|------------|----------------------------------------------------|
| `bg-main`        | `#0f0f12`  | Fondo general de la aplicación                     |
| `bg-card`        | `#161622`  | Tarjetas de producto, contenedores, inputs         |
| `bg-sidebar`     | `#0c0c12`  | Barra lateral de navegación                        |
| `text-primary`   | `#ffffff`  | Textos principales                                 |
| `text-secondary` | `#a1a1aa`  | Textos secundarios y metadatos                     |
| `text-muted`     | `#71717a`  | Texto deshabilitado / secundario suave             |

### Modo Claro — Light Tambyto

| Token            | Valor      | Uso principal                                      |
|------------------|------------|----------------------------------------------------|
| `bg-main`        | `#f4f6f9`  | Fondo general de la aplicación                     |
| `bg-card`        | `#ffffff`  | Tarjetas de producto, contenedores, inputs         |
| `bg-sidebar`     | `#eef2f7`  | Barra lateral de navegación                        |
| `text-primary`   | `#1f2329`  | Textos principales (casi negro)                    |
| `text-secondary` | `#4b5563`  | Textos secundarios y metadatos                     |
| `text-muted`     | `#6b7280`  | Texto deshabilitado / secundario suave             |

### Colores de Marca Tambyto (compartidos)

| Token             | Valor      | Uso recomendado (semántico)                                      |
|-------------------|------------|------------------------------------------------------------------|
| `brand-magenta`   | `#C2117A`  | Botones principales (CTA), navegación activa, selecciones, énfasis |
| `brand-yellow`    | `#FFED00`  | **Precios**, totales, alertas de alta prioridad, foco de teclado.<br>En modo claro se oscurece ligeramente (#c59f00) para mejor contraste. |
| `brand-cyan`      | `#00B5E2`  | Íconos inactivos, indicador de escáner, acentos de sistema, stock estable |
| `success`         | `#22c55e`  | Estados positivos (caja abierta, stock normal)                   |
| `danger`          | `#ef4444`  | Estados de error / peligro                                       |

**Rationale**:
- El **Amarillo** es el color con mayor "luminancia de atención" para números importantes. En modo claro se ajusta su tono para mantener excelente legibilidad sobre blanco.
- El **Magenta** funciona como color de acción principal en ambos modos (excelente contraste en dark y light).
- El **Cian** da coherencia tecnológica a elementos de interfaz que no son acciones primarias.
- Los fondos del modo claro son fríos y suaves para reducir el "brillo" excesivo de un blanco puro en pantallas durante todo el día.

## Theming y Modos de Color

El sistema soporta cambio dinámico entre modos mediante el atributo `data-theme="dark"` o `data-theme="light"` aplicado al elemento raíz (`<html>`).

- El cambio de tema es instantáneo.
- La preferencia se persiste en `storeConfig.theme` (dentro de la base de datos JSON local).
- Todos los componentes y estilos reaccionan automáticamente a través de variables CSS.
- Los tokens de marca (`brand-*`) **nunca cambian** entre modos para mantener la identidad visual de Tambyto.

**Regla de uso**:
- Dark Tambyto es el modo recomendado para la mayoría de operaciones de caja (mínima fatiga visual).
- Light se recomienda cuando el local tiene mucha luz ambiental o el operador prefiere interfaces claras.

## Tipografía

Se mantienen las fuentes del sistema por defecto para máxima compatibilidad y rendimiento. Las decisiones tipográficas clave son de peso y tamaño:

- **Precios y Total**: `font-weight: 700` + tamaño destacado.
- **Total principal**: `1.75rem` (28px) en Amarillo.
- **Navegación activa**: `font-weight: 600`.
- Cuerpo general: `14px / 1.5`.

## Layout y Espaciado

- Sidebar: Fondo diferenciado (`bg-sidebar` / `bg-sidebar-light`) para que quede en segundo plano en ambos modos.
- Contenido principal: Fondo `bg-main` (o `bg-main-light`).
- Tarjetas y paneles: `bg-card` (o `bg-card-light`) + `border-radius: 8px` (o 12px).
- Espaciado base: múltiplos de 8px (sm: 8px, md: 16px).

El sistema aplica los valores correctos automáticamente según el atributo `data-theme` en el elemento `<html>`.

## Componentes

### A. Barra Lateral de Navegación (Sidebar)

- Fondo: `bg-sidebar` (dark) / `bg-sidebar-light` (light)
- **Elemento activo** ("Ventas (POS)"):
  - Fondo: `brand-magenta` (#C2117A)
  - Texto e ícono: `text-primary` (blanco en dark, oscuro en light) + `font-weight: 600`
- Íconos inactivos (Inventario, Alertas, Caja, etc.): `brand-cyan` (#00B5E2)
- Badge de alertas: mantiene su estilo actual pero puede heredar `brand-yellow` cuando sea crítico.

### B. Buscador de Productos

- Ícono de lupa: `brand-cyan`
- **Estado enfocado (focus)**: borde de 2px en `brand-yellow` (#FFED00).  
  Esto da feedback inmediato de "teclado / escáner activo".

### C. Grid de Productos (Catálogo)

- Tarjeta: fondo `bg-card` (dark) o `bg-card-light` (white), `border-radius: 8px` (o 12px), borde inicial transparente.
- **Hover / Activo**: `transform: translateY(-3px) scale(1.01)`, borde `brand-magenta`, sombra sutil (más suave en light).
- **Precios** (S/. XX.XX): color `brand-yellow` (o versión ligeramente más oscura en light) + peso fuerte.
- **Badge de Stock**:
  - Nivel normal: texto `brand-cyan`
  - Nivel crítico (≤ minStock): texto `brand-yellow`
- **Badge de Categoría**: fondo semitransparente + texto en `brand-magenta` o `brand-cyan` (estilo outline). Funciona en ambos modos.

### D. Panel de Carrito / Detalle de Venta

- **TOTAL (S/. 0.00)**: Elemento más visible de toda la interfaz.
  - Color: `brand-yellow`
  - Tamaño: `1.75rem` (28px)
  - Peso: `700`
- Botón de Cobro / Pagar: fondo `brand-magenta`, texto blanco, tamaño grande y prominente en la parte inferior del panel.

### E. Indicador de Escáner USB

- Color base: `brand-cyan`
- Efecto pulso (ver Animaciones).

### F. Estados de Caja

- Caja Abierta: verde vibrante o `success`
- Caja Cerrada: `text-muted`

## Interacciones y Animaciones

### Hover en Tarjetas de Producto

```css
.product-card {
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  border: 1.5px solid transparent;
}

.product-card:hover,
.product-card:active {
  transform: translateY(-3px) scale(1.01);
  border-color: var(--color-brand-magenta);
  box-shadow: 0 4px 15px rgba(194, 17, 122, 0.2);
}
```

### Efecto Pulso — Escáner Activo

```css
.pulse-indicator {
  width: 8px;
  height: 8px;
  background-color: var(--color-brand-cyan);
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(0, 181, 226, 0.7);
  animation: pulse-animation 2s infinite;
}

@keyframes pulse-animation {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(0, 181, 226, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 8px rgba(0, 181, 226, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(0, 181, 226, 0);
  }
}
```

### Focus de Input de Búsqueda

Borde de 2px sólido en Amarillo (`brand-yellow`) cuando recibe foco. Esto es crítico para indicar que el sistema está listo para recibir código de barras.

## Variables CSS y Sistema de Temas (Implementación)

El sistema usa variables CSS + el atributo `data-theme` en `<html>` para soportar ambos modos.

**Estructura recomendada en `src/index.css`:**

```css
:root {
  /* Colores de marca (invariantes) */
  --color-brand-magenta: #c2117a;
  --color-brand-yellow: #ffed00;
  --color-brand-cyan: #00b5e2;

  /* Alias semánticos */
  --color-accent-cta: var(--color-brand-magenta);
  --color-accent-price: var(--color-brand-yellow);
  --color-accent-system: var(--color-brand-cyan);

  /* Modo Oscuro (valores por defecto) */
  --color-bg-main: #0f0f12;
  --color-bg-card: #161622;
  --color-bg-sidebar: #0c0c12;
  --color-text-primary: #ffffff;
  --color-text-secondary: #a1a1aa;
  --color-text-muted: #71717a;
}

/* Modo Claro */
[data-theme="light"] {
  --color-bg-main: #f4f6f9;
  --color-bg-card: #ffffff;
  --color-bg-sidebar: #eef2f7;
  --color-text-primary: #1f2329;
  --color-text-secondary: #4b5563;
  --color-text-muted: #6b7280;

  /* Ajuste de Amarillo para mejor contraste en fondos claros */
  --color-brand-yellow: #c59f00;
}
```

En el código React se cambia el tema así:
```ts
document.documentElement.setAttribute("data-theme", "light"); // o "dark"
```

El valor se persiste en `storeConfig.theme`.

## Do's and Don'ts

**Do**
- Usar Amarillo exclusivamente para precios, totales y feedback de foco de entrada (en light usa la versión ligeramente más oscura).
- Usar Magenta solo para elementos de acción principal o navegación activa (funciona excelente en ambos modos).
- Respetar el significado de Cian como color de "sistema / no-CTA".
- Dar feedback visual inmediato en el buscador (borde amarillo al enfocar) — funciona en ambos modos.
- Hacer que el TOTAL sea el elemento visualmente más fuerte del carrito.
- Proporcionar un toggle claro entre Dark Tambyto y Light.

**Don't**
- Usar Magenta para texto de precios (compite con el CTA y reduce legibilidad de números).
- Usar Amarillo en botones secundarios o navegación (pierde su poder de "dato crítico").
- Aplicar bordes o fondos vibrantes a elementos que no requieren atención inmediata.
- Olvidar el estado de foco en el input de búsqueda.
- Crear variaciones de los colores de marca por modo (deben permanecer consistentes).

## Beneficios del Rediseño

- **Mayor velocidad de lectura** en caja gracias al contraste superior del Amarillo (ajustado por modo) sobre los fondos.
- **Jerarquía instintiva**: el cajero sabe dónde mirar y dónde hacer clic sin entrenamiento, tanto en dark como en light.
- **Refuerzo de marca**: el software mantiene la identidad Tambyto (Magenta + Amarillo + Cian) en ambos modos y se siente como una extensión del local físico.
- **Flexibilidad operativa**: Soporte real de modo claro para diferentes condiciones de iluminación sin sacrificar la identidad de marca.
- **Preparado para agentes de IA**: al seguir el formato DESIGN.md (con tokens por modo), herramientas como Stitch pueden generar correctamente componentes para cualquiera de los dos temas.

## Próximos Pasos

1. Mantener actualizado este DESIGN.md cuando se agreguen nuevos componentes o se modifiquen tokens.
2. Asegurar que el toggle de tema en Configuración persista correctamente y funcione en hot-reload.
3. Revisar contraste WCAG en modo claro (especialmente Amarillo y Magenta sobre fondos claros).
4. Validar con usuarios reales en caja usando ambos modos (tiempo de confirmación de precio y total).
5. (Opcional) Permitir personalización futura del color de acento manteniendo siempre los tres colores de marca Tambyto.
6. (Opcional) Generar variantes con `npx @google/design.md export` cuando el CLI esté disponible.

---

*Documento creado siguiendo la especificación abierta DESIGN.md de Google Labs (Stitch).*
*Actualizado para soportar ambos modos (Dark Tambyto + Light) manteniendo la identidad de marca.*
