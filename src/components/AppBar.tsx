import { Landmark, Redo2, Save, Share2, Undo2 } from "lucide-react";

type Route = "/" | "/dashboard" | "/einkommensteuer" | "/vergleich";

export function AppBar({
  route,
  scenarioName,
  onScenarioName,
  onNavigate,
  onSave,
}: {
  route: Route;
  scenarioName: string;
  onScenarioName: (name: string) => void;
  onNavigate: (route: Route) => void;
  onSave: () => void;
}) {
  return (
    <header className="app-bar">
      <div className="app-bar-inner">
        <button className="brand-link" onClick={() => onNavigate("/dashboard")} aria-label="Zum Dashboard">
          <span className="brand-mark"><Landmark size={15} /></span>
          <span className="brand-copy">
            <strong>Deutschland-Simulator</strong>
            <small>Rechtsstand 2026 · Datenstand 2025 · DEMO</small>
          </span>
        </button>

        <nav className="top-nav" aria-label="Hauptnavigation">
          <button className={route === "/dashboard" || route === "/" ? "active" : ""} onClick={() => onNavigate("/dashboard")}>Dashboard</button>
          <button className={route === "/einkommensteuer" ? "active" : ""} onClick={() => onNavigate("/einkommensteuer")}>Einkommensteuer</button>
          <button className={route === "/vergleich" ? "active" : ""} onClick={() => onNavigate("/vergleich")}>Vergleich</button>
        </nav>

        <div className="app-actions">
          <input
            aria-label="Szenarioname"
            value={scenarioName}
            onChange={(event) => onScenarioName(event.target.value)}
          />
          <button className="icon-button desktop-action" aria-label="Rückgängig" title="Rückgängig"><Undo2 size={14} /></button>
          <button className="icon-button desktop-action" aria-label="Wiederholen" title="Wiederholen"><Redo2 size={14} /></button>
          <button className="button secondary desktop-action" onClick={onSave}><Save size={14} /> Speichern</button>
          <button className="button primary"><Share2 size={14} /> Teilen</button>
        </div>
      </div>
    </header>
  );
}
