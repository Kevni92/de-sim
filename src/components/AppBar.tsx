import { useEffect, useState } from "react";
import { Moon, Redo2, Save, SlidersHorizontal, Sun, Undo2 } from "lucide-react";
import { haushaltsKompassDarkLogo, haushaltsKompassLightLogo } from "../branding";
import "../branding-theme.css";

export type AppRoute = "/" | "/dashboard" | "/einkommensteuer" | "/einnahmen" | "/ausgaben" | "/vergleich" | "/transparenz";
type AppTheme = "light" | "dark";

const themeStorageKey = "haushaltskompass-theme";

function readTheme(): AppTheme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function AppBar({
  route,
  scenarioName,
  legalYear,
  dataYear,
  canUndo,
  canRedo,
  onScenarioName,
  onNavigate,
  onUndo,
  onRedo,
  onSave,
  onOpenScenario,
}: {
  route: AppRoute;
  scenarioName: string;
  legalYear: number;
  dataYear: number;
  canUndo: boolean;
  canRedo: boolean;
  onScenarioName: (name: string) => void;
  onNavigate: (route: AppRoute) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onOpenScenario: () => void;
}) {
  const [theme, setTheme] = useState<AppTheme>(readTheme);
  const darkMode = theme === "dark";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", darkMode ? "#0e141d" : "#f4f7fa");
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {
      // Die Darstellung bleibt auch ohne verfügbaren Browserspeicher aktiv.
    }
  }, [darkMode, theme]);

  return (
    <header className="app-bar">
      <div className="app-bar-inner">
        <button className="brand-link" onClick={() => onNavigate("/dashboard")} aria-label="Zum HaushaltsKompass-Dashboard">
          <img
            className="brand-logo"
            src={darkMode ? haushaltsKompassDarkLogo : haushaltsKompassLightLogo}
            alt=""
            aria-hidden="true"
          />
          <span className="brand-copy"><strong>HaushaltsKompass</strong><small>Rechtsstand {legalYear} · Datenstand {dataYear} · MODELL</small></span>
        </button>
        <nav className="top-nav" aria-label="Hauptnavigation">
          <button className={route === "/dashboard" || route === "/" ? "active" : ""} onClick={() => onNavigate("/dashboard")}>Dashboard</button>
          <button className={route === "/einkommensteuer" ? "active" : ""} onClick={() => onNavigate("/einkommensteuer")}>Einkommensteuer</button>
          <button className={route === "/einnahmen" ? "active" : ""} onClick={() => onNavigate("/einnahmen")}>Weitere Einnahmen</button>
          <button className={route === "/ausgaben" ? "active" : ""} onClick={() => onNavigate("/ausgaben")}>Ausgaben</button>
          <button className={route === "/vergleich" ? "active" : ""} onClick={() => onNavigate("/vergleich")}>Vergleich</button>
          <button className={route === "/transparenz" ? "active" : ""} onClick={() => onNavigate("/transparenz")}>Transparenz</button>
        </nav>
        <div className="app-actions">
          <input aria-label="Szenarioname" value={scenarioName} onChange={(event) => onScenarioName(event.target.value)} />
          <button
            className="icon-button theme-toggle"
            aria-label={darkMode ? "Hellen Modus aktivieren" : "Dunklen Modus aktivieren"}
            title={darkMode ? "Hellen Modus aktivieren" : "Dunklen Modus aktivieren"}
            aria-pressed={darkMode}
            onClick={() => setTheme(darkMode ? "light" : "dark")}
          >
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button className="icon-button desktop-action" aria-label="Rückgängig" title="Rückgängig" onClick={onUndo} disabled={!canUndo}><Undo2 size={14} /></button>
          <button className="icon-button desktop-action" aria-label="Wiederholen" title="Wiederholen" onClick={onRedo} disabled={!canRedo}><Redo2 size={14} /></button>
          <button className="button secondary desktop-action" onClick={onSave}><Save size={14} /> Speichern</button>
          <button className="button primary" onClick={onOpenScenario}><SlidersHorizontal size={14} /> Szenario</button>
        </div>
      </div>
    </header>
  );
}
