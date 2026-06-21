import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

if (window.location.pathname.replace(/\/+$/, "") === "/event-gateway") {
  window.history.replaceState(
    null,
    "",
    `/${window.location.search}${window.location.hash}`,
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
