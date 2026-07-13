import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Baby,
  Building2,
  Coins,
  FileText,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Landmark,
  Save,
  Shield,
  ShoppingCart,
  Stethoscope,
  Trash2,
  Wallet,
} from "lucide-react";
import { SourceDrawer } from "./components/SourceDrawer";
import { localServer } from "./lib/local-server-client";
import type { ScenarioState, SourceRecord } from "./lib/types";

const revenues = [
  { id: "est", label: "Einkommensteuer", value: 339.8, delta: -18.4, icon: Wallet },
  { id: "ust", label: "Umsatzsteuer", value: 291.4, delta: 0, icon: ShoppingCart },
  { id: "sozb", label: "Sozialbeiträge", value: 620.0, delta: 0, icon: Coins },
  { id: "kst", label: "Unternehmenssteuern", value: 121.4, delta: 0, icon: Building2 },
  { id: "kredit", label: "Nettokreditaufnahme", value: 57.4, delta: 18.4, icon: Landmark },
];

const expenses = [
  { id: "rente", label: "Rente", value: 128.4, icon: HandCoins },
  { id: "gesundheit", label: "Gesundheit", value: 92.1, icon: Stethoscope },
  { id: "pflege", label: "Pflege", value: 61.7, icon: HeartPulse },
  { id: "familie", label: "Familie und Kitas", value: 63.7, icon: Baby },
  { id: "bildung", label: "Bildung", value: 22.6, icon: GraduationCap },
  { id: "verteidigung", label: "Verteidigung", value: 71.8, icon: Shield },
  { id: "verwaltung", label: "Verwaltung", value: 42.0, icon: FileText },
];

const money = (value: number) =>
  `${value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mrd. €`;

