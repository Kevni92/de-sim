import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { EffectsRoute } from "./EffectsRoute";
import "./styles.css";
import "./dashboard-disabled.css";
import "./evidence-tooltips.css";
import "./milestone2.css";
import "./transparency.css";
import "./income-tax.css";
import "./income-tax-population.css";
import "./revenue-modules.css";
import "./reform-result-layout.css";
import "./expense-modules.css";
import "./sgb2-ui.css";
import "./population.css";
import "./model-basis-status.css";
import "./effects.css";
import "./scenario-calculation.css";

function Root() {
  const [hash, setHash] = useState(window.location.hash.replace(/^#/, "") || "/");
  useEffect(() => {
    const listener = () => setHash(window.location.hash.replace(/^#/, "") || "/");
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  return hash === "/wirkungen" ? <EffectsRoute /> : <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
