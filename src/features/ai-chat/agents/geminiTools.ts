export const GEMINI_FUNCTION_DECLARATIONS = [
  {
    name: "ejecutar_sql",
    description:
      "Ejecuta una consulta SQL de solo lectura (SELECT/WITH) sobre la base SQLite local de Nifty Retail. Usa json_extract en products.payload.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Consulta SQL SELECT. Incluye LIMIT.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "buscar_productos",
    description: "Busca productos por nombre, código o categoría sin escribir SQL complejo.",
    parameters: {
      type: "OBJECT",
      properties: {
        termino: { type: "STRING", description: "Texto a buscar" },
        limite: { type: "NUMBER", description: "Máximo de resultados (default 10)" },
      },
      required: ["termino"],
    },
  },
  {
    name: "obtener_resumen",
    description: "Obtiene un resumen rápido del negocio: productos, stock crítico, ventas y deudas.",
    parameters: {
      type: "OBJECT",
      properties: {
        foco: {
          type: "STRING",
          description: "general | inventario | ventas | caja",
        },
      },
      required: [],
    },
  },
  {
    name: "navegar",
    description: "Abre una sección de Nifty Retail en la interfaz.",
    parameters: {
      type: "OBJECT",
      properties: {
        ruta: {
          type: "STRING",
          description: "Ruta: /inventario, /caja, /reportes, /kardex, /deudas, /pos, etc.",
        },
        motivo: { type: "STRING", description: "Breve motivo mostrado al usuario" },
      },
      required: ["ruta"],
    },
  },
  {
    name: "rellenar_consulta",
    description: "Coloca texto en el campo de pregunta del chat para que el usuario lo envíe o edite.",
    parameters: {
      type: "OBJECT",
      properties: {
        texto: { type: "STRING", description: "Pregunta sugerida" },
      },
      required: ["texto"],
    },
  },
] as const;

export const GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";