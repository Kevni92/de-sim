import { Info, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { icons, type IconName } from "../components/icons";
import type { IncomeTaxResult } from "../lib/income-tax";
import {
  revenueModuleIds,
  revenueResultsById,
  type RevenueModuleId,
  type RevenueModuleResult,
} from "../lib/revenue-modules";
import { expenseItems, fmtBn, fmtDiff, revenueItems } from "../lib/sim-data";
import type { ScenarioState } from "../lib/types";

type Tab = "budget" | "haushalte" | "verteilung" | "regionen" | "zeit";
type MobileTab = "steuern" | "ergebnis" | "ausgaben" | "szenario";
type RevenueLine = (typeof revenueItems)[number] & { value: number; delta: number };
type ExpenseLine = (typeof expenseItems)[number] & { value: number; delta: number };

export function DashboardPage({
  incomeTaxResult,
  revenueModuleResults,
  scenarios,
  onNavigateIncomeTax,
  onNavigateRevenue,
  onNavigateComparison,
  onOpenSource,
  onLoadScenario,
  onDeleteScenario,
}: {
  incomeTaxResult: IncomeTaxResult;
  revenueModuleResults: RevenueModuleResult[];
  scenarios: ScenarioState[];
  onNavigateIncomeTax: () => void;
  onNavigateRevenue: (id: RevenueModuleId) => void;
  onNavigateComparison: () => void;
  onOpenSource: (metricId: string, value?: string) => void;
  onLoadScenario: (scenario: ScenarioState) => void;
  onDeleteScenario: (scenario: ScenarioState) => void;
}) {
  const [tab, setTab] = useState<Tab>("budget");
  const [mobileTab, setMobileTab] = useState<MobileTab>("ergebnis");
  const revenueModulesById = useMemo(() => revenueResultsById(revenueModuleResults), [revenueModuleResults]);

  const revenues = useMemo<RevenueLine[]>(() => revenueItems.map((item) => {
    if (item.id === "est") return { ...item, value: incomeTaxResult.value, delta: incomeTaxResult.delta };
    if (revenueModuleIds.includes(item.id as RevenueModuleId)) {
      const result = revenueModulesById[item.id as RevenueModuleId];
      return { ...item, value: result.value, delta: result.delta };
    }
    return { ...item, value: item.statusQuo, delta: 0 };
  }), [incomeTaxResult.delta, incomeTaxResult.value, revenueModulesById]);
  const expenses = useMemo<ExpenseLine[]>(() => expenseItems.map((item) => ({ ...item, value: item.statusQuo, delta: 0 })), []);

  const revenueTotal = revenues.reduce((sum, item) => sum + item.value, 0);
  const revenueStatusQuo = revenueItems.reduce((sum, item) => sum + item.statusQuo, 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + item.value, 0);
  const expenseStatusQuo = expenseItems.reduce((sum, item) => sum + item.statusQuo, 0);
  const balance = revenueTotal - expenseTotal;
  const balanceStatusQuo = revenueStatusQuo - expenseStatusQuo;
  const totalRevenueDelta = incomeTaxResult.delta + revenueModuleResults.reduce((sum, item) => sum + item.delta, 0);

  const openRevenueItem = (itemId: string) => {
    if (itemId === "est") onNavigateIncomeTax();
    else if (revenueModuleIds.includes(itemId as RevenueModuleId)) onNavigateRevenue(itemId as RevenueModuleId);
  };

  const centerProps = { tab, setTab, incomeTaxResult, revenueModuleResults, totalRevenueDelta, onOpenSource, onNavigateComparison, onLoadScenario, onDeleteScenario };

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
          <LinePanel title="Einnahmen" total={revenueTotal} totalMetricId="metric-total-revenue" items={revenues} onOpenSource={onOpenSource} onInteractive={openRevenueItem} />
          <CenterPanel {...centerProps} scenarios={scenarios} />
          <LinePanel title="Ausgaben" total={expenseTotal} totalMetricId="metric-total-expense" items={expenses} expense onOpenSource={onOpenSource} />
        </div>

        <div className="mobile-dashboard">
          <div className="mobile-tabs" role="tablist" aria-label="Dashboardbereiche">
            {([ ["steuern", "Steuern"], ["ergebnis", "Ergebnis"], ["ausgaben", "Ausgaben"], ["szenario", "Szenario"] ] as const).map(([key, label]) => (
              <button key={key} role="tab" aria-selected={mobileTab === key} className={mobileTab === key ? "active" : ""} onClick={() => setMobileTab(key)}>{label}</button>
            ))}
          </div>
          <div className="mobile-tab-content">
            {mobileTab === "steuern" && <LinePanel title="Einnahmen" total={revenueTotal} totalMetricId="metric-total-revenue" items={revenues} onOpenSource={onOpenSource} onInteractive={openRevenueItem} />}
            {mobileTab === "ergebnis" && <CenterPanel {...centerProps} scenarios={[]} />}
            {mobileTab === "ausgaben" && <LinePanel title="Ausgaben" total={expenseTotal} totalMetricId="metric-total-expense" items={expenses} expense onOpenSource={onOpenSource} />}
            {mobileTab === "szenario" && <SavedScenarios scenarios={scenarios} onLoad={onLoadScenario} onDelete={onDeleteScenario} />}
          </div>
        </div>
      </main>

      <footer className="app-footer content-width">
        Einkommensteuer: Tarifmodell 2026. Weitere Einnahmen: transparente Aggregatmodelle mit getrennten statischen und verhaltensbedingten Wirkungen.
      </footer>
    </>
  );
}

