import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

const rootEl = document.getElementById("root");

function showBootError(message: string) {
  if (!rootEl) return;
  rootEl.innerHTML = `
    <div style="padding:32px;font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;">
      <h2 style="margin:0 0 12px;color:#b91c1c;">Nifty Retail no pudo iniciar</h2>
      <p style="color:#555;line-height:1.5;">${message}</p>
      <p style="color:#888;font-size:13px;">Si usas el instalador del Escritorio, reinstala con la versión más reciente.</p>
    </div>
  `;
}

if (!rootEl) {
  throw new Error("No se encontró #root");
}

try {
  const bootFallback = document.getElementById("boot-fallback");
  bootFallback?.remove();
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (err) {
  console.error(err);
  showBootError((err as Error).message || "Error desconocido al iniciar la interfaz.");
}
