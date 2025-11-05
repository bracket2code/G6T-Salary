import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

registerSW({
  immediate: true,
  onNeedRefresh() {
    console.info("Nueva versión lista, recarga para actualizar.");
  },
  onOfflineReady() {
    console.info("La app está lista para usarse sin conexión.");
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
