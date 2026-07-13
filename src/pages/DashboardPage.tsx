import { Info, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { icons, type IconName } from "../components/icons";
import { deciles, expenseItems, fmtBn, fmtDiff, households, revenueItems } from "../lib/sim-data";
import type { ScenarioState } from "../lib/types";

type Tab = "budget" | "haushalte" | "verteilung" | "regionen" | "zeit";
type MobileTab = "steuern" | "ergebnis" | "ausgaben" | "szenario";
type RevenueLine = (typeof revenueItems)[number] & { value: number; delta: number };
type ExpenseLine = (typeof expenseItems)[number] & { value: number; delta: number };

export function DashboardPage({
  incomeTaxValue,
  incomeTaxDelta,
  scenarios,
  onNavigateIncomeTax,
  onNavigateComparison,
  onOpenSource,
  onLoadScenario,
  onDeleteScenario,
}: {
  incomeTaxValue: number;
  incomeTaxDelta: number;
  scenarios: ScenarioState[];
  onNavigateIncomeTax: () => void;
  onNavigateComparison: () => void;
  onOpenSource: (metricId: string, value?: string) => void;
  onLoadScenario: (scenario: ScenarioState) => void;
  onDeleteScenario: (scenario: ScenarioState) => void;
}) {
  const [tab, setTab] = useState<Tab>("budget");
  const [mobileTab, setMobileTab] = useState<MobileTab>("ergebnis");

  const revenues = useMemo<RevenueLine[]>(() => revenueItems.map((item) => {
    if (item.id === "est") return { ...item, value: incomeTaxValue, delta: incomeTaxDelta };
    if (item.id === "kredit") return { ...item, value: item.statusQuo - incomeTaxDelta, delta: -incomeTaxDelta };
    return { ...item, value: item.statusQuo, delta: 0 };
  }), [incomeTaxValue, incomeTaxDelta]);
  const expenses = useMemo<ExpenseLine[]>(() => expenseItems.map((item) => ({ ...item, value: item.statusQuo, delta: 0 })), []);

  const revenueTotal = revenues.reduce((sum, item) => sum + item.value, 0);
  const revenueStatusQuo = revenueItems.reduce((sum, item) => sum + item.statusQuo, 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + item.value, 0);
  const expenseStatusQuo = expenseItems.reduce((sum, item) => sum + item.statusQuo, 0);
  const balance = revenueTotal - expenseTotal;
  const balanceStatusQuo = revenueStatusQuo - expenseStatusQuo;

  return (
    <>
      <section className="sticky-kpis" aria-label="Haushaltsübersicht">
        <div className="content-width kpi-grid">
          <KpiCard label="Einnahmen" value={fmtBn(revenueTotal)} delta={fmtDiff(revenueTotal - revenueStatusQuo)} tone={revenueTotal >= revenueStatusQuo ? "positive" : "negative"} onSource={() => onOpenSource("metric-total-revenue", fmtBn(revenueTotal))} />
          <KpiCard label="Ausgaben" value={fmtBn(expenseTotal)} delta={fmtDiff(expenseTotal - expenseStatusQuo)} tone="neutral" onSource={() => onOpenSource("metric-total-expense", fmtBn(expenseTotal))} />
          <KpiCard label="Saldo" value={fmtBn(balance)} delta={fmtDiff(balance - balanceStatusQuo)} tone={balance >= balanceStatusQuo ? "positive" : "negative"} onSource={() => onOpenSource("metric-budget-balance", fmtBn(balance))} />
          <KpiCard label="Schuldenstand" value="2.634,0 Mrd. €" delta={fmtDiff(Math.max(0, -(balance - balanceStatusQuo)))} tone="warning" onSource={() => onOpenSource("metric-public-debt", "2.634,0 Mrd. €")} />
        </div>
      </section>

      <main className="content-width dashboard-main">
        <div className="desktop-dashboard">
          <LinePanel title="Einnahmen" total={revenueTotal} totalMetricId="metric-total-revenue" items={revenues} onOpenSource={onOpenSource} onInteractive={onNavigateIncomeTax} />
          <CenterPanel tab={tab} setTab={setTab} incomeTaxDelta={incomeTaxDelta} onOpenSource={onOpenSource} onNavigateComparison={onNavigateComparison} scenarios={scenarios} onLoadScenario={onLoadScenario} onDeleteScenario={onDeleteScenario} />
          <LinePanel title="Ausgaben" total={expenseTotal} totalMetricId="metric-total-expense" items={expenses} expense onOpenSource={onOpenSource} />
        </div>

        <div className="mobile-dashboard">
          <div className="mobile-tabs" role="tablist" aria-label="Dashboardbereiche">
            {([
              ["steuern", "Steuern"],
              ["ergebnis", "Ergebnis"],
              ["ausgaben", "Ausgaben"],
              ["szenario", "Szenario"],
            ] as const).map(([key, label]) => (
              <button key={key} role="tab" aria-selected={mobileTab === key} className={mobileTab === key ? "active" : ""} onClick={() => setMobileTab(key)}>{label}</button>
            ))}
          </div>
          <div className="mobile-tab-content">
            {mobileTab === "steuern" && <LinePanel title="Einnahmen" total={revenueTotal} totalMetricId="metric-total-revenue" items={revenues} onOpenSource={onOpenSource} onInteractive={onNavigateIncomeTax} />}
            {mobileTab === "ergebnis" && <CenterPanel tab={tab} setTab={setTab} incomeTaxDelta={incomeTaxDelta} onOpenSource={onOpenSource} onNavigateComparison={onNavigateComparison} scenarios={[]} onLoadScenario={onLoadScenario} onDeleteScenario={onDeleteScenario} />}
            {mobileTab === "ausgaben" && <LinePanel title="Ausgaben" total={expenseTotal} totalMetricId="metric-total-expense" items={expenses} expense onOpenSource={onOpenSource} />}
            {mobileTab === "szenario" && <SavedScenarios scenarios={scenarios} onLoad={onLoadScenario} onDelete={onDeleteScenario} />}
          </div>
        </div>
      </main>

      <footer className="app-footer content-width">
        Alle Werte sind gerundete Demonstrationswerte. Datenstand 2025 · Rechtsstand 2026. Ergebnisse sind Schätzungen mit Bandbreiten.
      </footer>
    </>
  );
}

function KpiCard({ label, value, delta, tone, onSource }: { label: string; value: string; delta: string; tone: "positive" | "negative" | "warning" | "neutral"; onSource: () => void }) {
  return (
    <article className="card-flat kpi-card">
      <div className="kpi-head"><span>{label}</span><SourceButton onClick={onSource} /></div>
      <div className="kpi-value-row"><strong>{value}</strong><em className={tone}>{delta}</em></div>
      <small>{label === "Schuldenstand" ? "rd. 62,1 % des BIP · Bandbreite ± 4 %" : "Bund, Länder, Kommunen, Sozialversicherung"}</small>
    </article>
  );
}

function LinePanel({ title, total, totalMetricId, items, expense = false, onOpenSource, onInteractive }: { title: string; total: number; totalMetricId: string; items: Array<RevenueLine | ExpenseLine>; expense?: boolean; onOpenSource: (metricId: string, value?: string) => void; onInteractive?: () => void }) {
  const statusQuo = items.reduce((sum, item) => sum + item.statusQuo, 0);
  return (
    <aside className="card-flat line-panel" aria-label={title}>
      <header>
        <div className="panel-title-row"><h2>{title}</h2><SourceButton onClick={() => onOpenSource(totalMetricId, fmtBn(total))} /></div>
        <div className="panel-total"><strong>{fmtBn(total)}</strong><em className={total >= statusQuo || expense ? "positive" : "negative"}>{fmtDiff(total - statusQuo)}</em></div>
        {expense && <p>direkte Ausgaben sowie separat ausgewiesene Steuervergünstigungen</p>}
      </header>
      <ul>
        {items.map((item) => (
          <LineRow key={item.id} item={item} expense={expense} onClick={item.id === "est" ? onInteractive : undefined} onSource={() => onOpenSource(metricIdForLine(item.id), fmtBn(item.value))} />
        ))}
      </ul>
    </aside>
  );
}

function metricIdForLine(itemId: string) {
  if (itemId === "est") return "metric-income-tax-revenue";
  if (itemId === "kredit") return "metric-budget-balance";
  return "metric-public-budget-lines";
}

function LineRow({ item, expense, onClick, onSource }: { item: RevenueLine | ExpenseLine; expense: boolean; onClick?: () => void; onSource: () => void }) {
  const Icon = icons[item.icon as IconName];
  const positive = expense ? item.delta <= 0 : item.delta >= 0;
  return (
    <li className={`${item.delta !== 0 ? "changed" : ""} ${item.confidence === "niedrig" ? "uncertain" : ""}`}>
      <button className="line-row-main" onClick={onClick} disabled={!onClick} aria-label={onClick ? `${item.label} bearbeiten` : undefined}>
        <span className={`category-icon ${expense ? "expense" : ""}`}><Icon size={14} strokeWidth={1.8} /></span>
        <span className="line-copy"><strong>{item.label}</strong><small>{fmtBn(item.statusQuo)} → <b>{fmtBn(item.value)}</b>{"note" in item && item.note ? ` · ${item.note}` : ""}</small></span>
      </button>
      <span className="line-side">
        <em className={item.delta === 0 ? "neutral" : positive ? "positive" : "negative"}>{fmtDiff(item.delta)}</em>
        <span className={`confidence ${item.confidence}`} title={`Konfidenz ${item.confidence}`} aria-label={`Konfidenz ${item.confidence}`}><i /><i /><i /></span>
        <button className="plain-icon" aria-label={`Quelle für ${item.label}`} onClick={onSource}><Info size={12} /></button>
      </span>
    </li>
  );
}

function CenterPanel({ tab, setTab, incomeTaxDelta, onOpenSource, onNavigateComparison, scenarios, onLoadScenario, onDeleteScenario }: { tab: Tab; setTab: (tab: Tab) => void; incomeTaxDelta: number; onOpenSource: (metricId: string, value?: string) => void; onNavigateComparison: () => void; scenarios: ScenarioState[]; onLoadScenario: (scenario: ScenarioState) => void; onDeleteScenario: (scenario: ScenarioState) => void }) {
  return (
    <section className="center-panel">
      <div className="card-flat result-card">
        <div className="result-tabs">
          {([
            ["budget", "Budget"], ["haushalte", "Haushalte"], ["verteilung", "Verteilung"], ["regionen", "Regionen"], ["zeit", "Zeitverlauf"],
          ] as const).map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
          <div className="result-tabs-actions"><span className="scenario-chip">Reformentwurf A</span><button className="button secondary small" onClick={onNavigateComparison}>Vergleich öffnen</button></div>
        </div>
        <div className="result-content">
          {tab === "budget" && <BudgetTab delta={incomeTaxDelta} onOpenSource={onOpenSource} />}
          {tab === "haushalte" && <HouseholdsTab onOpenSource={onOpenSource} />}
          {tab === "verteilung" && <DistributionTab onOpenSource={onOpenSource} />}
          {tab === "regionen" && <RegionsTab onOpenSource={onOpenSource} />}
          {tab === "zeit" && <TimeTab delta={incomeTaxDelta} onOpenSource={onOpenSource} />}
        </div>
      </div>
      <MigrationCard onOpenSource={onOpenSource} />
      {scenarios.length > 0 && <SavedScenarios scenarios={scenarios} onLoad={onLoadScenario} onDelete={onDeleteScenario} />}
    </section>
  );
}

function BudgetTab({ delta, onOpenSource }: { delta: number; onOpenSource: (metricId: string, value?: string) => void }) {
  const effect = Math.abs(delta);
  return (
    <div className="budget-layout">
      <div>
        <div className="section-title"><div><h3>Wasserfall Budgetsaldo</h3><p>Veränderung gegenüber Status quo. Modellstufe: mit Verhaltenseffekt · Bandbreite ± 25 %.</p></div><SourceButton onClick={() => onOpenSource("metric-budget-balance", fmtDiff(delta))} /></div>
        <Waterfall delta={delta} />
        <div className="plain-language">Der Staat nimmt geschätzt <strong>{effect.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mrd. € {delta <= 0 ? "weniger" : "mehr"} pro Jahr</strong> ein. Das entspricht etwa <strong>{(effect / 22).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %</strong> der öffentlichen Gesamtausgaben.</div>
      </div>
      <div><h3>Sankey · Mittelfluss (vereinfacht)</h3><p className="section-description">Einnahmenquellen fließen zu Ausgabenblöcken. Nur Top-Kategorien.</p><SankeyMini /></div>
    </div>
  );
}

function Waterfall({ delta }: { delta: number }) {
  const newBalance = -39 + delta;
  const bars = [
    { label: "Saldo Status quo", value: -39, height: 112, tone: "total" },
    { label: "Einkommensteuer", value: delta, height: Math.max(28, Math.abs(delta) * 3.2), tone: delta >= 0 ? "positive" : "negative" },
    { label: "Saldo Reform", value: newBalance, height: Math.max(80, Math.abs(newBalance) * 2.4), tone: "total" },
  ];
  return <div className="waterfall" role="img" aria-label="Wasserfalldiagramm des Budgetsaldos">{bars.map((bar) => <div className="waterfall-col" key={bar.label}><span>{bar.value.toLocaleString("de-DE", { maximumFractionDigits: 1 })}</span><i className={bar.tone} style={{ height: `${bar.height}px` }} /><small>{bar.label}</small></div>)}</div>;
}

function SankeyMini() {
  return <div className="sankey-mini" aria-label="Vereinfachter Mittelfluss"><div className="sankey-row"><i style={{ flex: 34 }} /><i style={{ flex: 29 }} /><i style={{ flex: 62 }} /><i style={{ flex: 26 }} /></div><div className="sankey-legend"><span>Einkommensteuer</span><span>Umsatzsteuer</span><span>Sozialbeiträge</span><span>Sonstige</span></div><div className="sankey-bridge" /><div className="sankey-row target"><i style={{ flex: 60 }} /><i style={{ flex: 15 }} /><i style={{ flex: 7 }} /><i style={{ flex: 9 }} /><i style={{ flex: 60 }} /></div><div className="sankey-legend"><span>Soziales</span><span>Gesundheit</span><span>Bildung</span><span>Sicherheit</span><span>Sonstige</span></div></div>;
}

function HouseholdsTab({ onOpenSource }: { onOpenSource: (metricId: string, value?: string) => void }) {
  return <div><div className="section-title"><div><h3>Beispielhaushalte</h3><p className="section-description">Wirkung pro Monat im Reformszenario. Werte sind Modellrechnungen mit Bandbreite.</p></div><SourceButton onClick={() => onOpenSource("metric-household-examples", "+22 € / Monat (Median)")} /></div><div className="household-grid">{households.map((household) => <article className="household-card" key={household.name}><div><strong>{household.name}</strong><small>{household.income}</small></div><em className={household.delta >= 0 ? "positive" : "negative"}>{household.delta >= 0 ? "+" : "−"}{Math.abs(household.delta)} € / Monat</em><p>Dieser Haushalt hat geschätzt {Math.abs(household.delta)} Euro {household.delta >= 0 ? "mehr" : "weniger"} pro Monat, weil er {household.reason}.</p><span>Bandbreite ± 15 %</span></article>)}</div></div>;
}

function DistributionTab({ onOpenSource }: { onOpenSource: (metricId: string, value?: string) => void }) {
  const max = 120;
  return <div><div className="section-title"><div><h3>Nettowirkung nach Einkommensdezilen</h3><p className="section-description">Positive Werte bedeuten mehr verfügbares Haushaltseinkommen.</p></div><SourceButton onClick={() => onOpenSource("metric-income-tax-distribution", "D1 bis D10")} /></div><div className="distribution-bars">{deciles.map((item) => <div key={item.d}><span>{item.d}</span><i><b className={item.reform >= 0 ? "positive" : "negative"} style={{ left: item.reform >= 0 ? "50%" : `${50 - Math.abs(item.reform) / max * 50}%`, width: `${Math.abs(item.reform) / max * 50}%` }} /></i><em className={item.reform >= 0 ? "positive" : "negative"}>{item.reform >= 0 ? "+" : "−"}{Math.abs(item.reform)} €</em></div>)}</div></div>;
}

function RegionsTab({ onOpenSource }: { onOpenSource: (metricId: string, value?: string) => void }) {
  const regions = ["Schleswig-Holstein", "Niedersachsen", "Nordrhein-Westfalen", "Hessen", "Sachsen", "Bayern", "Berlin", "Baden-Württemberg"];
  return <div><div className="section-title"><div><h3>Regionale Wirkung</h3><p className="section-description">Demodarstellung nach Bundesländern; regionale Daten werden in einem späteren Milestone angebunden.</p></div><SourceButton onClick={() => onOpenSource("metric-regional-effects", "+8 bis +29 € / Monat")} /></div><div className="region-layout"><div className="germany-map" aria-label="Stilisierte Deutschlandkarte"><span>SH</span><span>NI</span><span>NW</span><span>HE</span><span>SN</span><span>BY</span><span>BE</span><span>BW</span></div><ul>{regions.map((region, index) => <li key={region}><span>{region}</span><strong>+{8 + index * 3} € / Monat</strong></li>)}</ul></div></div>;
}

function TimeTab({ delta, onOpenSource }: { delta: number; onOpenSource: (metricId: string, value?: string) => void }) {
  return <div><div className="section-title"><div><h3>Zeitverlauf</h3><p className="section-description">Schematische Entwicklung der jährlichen Budgetwirkung.</p></div><SourceButton onClick={() => onOpenSource("metric-time-path", fmtDiff(delta))} /></div><div className="time-chart">{[2026, 2027, 2028, 2029, 2030, 2031].map((year, index) => <div key={year}><span>{(delta * (1 + index * 0.04)).toLocaleString("de-DE", { maximumFractionDigits: 1 })}</span><i style={{ height: `${60 + index * 15}px` }} /><small>{year}</small></div>)}</div></div>;
}

function MigrationCard({ onOpenSource }: { onOpenSource: (metricId: string, value?: string) => void }) {
  return <article className="card-flat migration-card"><div className="section-title"><div><h3>Migration und Asyl · getrennte Teilbereiche</h3><p>Unterbringung, Verfahren, Integration, Bildung und Erwerbstätigkeit werden nicht zu einer scheinbar exakten Einzelzahl vermischt.</p></div><SourceButton onClick={() => onOpenSource("metric-migration-components", "29,8 Mrd. €")} /></div><div className="migration-grid"><span><b>9,8</b> Unterbringung</span><span><b>5,1</b> Verfahren</span><span><b>4,4</b> Integration</span><span><b>10,5</b> weitere Bereiche</span></div></article>;
}

function SavedScenarios({ scenarios, onLoad, onDelete }: { scenarios: ScenarioState[]; onLoad: (scenario: ScenarioState) => void; onDelete: (scenario: ScenarioState) => void }) {
  return <section className="card-flat saved-scenarios"><header><div><span className="eyebrow">Lokaler Worker · IndexedDB</span><h3>Gespeicherte Szenarien</h3></div><strong>{scenarios.length}</strong></header>{scenarios.length === 0 ? <p className="empty-state">Noch kein Szenario gespeichert.</p> : <ul>{scenarios.map((scenario) => <li key={scenario.id}><button onClick={() => onLoad(scenario)}><strong>{scenario.name}</strong><small>{new Date(scenario.updatedAt).toLocaleString("de-DE")}</small></button><button className="plain-icon delete" aria-label={`${scenario.name} löschen`} onClick={() => onDelete(scenario)}><Trash2 size={14} /></button></li>)}</ul>}</section>;
}

function SourceButton({ onClick }: { onClick: () => void }) {
  return <button className="source-badge" onClick={onClick}><Info size={10} /> Quelle</button>;
}
