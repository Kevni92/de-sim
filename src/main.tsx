import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./dashboard-disabled.css";
import "./evidence-tooltips.css";
import "./milestone2.css";
import "./transparency.css";
import "./income-tax.css";
import "./income-tax-population.css";
import "./revenue-modules.css";
import "./expense-modules.css";
import "./population.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