export function App() {
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [selectedSource, setSelectedSource] = useState<SourceRecord | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioState[]>([]);
  const [scenarioName, setScenarioName] = useState("Reformentwurf A");
  const [notice, setNotice] = useState("");

  const refreshScenarios = async () => setScenarios(await localServer.listScenarios());

  useEffect(() => {
    void localServer.listSources().then(setSources);
    void refreshScenarios();
  }, []);

  const income = useMemo(() => revenues.reduce((sum, item) => sum + item.value, 0), []);
  const spending = useMemo(() => expenses.reduce((sum, item) => sum + item.value, 0), []);
  const balance = income - spending;

  const openSource = (id = "source-budget") => {
    setSelectedSource(sources.find((source) => source.id === id) ?? sources[0] ?? null);
  };

  const saveScenario = async () => {
    const now = new Date().toISOString();
    const existing = scenarios.find((scenario) => scenario.name === scenarioName);
    await localServer.saveScenario({
      id: existing?.id ?? crypto.randomUUID(),
      name: scenarioName.trim() || "Unbenanntes Szenario",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      modelLevel: "verhalten",
      revenueChanges: { est: -18.4, kredit: 18.4 },
      expenseChanges: {},
    });
    await refreshScenarios();
    setNotice("Szenario lokal gespeichert");
    window.setTimeout(() => setNotice(""), 2200);
  };

  const loadScenario = (scenario: ScenarioState) => {
    setScenarioName(scenario.name);
    setNotice(`„${scenario.name}“ geladen`);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const deleteScenario = async (scenario: ScenarioState) => {
    await localServer.deleteScenario(scenario.id);
    await refreshScenarios();
  };

  return (
    <div className="app-shell">
      <header className="app-bar">
        <div className="brand">
          <span className="brand-mark"><Landmark size={16} /></span>
          <span>
            <strong>Deutschland-Simulator</strong>
            <small>Rechtsstand 2026 · Datenstand 2025 · DEMO</small>
          </span>
        </div>
        <nav aria-label="Hauptnavigation">
          <a className="active" href="#dashboard">Dashboard</a>
          <a href="#methodik">Methodik</a>
        </nav>
        <div className="actions">
          <input aria-label="Szenarioname" value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} />
          <button className="button secondary" onClick={saveScenario}><Save size={15} /> Speichern</button>
        </div>
      </header>

      <section className="kpi-strip" aria-label="Haushaltsübersicht">
        <Kpi label="Einnahmen" value={money(income)} delta="−18,4 Mrd. €" tone="negative" onSource={() => openSource()} />
        <Kpi label="Ausgaben" value={money(spending)} delta="±0,0 Mrd. €" onSource={() => openSource()} />
        <Kpi label="Saldo" value={money(balance)} delta="−18,4 Mrd. €" tone="negative" onSource={() => openSource()} />
        <Kpi label="Schuldenstand" value="2.634,0 Mrd. €" delta="+18,4 Mrd. €" tone="warning" onSource={() => openSource()} />
      </section>

      <main id="dashboard" className="workspace">
        <Panel title="Einnahmen" total={money(income)}>
          {revenues.map((item) => (
            <LineItem
              key={item.id}
              {...item}
              source={() => openSource(item.id === "est" ? "source-est" : "source-budget")}
            />
          ))}
        </Panel>

        <section className="center-column">
          <div className="card tabs-card">
            <div className="tabs">
              <button className="active">Budget</button>
              <button>Haushalte</button>
              <button>Verteilung</button>
              <button>Regionen</button>
              <button>Zeitverlauf</button>
            </div>
            <div className="card-body">
              <div className="section-heading">
                <div>
                  <h1>Wirkung des Reformentwurfs</h1>
                  <p>Status quo und Szenario werden getrennt dargestellt. Alle Werte sind Demonstrationswerte.</p>
                </div>
                <button className="source-button" onClick={() => openSource()}>Quelle</button>
              </div>
              <div className="impact-grid">
                <div className="impact-chart" aria-label="Budgetwirkung">
                  <span style={{ height: "55%" }}><i>Status quo</i><b>−39,0</b></span>
                  <span className="negative" style={{ height: "78%" }}><i>Einkommensteuer</i><b>−18,4</b></span>
                  <span style={{ height: "82%" }}><i>Neuer Saldo</i><b>−57,4</b></span>
                </div>
                <div className="explanation">
                  <span className="eyebrow">Klartext</span>
                  <p>
                    Der Staat nimmt in diesem Szenario geschätzt <strong>18,4 Milliarden Euro weniger pro Jahr</strong> ein.
                    Die Bandbreite wird in späteren Modellstufen aus der Evidenzdatenbank berechnet.
                  </p>
                </div>
              </div>
              <h2>Verteilung nach Einkommensgruppen</h2>
              <div className="bars">
                {[12, 20, 35, 48, 60, 72, 84, 94, 78, 45].map((width, index) => (
                  <div key={index}>
                    <span>D{index + 1}</span>
                    <i><b style={{ width: `${width}%` }} /></i>
                    <em>+{Math.round(width / 3)} €</em>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <section className="card saved-card" aria-labelledby="saved-title">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Lokaler Worker · IndexedDB</span>
                <h2 id="saved-title">Gespeicherte Szenarien</h2>
              </div>
              <span>{scenarios.length}</span>
            </div>
            <div className="saved-list">
              {scenarios.length === 0 ? (
                <p className="empty">Noch kein Szenario gespeichert.</p>
              ) : scenarios.map((scenario) => (
                <div className="saved-row" key={scenario.id}>
                  <button onClick={() => loadScenario(scenario)}>
                    <strong>{scenario.name}</strong>
                    <small>{new Date(scenario.updatedAt).toLocaleString("de-DE")}</small>
                  </button>
                  <button className="icon-button" aria-label={`${scenario.name} löschen`} onClick={() => deleteScenario(scenario)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </section>

        <Panel title="Ausgaben" total={money(spending)} expense>
          {expenses.map((item) => (
            <LineItem key={item.id} {...item} delta={0} source={() => openSource()} expense />
          ))}
        </Panel>
      </main>

      <footer id="methodik">
        Alle Werte sind gerundete Demonstrationswerte. Quellen, Datenjahr und Unsicherheit sind je Kennzahl nachvollziehbar.
      </footer>
      {notice && <div className="toast" role="status">{notice}</div>}
      <SourceDrawer source={selectedSource} onClose={() => setSelectedSource(null)} />
    </div>
  );
}

function Kpi({ label, value, delta, tone = "neutral", onSource }: {
  label: string;
  value: string;
  delta: string;
  tone?: string;
  onSource: () => void;
}) {
  return (
    <article className="kpi card">
      <div><span>{label}</span><button onClick={onSource}>Quelle</button></div>
      <strong>{value}</strong>
      <small className={tone}>{delta}</small>
    </article>
  );
}

function Panel({ title, total, children, expense = false }: {
  title: string;
  total: string;
  children: ReactNode;
  expense?: boolean;
}) {
  return (
    <aside className="card panel">
      <div className="panel-header">
        <div><span className="eyebrow">{expense ? "Staatsausgaben" : "Staatseinnahmen"}</span><h2>{title}</h2></div>
        <strong>{total}</strong>
      </div>
      <div className="line-list">{children}</div>
    </aside>
  );
}

function LineItem({ label, value, delta, icon: Icon, source, expense = false }: {
  label: string;
  value: number;
  delta: number;
  icon: ComponentType<{ size?: number }>;
  source: () => void;
  expense?: boolean;
}) {
  return (
    <div className="line-item">
      <span className={`line-icon ${expense ? "expense" : ""}`}><Icon size={15} /></span>
      <div><strong>{label}</strong><small>{money(value)}</small></div>
      <div>
        <em className={delta < 0 ? "negative" : delta > 0 ? "warning" : "neutral"}>
          {delta === 0 ? "±0,0" : `${delta > 0 ? "+" : "−"}${Math.abs(delta).toLocaleString("de-DE")}`}
        </em>
        <button aria-label={`Quelle für ${label}`} onClick={source}>i</button>
      </div>
    </div>
  );
}
