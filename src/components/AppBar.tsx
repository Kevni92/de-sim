import { Landmark, Redo2, Save, SlidersHorizontal, Undo2 } from "lucide-react";

export type AppRoute = "/" | "/dashboard" | "/einkommensteuer" | "/einnahmen" | "/vergleich" | "/transparenz";

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
  return (
    <header className="app-bar">
      <div className="app-bar-inner">
        <button className="brand-link" onClick={() => onNavigate("/dashboard")} aria-label="Zum Dashboard">
          <span className="brand-mark"><Landmark size={15} /></span>
          <span className="brand-copy">
            <strong>Deutschland-Simulator</strong>
            <small>Rechtsstand {legalYear} · Datenstand {dataYear} · MODELL</small>
          </span>
        </button>

        <nav className="top-nav" aria-label="Hauptnavigation">
          <button className={route === "/dashboard" || route === "/" ? "active" : ""} onClick={() => onNavigate("/dashboard")}>Dashboard</button>
          <button className={route === "/einkommensteuer" ? "active" : ""} onClick={() => onNavigate("/einkommensteuer")}>Einkommensteuer</button>
          <button className={route === "/einnahmen" ? "active" : ""} onClick={() => onNavigate("/einnahmen")}>Weitere Einnahmen</button>
          <button className={route === "/vergleich" ? "active" : ""} onClick={() => onNavigate("/vergleich")}>Vergleich</button>
          <button className={route === "/transparenz" ? "active" : ""} onClick={() => onNavigate("/transparenz")}>Transparenz</button>
        </nav>

        <div className="app-actions">
          <input
            aria-label="Szenarioname"
            value={scenarioName}
            onChange={(event) => onScenarioName(event.target.value)}
          />
          <button className="icon-button desktop-action" aria-label="Rückgängig" title="Rückgängig" onClick={onUndo} disabled={!canUndo}><Undo2 size={14} /></button>
          <button className="icon-button desktop-action" aria-label="Wiederholen" title="Wiederholen" onClick={onRedo} disabled={!canRedo}><Redo2 size={14} /></button>
          <button className="button secondary desktop-action" onClick={onSave}><Save size={14} /> Speichern</button>
          <button className="button primary" onClick={onOpenScenario}><SlidersHorizontal size={14} /> Szenario</button>
        </div>
      </div>
    </header>
  );
}
