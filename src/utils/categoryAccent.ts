export interface CategoryAccent {
  bg: string;
  border: string;
  text: string;
  glow: string;
}

const PALETTE: CategoryAccent[] = [
  {
    bg: "rgba(194, 17, 122, 0.14)",
    border: "rgba(194, 17, 122, 0.32)",
    text: "#f472b6",
    glow: "rgba(194, 17, 122, 0.22)",
  },
  {
    bg: "rgba(0, 181, 226, 0.14)",
    border: "rgba(0, 181, 226, 0.32)",
    text: "#67d9f0",
    glow: "rgba(0, 181, 226, 0.22)",
  },
  {
    bg: "rgba(255, 237, 0, 0.1)",
    border: "rgba(255, 237, 0, 0.28)",
    text: "#fde047",
    glow: "rgba(255, 237, 0, 0.18)",
  },
  {
    bg: "rgba(34, 197, 94, 0.12)",
    border: "rgba(34, 197, 94, 0.28)",
    text: "#4ade80",
    glow: "rgba(34, 197, 94, 0.2)",
  },
  {
    bg: "rgba(139, 92, 246, 0.14)",
    border: "rgba(139, 92, 246, 0.3)",
    text: "#a78bfa",
    glow: "rgba(139, 92, 246, 0.2)",
  },
  {
    bg: "rgba(249, 115, 22, 0.12)",
    border: "rgba(249, 115, 22, 0.28)",
    text: "#fb923c",
    glow: "rgba(249, 115, 22, 0.2)",
  },
];

export function getCategoryAccent(category: string): CategoryAccent {
  let hash = 0;
  for (let i = 0; i < category.length; i += 1) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function shortProductCode(code: string): string {
  if (code.length <= 8) return code;
  return `…${code.slice(-6)}`;
}