function KpiCard({ label, value, delta, tone, onSource }: { label: string; value: string; delta: string; tone: "positive" | "negative" | "warning" | "neutral"; onSource: () => void }) {
  return <article className="card-flat kpi-card"><div className="kpi-head"><span>{label}</span><SourceButton onClick={onSource} /></div><div className="kpi-value-row"><strong>{value}</strong><em className={tone}>{delta}</em></div><small>{label === "Schuldenstand" ? "rd. 62,1 % des BIP · Bandbreite ± 4 %" : "Bund, Länder, Kommunen, Sozialversicherung"}</small></article>;
}

function LinePanel({ title, total, totalMetricId, items, expense = false, onOpenSource, onInteractive }: { title: string; total: number; totalMetricId: string; items: Array<RevenueLine | ExpenseLine>; expense?: boolean; onOpenSource: (metricId: string, value?: string) => void; onInteractive?: (itemId: string) => void }) {
  const statusQuo = items.reduce((sum, item) => sum + item.statusQuo, 0);
  return <aside className="card-flat line-panel" aria-label={title}><header><div className="panel-title-row"><h2>{title}</h2><SourceButton onClick={() => onOpenSource(totalMetricId, fmtBn(total))} /></div><div className="panel-total"><strong>{fmtBn(total)}</strong><em className={total >= statusQuo || expense ? "positive" : "negative"}>{fmtDiff(total - statusQuo)}</em></div>{expense && <p>direkte Ausgaben sowie separat ausgewiesene Steuervergünstigungen</p>}</header><ul>{items.map((item) => { const interactive = item.id === "est" || revenueModuleIds.includes(item.id as RevenueModuleId); return <LineRow key={item.id} item={item} expense={expense} onClick={interactive && onInteractive ? () => onInteractive(item.id) : undefined} onSource={() => onOpenSource(metricIdForLine(item.id), fmtBn(item.value))} />; })}</ul></aside>;
}

function metricIdForLine(itemId: string) {
  if (itemId === "est") return "metric-income-tax-revenue";
  if (revenueModuleIds.includes(itemId as RevenueModuleId)) return `metric-revenue-${itemId}`;
  if (itemId === "kredit") return "metric-budget-balance";
  return "metric-public-budget-lines";
}

function LineRow({ item, expense, onClick, onSource }: { item: RevenueLine | ExpenseLine; expense: boolean; onClick?: () => void; onSource: () => void }) {
  const Icon = icons[item.icon as IconName];
  const positive = expense ? item.delta <= 0 : item.delta >= 0;
  return <li className={`${item.delta !== 0 ? "changed" : ""} ${item.confidence === "niedrig" ? "uncertain" : ""}`}><button className="line-row-main" onClick={onClick} disabled={!onClick} aria-label={onClick ? `${item.label} bearbeiten` : undefined}><span className={`category-icon ${expense ? "expense" : ""}`}><Icon size={14} strokeWidth={1.8} /></span><span className="line-copy"><strong>{item.label}</strong><small>{fmtBn(item.statusQuo)} → <b>{fmtBn(item.value)}</b>{"note" in item && item.note ? ` · ${item.note}` : ""}</small></span></button><span className="line-side"><em className={item.delta === 0 ? "neutral" : positive ? "positive" : "negative"}>{fmtDiff(item.delta)}</em><span className={`confidence ${item.confidence}`} title={`Konfidenz ${item.confidence}`} aria-label={`Konfidenz ${item.confidence}`}><i /><i /><i /></span><button className="plain-icon" aria-label={`Quelle für ${item.label}`} onClick={onSource}><Info size={12} /></button></span></li>;
}

