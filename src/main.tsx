// Polyfills run first (Buffer), then App loads dynamically.
import "./polyfills";
import "./index.css";
import { createRoot } from "react-dom/client";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("root element not found");

void import("./App").then(({ default: App }) => {
  createRoot(rootEl).render(<App />);
});