function CenterPanel({ tab, setTab, incomeTaxResult, revenueModuleResults, totalRevenueDelta, onOpenSource, onNavigateComparison, scenarios, onLoadScenario, onDeleteScenario }: { tab: Tab; setTab: (tab: Tab) => void; incomeTaxResult: IncomeTaxResult; revenueModuleResults: RevenueModuleResult[]; totalRevenueDelta: number; onOpenSource: (metricId: string, value?: string) => void; onNavigateComparison: () => void; scenarios: ScenarioState[]; onLoadScenario: (scenario: ScenarioState) => void; onDeleteScenario: (scenario: ScenarioState) => void }) {
  return <section className="center-panel"><div className="card-flat result-card"><div className="result-tabs">{([ ["budget", "Budget"], ["haushalte", "Haushalte"], ["verteilung", "Verteilung"], ["regionen", "Regionen"], ["zeit", "Zeitverlauf"] ] as const).map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}<div className="result-tabs-actions"><span className="scenario-chip">8 Einnahmemodule</span><button className="button secondary small" onClick={onNavigateComparison}>Vergleich öffnen</button></div></div><div className="result-content">{tab === "budget" && <BudgetTab result={incomeTaxResult} revenueModuleResults={revenueModuleResults} totalDelta={totalRevenueDelta} onOpenSource={onOpenSource} />}{tab === "haushalte" && <HouseholdsTab result={incomeTaxResult} onOpenSource={onOpenSource} />}{tab === "verteilung" && <DistributionTab result={incomeTaxResult} onOpenSource={onOpenSource} />}{tab === "regionen" && <RegionsTab onOpenSource={onOpenSource} />}{tab === "zeit" && <TimeTab totalDelta={totalRevenueDelta} onOpenSource={onOpenSource} />}</div></div><MigrationCard onOpenSource={onOpenSource} />{scenarios.length > 0 && <SavedScenarios scenarios={scenarios} onLoad={onLoadScenario} onDelete={onDeleteScenario} />}</section>;
}

function BudgetTab({ result, revenueModuleResults, totalDelta, onOpenSource }: { result: IncomeTaxResult; revenueModuleResults: RevenueModuleResult[]; totalDelta: number; onOpenSource: (metricId: string, value?: string) => void }) {
  const behavior = result.behavioralAdjustment + revenueModuleResults.reduce((sum, item) => sum + item.behavioralAdjustment, 0);
  const staticDelta = result.staticDelta + revenueModuleResults.reduce((sum, item) => sum + item.staticDelta, 0);
  return <div className="budget-layout"><div><div className="section-title"><div><h3>Wasserfall Budgetsaldo</h3><p>Gesamte Wirkung aller aktiven Einnahmemodule · Modellstufe {modelLabel(result.modelLevel)}.</p></div><SourceButton onClick={() => onOpenSource("metric-total-revenue", fmtDiff(totalDelta))} /></div><Waterfall delta={totalDelta} /><div className="plain-language">Die aktiven Steuer- und Beitragsparameter verändern die Einnahmen insgesamt um <strong>{fmtDiff(totalDelta)} pro Jahr</strong>. Die Nettokreditaufnahme bleibt als eigener Ausgangsposten unverändert und verdeckt die Budgetwirkung nicht.</div></div><div><h3>Statisch und mit Reaktion</h3><p className="section-description">Alle Module weisen die Erstwirkung und die angenommene Anpassungsreaktion getrennt aus.</p><div className="budget-model-compare"><span><b>{fmtDiff(staticDelta)}</b>statische Wirkung</span><span><b>{fmtDiff(behavior)}</b>Verhaltenskomponente</span><span><b>{revenueModuleResults.filter((item) => Math.abs(item.delta) >= 0.05).length + 1}</b>aktive Modellwerte</span></div><div className="module-delta-list">{revenueModuleResults.map((item) => <span key={item.id}><small>{item.label}</small><b className={item.delta >= 0 ? "positive" : "negative"}>{fmtDiff(item.delta)}</b></span>)}</div></div></div>;
}

function Waterfall({ delta }: { delta: number }) {
  const newBalance = -39 + delta;
  const bars = [
    { label: "Saldo Status quo", value: -39, height: 112, tone: "total" },
    { label: "Einnahmemodule", value: delta, height: Math.max(28, Math.min(180, Math.abs(delta) * 3.2)), tone: delta >= 0 ? "positive" : "negative" },
    { label: "Saldo Szenario", value: newBalance, height: Math.max(80, Math.min(190, Math.abs(newBalance) * 2.4)), tone: "total" },
  ];
  return <div className="waterfall" role="img" aria-label="Wasserfalldiagramm des Budgetsaldos">{bars.map((bar) => <div className="waterfall-col" key={bar.label}><span>{bar.value.toLocaleString("de-DE", { maximumFractionDigits: 1 })}</span><i className={bar.tone} style={{ height: `${bar.height}px` }} /><small>{bar.label}</small></div>)}</div>;
}

function HouseholdsTab({ result, onOpenSource }: { result: IncomeTaxResult; onOpenSource: (metricId: string, value?: string) => void }) {
  return <div><div className="section-title"><div><h3>Referenzhaushalte · Einkommensteuer</h3><p className="section-description">Tarifliche Wirkung pro Monat. Andere Einnahmemodule erhalten eine gemeinsame Haushaltsverteilung erst mit der synthetischen Bevölkerung.</p></div><SourceButton onClick={() => onOpenSource("metric-household-examples", formatSignedEuro(result.medianMonthlyChange))} /></div><div className="household-grid">{result.households.map((household) => <article className="household-card" key={household.id}><div><strong>{household.name}</strong><small>{household.description}</small></div><em className={household.monthlyChange >= 0 ? "positive" : "negative"}>{formatSignedEuro(household.monthlyChange)} / Monat</em><p>Gesetz: {formatEuro(household.baselineTax)} · Reform: {formatEuro(household.reformTax)} pro Jahr.</p><span>direkte Tarifwirkung</span></article>)}</div></div>;
}

function DistributionTab({ result, onOpenSource }: { result: IncomeTaxResult; onOpenSource: (metricId: string, value?: string) => void }) {
  const max = Math.max(1, ...result.deciles.map((item) => Math.abs(item.monthlyChange)));
  return <div><div className="section-title"><div><h3>Nettowirkung nach Einkommensdezilen · Einkommensteuer</h3><p className="section-description">Gewichteter Tarifvergleich der kalibrierten Referenzpopulation.</p></div><SourceButton onClick={() => onOpenSource("metric-income-tax-distribution", `${formatNumber(result.winnersM)} Mio. Gewinner`)} /></div><div className="distribution-bars">{result.deciles.map((item) => { const positive = item.monthlyChange >= 0; const width = Math.abs(item.monthlyChange) / max * 50; return <div key={item.id}><span>{item.id}</span><i><b className={positive ? "positive" : "negative"} style={{ left: positive ? "50%" : `${50 - width}%`, width: `${width}%` }} /></i><em className={positive ? "positive" : "negative"}>{formatSignedEuro(item.monthlyChange)}</em></div>; })}</div><p className="distribution-summary"><strong>{formatNumber(result.winnersM)} Mio.</strong> Gewinner · <strong>{formatNumber(result.losersM)} Mio.</strong> Verlierer · <strong>{formatNumber(result.neutralM)} Mio.</strong> nahezu unverändert</p></div>;
}

function RegionsTab({ onOpenSource }: { onOpenSource: (metricId: string, value?: string) => void }) {
  const regions = ["Schleswig-Holstein", "Niedersachsen", "Nordrhein-Westfalen", "Hessen", "Sachsen", "Bayern", "Berlin", "Baden-Württemberg"];
  return <div><div className="section-title"><div><h3>Regionale Wirkung</h3><p className="section-description">Noch nicht aus den Einnahmemodulen abgeleitet; regionale Bemessungsgrundlagen folgen in einem späteren Milestone.</p></div><SourceButton onClick={() => onOpenSource("metric-regional-effects", "noch nicht kalibriert")} /></div><div className="region-layout"><div className="germany-map" aria-label="Stilisierte Deutschlandkarte">{["SH","NI","NW","HE","SN","BY","BE","BW"].map((code) => <span key={code}>{code}</span>)}</div><ul>{regions.map((region) => <li key={region}><span>{region}</span><strong>nicht berechnet</strong></li>)}</ul></div></div>;
}

function TimeTab({ totalDelta, onOpenSource }: { totalDelta: number; onOpenSource: (metricId: string, value?: string) => void }) {
  return <div><div className="section-title"><div><h3>Zeitverlauf</h3><p className="section-description">Schematische Fortschreibung der gesamten Einnahmewirkung; keine eigenständige Konjunkturprognose.</p></div><SourceButton onClick={() => onOpenSource("metric-time-path", fmtDiff(totalDelta))} /></div><div className="time-chart">{[2026, 2027, 2028, 2029, 2030, 2031].map((year, index) => <div key={year}><span>{(totalDelta * (1 + index * 0.02)).toLocaleString("de-DE", { maximumFractionDigits: 1 })}</span><i style={{ height: `${60 + index * 15}px` }} /><small>{year}</small></div>)}</div></div>;
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

function modelLabel(level: IncomeTaxResult["modelLevel"]) {
  if (level === "statisch") return "statisch";
  if (level === "verhalten") return "mit Verhaltenseffekt";
  return "langfristig";
}

function formatNumber(value: number) {
  return value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function formatEuro(value: number) {
  return `${Math.round(value).toLocaleString("de-DE")} €`;
}

function formatSignedEuro(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  return `${sign}${Math.abs(Math.round(value)).toLocaleString("de-DE")} €`;
}
