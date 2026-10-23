import { Trash2 } from "lucide-react";
import { createContext, useContext, useMemo, useState } from "react";
import { ConfidenceIndicator, EvidenceSourceButton } from "../components/EvidenceTooltip";
import { icons, type IconName } from "../components/icons";
import { expenseModuleForLineId, expenseResultsById, type ExpenseModuleId, type ExpenseModuleResult } from "../lib/expense-modules";
import type { BudgetExpenseLine, BudgetRevenueLine, BudgetSummary } from "../lib/budget-summary";
import type { IncomeTaxResult } from "../lib/income-tax";
import type { ScenarioChange } from "../lib/scenario-changes";
import { revenueModuleIds, type RevenueModuleId, type RevenueModuleResult } from "../lib/revenue-modules";
import { fmtBn, fmtDiff } from "../lib/sim-data";
import type { MetricRecord, ScenarioState, SourceRecord } from "../lib/types";

type Tab = "budget" | "haushalte" | "verteilung" | "regionen" | "zeit";
type MobileTab = "steuern" | "ergebnis" | "ausgaben" | "szenario";
type EvidenceContextValue = { metricsById: Record<string, MetricRecord>; sources: SourceRecord[] };

const EvidenceContext = createContext<EvidenceContextValue>({ metricsById: {}, sources: [] });

type Props = {
  incomeTaxResult: IncomeTaxResult;
  budgetSummary: BudgetSummary;
  revenueModuleResults: RevenueModuleResult[];
  expenseModuleResults: ExpenseModuleResult[];
  metrics: MetricRecord[];
  sources: SourceRecord[];
  scenarios: ScenarioState[];
  scenarioChanges: ScenarioChange[];
  onNavigateIncomeTax: () => void;
  onNavigateRevenue: (id: RevenueModuleId) => void;
  onNavigateExpense: (id: ExpenseModuleId) => void;
  onNavigateComparison: () => void;
  onNavigateLongTerm: () => void;
  onOpenSource: (metricId: string, value?: string) => void;
  onLoadScenario: (scenario: ScenarioState) => void;
  onDeleteScenario: (scenario: ScenarioState) => void;
};

export function DashboardPage({ incomeTaxResult, budgetSummary, revenueModuleResults, expenseModuleResults, metrics, sources, scenarios, scenarioChanges, onNavigateIncomeTax, onNavigateRevenue, onNavigateExpense, onNavigateComparison, onNavigateLongTerm, onOpenSource, onLoadScenario, onDeleteScenario }: Props) {
  const [tab, setTab] = useState<Tab>("budget");
  const [mobileTab, setMobileTab] = useState<MobileTab>("ergebnis");
  const expenseById = useMemo(() => expenseResultsById(expenseModuleResults), [expenseModuleResults]);
  const evidence = useMemo<EvidenceContextValue>(() => ({ metricsById: Object.fromEntries(metrics.map((metric) => [metric.id, metric])), sources }), [metrics, sources]);
  const revenues = budgetSummary.revenueLines;
  const expenses = budgetSummary.expenseLines;
  const { revenueTotal, revenueBaseline: revenueStatusQuo, expenseTotal, expenseBaseline: expenseStatusQuo, balance, balanceBaseline: balanceStatusQuo } = budgetSummary;
  const totalRevenueDelta = budgetSummary.revenueDelta;
  const totalExpenseDelta = budgetSummary.expenseDelta;
  const totalBudgetDelta = budgetSummary.balanceDelta;
  const totalsComplete = budgetSummary.isComplete;
  const missingModules = [...budgetSummary.missingRevenueModules, ...budgetSummary.missingExpenseModules];
  const totalsNote = totalsComplete
    ? "Jahressumme der ausgewiesenen Posten; keine vollständige Haushaltsrechnung."
    : `Jahressumme unvollständig${missingModules.length ? ` · fehlend: ${missingModules.join(", ")}` : ""}.`;

  const openRevenueItem = (itemId: string) => itemId === "est" ? onNavigateIncomeTax() : revenueModuleIds.includes(itemId as RevenueModuleId) ? onNavigateRevenue(itemId as RevenueModuleId) : undefined;
  const openExpenseItem = (itemId: string) => { const moduleId = expenseModuleForLineId[itemId]; if (moduleId) onNavigateExpense(moduleId); };
  const centerProps = { tab, setTab, scenarioChanges, incomeTaxResult, revenueModuleResults, expenseModuleResults, totalRevenueDelta, totalExpenseDelta, totalBudgetDelta, baselineBalance: budgetSummary.balanceBaseline, totalsComplete, totalsNote, onOpenSource, onNavigateComparison, onNavigateLongTerm, onNavigateExpense, onLoadScenario, onDeleteScenario };

  return <EvidenceContext.Provider value={evidence}><>
    <section className="sticky-kpis" aria-label="Haushaltsübersicht"><div className="content-width kpi-grid">
      <KpiCard label="Einnahmen" metricId="metric-total-revenue" value={displayTotal(revenueTotal)} delta={displayDelta(revenueTotal === null ? null : revenueTotal - revenueStatusQuo)} tone={revenueTotal === null ? "neutral" : revenueTotal >= revenueStatusQuo ? "positive" : "negative"} note={totalsNote} onSource={() => onOpenSource("metric-total-revenue", displayTotal(revenueTotal))} />
      <KpiCard label="Ausgaben" metricId="metric-total-expense" value={displayTotal(expenseTotal)} delta={displayDelta(expenseTotal === null ? null : expenseTotal - expenseStatusQuo)} tone={expenseTotal === null ? "neutral" : expenseTotal <= expenseStatusQuo ? "positive" : "negative"} note={totalsNote} onSource={() => onOpenSource("metric-total-expense", displayTotal(expenseTotal))} />
      <KpiCard label="Saldo pro Jahr" metricId="metric-budget-balance" value={displayTotal(balance)} delta={displayDelta(balance === null ? null : balance - balanceStatusQuo)} tone={balance === null ? "neutral" : balance >= balanceStatusQuo ? "positive" : "negative"} note={totalsNote} onSource={() => onOpenSource("metric-budget-balance", displayTotal(balance))} />
      <KpiCard label="Schuldenstand · Beispiel" testId="debt-stock-kpi" metricId="metric-public-debt" value="2.634,0 Mrd. €" delta="keine Fortschreibung" tone="neutral" note="Fester Beispielwert ohne belegten Stichtag; keine Schuldenprognose." onSource={() => onOpenSource("metric-public-debt", "2.634,0 Mrd. € · Beispielwert")} />
    </div></section>

    <main className="content-width dashboard-main">
      <p className="notice-box dashboard-result-status" role="note">
        Der Einkommensteuertarif folgt dem Rechtsstand 2026. Verteilungs-, Budget- und Langfristergebnisse nutzen je nach Kennzahl gewichtete Referenzpunkte oder Modellannahmen. Der Schuldenstand ist als Beispielwert markiert; Regionen sind noch nicht berechnet. Status und Grenzen stehen am jeweiligen Nachweis.
      </p>
      <div className="desktop-dashboard"><LinePanel title="Einnahmen" total={revenueTotal} totalMetricId="metric-total-revenue" items={revenues} onOpenSource={onOpenSource} onInteractive={openRevenueItem} isInteractive={(id) => id === "est" || (revenueModuleIds as readonly string[]).includes(id)} /><CenterPanel {...centerProps} scenarios={scenarios} migration={expenseById.migration} /><LinePanel title="Ausgaben" total={expenseTotal} totalMetricId="metric-total-expense" items={expenses} expense onOpenSource={onOpenSource} onInteractive={openExpenseItem} isInteractive={(id) => Boolean(expenseModuleForLineId[id])} /></div>
      <div className="mobile-dashboard"><div className="mobile-tabs" role="tablist" aria-label="Dashboardbereiche">{([ ["steuern", "Steuern"], ["ergebnis", "Ergebnis"], ["ausgaben", "Ausgaben"], ["szenario", "Szenario"] ] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={mobileTab === key} className={mobileTab === key ? "active" : ""} onClick={() => setMobileTab(key)}>{label}</button>)}</div><div className="mobile-tab-content">
        {mobileTab === "steuern" && <LinePanel title="Einnahmen" total={revenueTotal} totalMetricId="metric-total-revenue" items={revenues} onOpenSource={onOpenSource} onInteractive={openRevenueItem} isInteractive={(id) => id === "est" || (revenueModuleIds as readonly string[]).includes(id)} />}
        {mobileTab === "ergebnis" && <CenterPanel {...centerProps} scenarios={[]} showSavedScenarios={false} migration={expenseById.migration} />}
        {mobileTab === "ausgaben" && <LinePanel title="Ausgaben" total={expenseTotal} totalMetricId="metric-total-expense" items={expenses} expense onOpenSource={onOpenSource} onInteractive={openExpenseItem} isInteractive={(id) => Boolean(expenseModuleForLineId[id])} />}
        {mobileTab === "szenario" && <SavedScenarios scenarios={scenarios} onLoad={onLoadScenario} onDelete={onDeleteScenario} />}
      </div></div>
    </main>
    <footer className="app-footer content-width">Einnahmen und Ausgaben werden als getrennte Module berechnet. Direkte Haushaltswirkung, Folgewirkung, Unsicherheit und Quellen bleiben sichtbar.</footer>
  </></EvidenceContext.Provider>;
}

function KpiCard({ label, testId, metricId, value, delta, tone, note, onSource }: { label: string; testId?: string; metricId: string; value: string; delta: string; tone: "positive" | "negative" | "warning" | "neutral"; note?: string; onSource: () => void }) { return <article className="card-flat kpi-card" data-testid={testId}><div className="kpi-head"><span>{label}</span><SourceButton contextLabel={label} metricId={metricId} onClick={onSource} /></div><div className="kpi-value-row"><strong>{value}</strong><em className={tone}>{delta}</em></div><small>{note ?? "Bund, Länder, Kommunen, Sozialversicherung"}</small></article>; }

function LinePanel({ title, total, totalMetricId, items, expense = false, onOpenSource, onInteractive, isInteractive }: { title: string; total: number | null; totalMetricId: string; items: Array<BudgetRevenueLine | BudgetExpenseLine>; expense?: boolean; onOpenSource: (metricId: string, value?: string) => void; onInteractive?: (itemId: string) => void; isInteractive?: (itemId: string) => boolean }) {
  const statusQuo = items.reduce((sum, item) => sum + item.statusQuo, 0);
  const totalPositive = total !== null && (expense ? total <= statusQuo : total >= statusQuo);
  const totalDelta = total === null ? null : total - statusQuo;
  return <aside className="card-flat line-panel" aria-label={title}><header><div className="panel-title-row"><h2>{title}</h2><SourceButton contextLabel={title} metricId={totalMetricId} onClick={() => onOpenSource(totalMetricId, displayTotal(total))} /></div><div className="panel-total"><strong>{displayTotal(total)}</strong><em className={totalDelta === null ? "neutral" : totalPositive ? "positive" : "negative"}>{displayDelta(totalDelta)}</em></div><p className="budget-scope-note">Summe der ausgewiesenen Posten; keine vollständige Haushaltsrechnung.</p>{expense && <p>direkte Ausgaben sowie separat ausgewiesene Steuervergünstigungen</p>}</header><ul>{items.map((item) => { const interactive = Boolean(onInteractive && isInteractive?.(item.id)); const metricId = metricIdForLine(item.id); return <LineRow key={item.id} item={item} metricId={metricId} expense={expense} onClick={interactive ? () => onInteractive?.(item.id) : undefined} onSource={() => onOpenSource(metricId, displayTotal(item.value))} />; })}</ul></aside>;
}

function metricIdForLine(itemId: string) { if (itemId === "est") return "metric-income-tax-revenue"; if (revenueModuleIds.includes(itemId as RevenueModuleId)) return `metric-revenue-${itemId}`; if (expenseModuleForLineId[itemId]) return `metric-expense-${expenseModuleForLineId[itemId]}`; if (itemId === "kredit") return "metric-budget-balance"; return "metric-public-budget-lines"; }
function LineRow({ item, metricId, expense, onClick, onSource }: { item: BudgetRevenueLine | BudgetExpenseLine; metricId: string; expense: boolean; onClick?: () => void; onSource: () => void }) { const Icon = icons[item.icon as IconName]; const positive = item.delta === null ? false : expense ? item.delta <= 0 : item.delta >= 0; return <li className={`${item.delta !== null && item.delta !== 0 ? "changed" : ""} ${item.confidence === "niedrig" ? "uncertain" : ""}`}><button className="line-row-main" onClick={onClick} disabled={!onClick} aria-label={onClick ? `${item.label} bearbeiten` : undefined}><span className={`category-icon ${expense ? "expense" : ""}`}><Icon size={14} strokeWidth={1.8} /></span><span className="line-copy"><strong>{item.label}</strong><small>{item.available ? <>{fmtBn(item.statusQuo)} → <b>{displayTotal(item.value)}</b></> : <b>Ergebnis nicht verfügbar</b>}{"note" in item && item.note ? ` · ${item.note}` : ""}</small></span></button><span className="line-side"><em className={item.delta === null ? "neutral" : item.delta === 0 ? "neutral" : positive ? "positive" : "negative"}>{displayDelta(item.delta)}</em><ConfidenceIndicator confidence={item.confidence} /><SourceButton contextLabel={item.label} iconOnly metricId={metricId} onClick={onSource} /></span></li>; }

type CenterProps = { tab: Tab; setTab: (tab: Tab) => void; incomeTaxResult: IncomeTaxResult; revenueModuleResults: RevenueModuleResult[]; expenseModuleResults: ExpenseModuleResult[]; totalRevenueDelta: number | null; totalExpenseDelta: number | null; totalBudgetDelta: number | null; baselineBalance: number; totalsComplete: boolean; totalsNote: string; onOpenSource: (metricId: string, value?: string) => void; onNavigateComparison: () => void; onNavigateLongTerm: () => void; onNavigateExpense: (id: ExpenseModuleId) => void; scenarios: ScenarioState[]; scenarioChanges: ScenarioChange[]; showSavedScenarios?: boolean; migration?: ExpenseModuleResult; onLoadScenario: (scenario: ScenarioState) => void; onDeleteScenario: (scenario: ScenarioState) => void };
function CenterPanel(props: CenterProps) { const { tab, setTab, incomeTaxResult, revenueModuleResults, expenseModuleResults, totalRevenueDelta, totalExpenseDelta, totalBudgetDelta, baselineBalance, totalsComplete, totalsNote, onOpenSource, onNavigateComparison, onNavigateLongTerm, onNavigateExpense, scenarios, scenarioChanges, showSavedScenarios = true, migration, onLoadScenario, onDeleteScenario } = props; return <section className="center-panel"><div className="card-flat result-card"><HouseholdScopeNote changes={scenarioChanges} /><div className="result-tabs">{([ ["budget", "Budget"], ["haushalte", "Haushalte"], ["verteilung", "Verteilung"], ["regionen", "Regionen"], ["zeit", "Zeitverlauf"] ] as const).map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} aria-label={key === "regionen" ? "Regionen · noch nicht berechnet" : label} onClick={() => setTab(key)}>{label}{key === "regionen" && <span className="tab-status-badge">noch nicht berechnet</span>}</button>)}<div className="result-tabs-actions"><span className="scenario-chip">8 Einnahmen · 9 Ausgaben</span><button className="button secondary small" onClick={onNavigateComparison}>Vergleich öffnen</button></div></div><div className="result-content">{tab === "budget" && <BudgetTab result={incomeTaxResult} revenueModules={revenueModuleResults} expenseModules={expenseModuleResults} revenueDelta={totalRevenueDelta} expenseDelta={totalExpenseDelta} budgetDelta={totalBudgetDelta} baselineBalance={baselineBalance} complete={totalsComplete} note={totalsNote} onOpenSource={onOpenSource} />}{tab === "haushalte" && <HouseholdsTab result={incomeTaxResult} onOpenSource={onOpenSource} />}{tab === "verteilung" && <DistributionTab result={incomeTaxResult} onOpenSource={onOpenSource} />}{tab === "regionen" && <RegionsTab onOpenSource={onOpenSource} />}{tab === "zeit" && <TimeTab totalDelta={totalBudgetDelta} onOpenSource={onOpenSource} onNavigateLongTerm={onNavigateLongTerm} />}</div></div>{migration ? <MigrationCard result={migration} onOpenSource={onOpenSource} onOpen={() => onNavigateExpense("migration")} /> : <p className="notice-box" role="status">Das Modul „Migration und Asyl“ ist nicht verfügbar und wird nicht in eine Gesamtsumme eingerechnet.</p>}{showSavedScenarios && <SavedScenarios scenarios={scenarios} onLoad={onLoadScenario} onDelete={onDeleteScenario} />}</section>; }

function HouseholdScopeNote({ changes }: { changes: ScenarioChange[] }) {
  const changedPolicyModules = [...new Set(changes.filter((change) => change.category === "policy").map((change) => change.module))];
  const incomeTaxChanged = changedPolicyModules.includes("Einkommensteuer");
  const unrepresentedModules = changedPolicyModules.filter((module) => module !== "Einkommensteuer");
  let details: string;

  if (changedPolicyModules.length === 0) {
    details = "Im aktuellen Paket ist keine politische Maßnahme geändert. Angezeigt wird die Einkommensteuer-Ausgangslage.";
  } else if (unrepresentedModules.length === 0) {
    details = "Geändert und in dieser Ansicht enthalten: Einkommensteuer.";
  } else {
    const incomeTaxStatus = incomeTaxChanged
      ? "Geändert und enthalten: Einkommensteuer."
      : "Einkommensteuer wird angezeigt, ist in diesem Paket aber unverändert.";
    details = `${incomeTaxStatus} Geändert, hier nicht abgebildet: ${unrepresentedModules.join(", ")}. Unveränderte Einkommensteuerwerte belegen keine Wirkungslosigkeit dieser Maßnahmen.`;
  }

  return <aside className="dashboard-household-scope" role="note" aria-label="Umfang der Haushalts- und Verteilungsansicht" data-testid="household-distribution-scope">
    <strong>Haushalte und Verteilung zeigen derzeit nur die Einkommensteuer.</strong>
    <span>{details}</span>
  </aside>;
}

function BudgetTab({ result, revenueModules, expenseModules, revenueDelta, expenseDelta, budgetDelta, baselineBalance, complete, note, onOpenSource }: { result: IncomeTaxResult; revenueModules: RevenueModuleResult[]; expenseModules: ExpenseModuleResult[]; revenueDelta: number | null; expenseDelta: number | null; budgetDelta: number | null; baselineBalance: number; complete: boolean; note: string; onOpenSource: (metricId: string, value?: string) => void }) {
  if (!complete || revenueDelta === null || expenseDelta === null || budgetDelta === null) return <p className="notice-box" role="status">{note} Fehlende Teilwerte werden nicht als null gerechnet.</p>;
  const staticBudget = result.staticDelta + revenueModules.reduce((sum, item) => sum + item.staticDelta, 0) - expenseModules.reduce((sum, item) => sum + item.staticDelta, 0);
  const feedbackBudget = result.behavioralAdjustment + revenueModules.reduce((sum, item) => sum + item.behavioralAdjustment, 0) - expenseModules.reduce((sum, item) => sum + item.feedbackAdjustment, 0);
  return <div className="budget-layout"><div><div className="section-title"><div><h3>Budgetsaldo und Änderungen</h3><p>Modellierte Jahreswerte der ausgewiesenen Posten; keine vollständige Haushaltsrechnung.</p></div><SourceButton contextLabel="Budgetsaldo und Änderungen" metricId="metric-budget-balance" onClick={() => onOpenSource("metric-budget-balance", fmtDiff(budgetDelta))} /></div><BudgetBalanceChart baselineBalance={baselineBalance} revenueDelta={revenueDelta} expenseDelta={expenseDelta} /><div className="plain-language">Gegenüber dem Status quo verändert sich der Jahressaldo um <strong>{fmtDiff(budgetDelta)}</strong>: Einnahmenwirkung {fmtDiff(revenueDelta)}, Ausgabenwirkung auf den Saldo {fmtDiff(-expenseDelta)}.</div></div><div><h3>Direkt und mit Rückwirkung</h3><p className="section-description">Erstwirkung und modellierte Anpassung bleiben getrennt.</p><div className="budget-model-compare"><span><b>{fmtDiff(staticBudget)}</b>direkte Budgetwirkung</span><span><b>{fmtDiff(feedbackBudget)}</b>Verhaltens- und Folgewirkung</span><span><b>{expenseModules.length + revenueModules.length + 1}</b>Modellmodule</span></div><div className="module-delta-list">{expenseModules.map((item) => <span key={item.id}><small>{item.label}</small><b className={item.delta <= 0 ? "positive" : "negative"}>{fmtDiff(-item.delta)} Saldo</b></span>)}</div></div></div>;
}
function BudgetBalanceChart({ baselineBalance, revenueDelta, expenseDelta }: { baselineBalance: number; revenueDelta: number; expenseDelta: number }) {
  const newBalance = baselineBalance + revenueDelta - expenseDelta;
  const bars = [
    { label: "Saldo Status quo", value: baselineBalance, isChange: false },
    { label: "Einnahmenwirkung", value: revenueDelta, isChange: true },
    { label: "Ausgabenwirkung auf Saldo", value: -expenseDelta, isChange: true },
    { label: "Saldo Szenario", value: newBalance, isChange: false },
  ];
  const scale = Math.max(...bars.map((bar) => Math.abs(bar.value)));
  return <div className="budget-balance-chart" role="group" aria-label="Budgetsaldo und Änderungen, lineare Skala mit Nullachse">
    <p className="budget-chart-unit">Werte in Mrd. € pro Jahr</p>
    <div className="budget-chart-grid" data-testid="budget-chart" data-scale={scale}>
      <span className="budget-chart-zero-label" aria-hidden="true">0</span>
      <span className="budget-chart-zero-line" aria-hidden="true" />
      {bars.map((bar) => {
        const direction = bar.value > 0 ? "positive" : bar.value < 0 ? "negative" : "zero";
        const height = scale === 0 ? 0 : Math.abs(bar.value) / scale * 44;
        const formattedValue = bar.isChange ? fmtDiff(bar.value) : fmtBn(bar.value);
        return <div className="budget-chart-column" key={bar.label} role="group" data-testid="budget-chart-column" data-value={bar.value} data-direction={direction} aria-label={`${bar.label}: ${formattedValue}`}>
          <strong>{bar.value > 0 ? "+" : bar.value < 0 ? "−" : ""}{Math.abs(bar.value).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
          <div className="budget-chart-plot"><i className={`budget-chart-bar ${direction}`} data-testid="budget-chart-bar" data-value={bar.value} data-direction={direction} style={{ height: `${height}%`, top: direction === "negative" ? "50%" : `calc(50% - ${height}%)` }} /></div>
          <small>{bar.label}</small>
        </div>;
      })}
    </div>
  </div>;
}
function HouseholdsTab({ result, onOpenSource }: { result: IncomeTaxResult; onOpenSource: (metricId: string, value?: string) => void }) { return <div><div className="section-title"><div><h3>Referenzhaushalte · Einkommensteuer</h3><p className="section-description">Vier illustrative Haushaltstypen zeigen die direkte Tarifwirkung; die Auswahl ist nicht repräsentativ.</p></div><SourceButton contextLabel="Referenzhaushalte" metricId="metric-household-examples" onClick={() => onOpenSource("metric-household-examples", formatSignedEuro(result.medianMonthlyChange))} /></div><div className="household-grid">{result.households.map((household) => <article className="household-card" key={household.id}><div><strong>{household.name}</strong><small>{household.description}</small></div><em className={household.monthlyChange >= 0 ? "positive" : "negative"}>{formatSignedEuro(household.monthlyChange)} / Monat</em><p>Gesetz: {formatEuro(household.baselineTax)} · Reform: {formatEuro(household.reformTax)} pro Jahr.</p><span>direkte Tarifwirkung</span></article>)}</div></div>; }
function DistributionTab({ result, onOpenSource }: { result: IncomeTaxResult; onOpenSource: (metricId: string, value?: string) => void }) { const max = Math.max(1, ...result.deciles.map((item) => Math.abs(item.monthlyChange))); return <div><div className="section-title"><div><h3>Nettowirkung nach Einkommensdezilen · Einkommensteuer</h3><p className="section-description">Modellschätzung aus vereinfachten, gewichteten Referenzpunkten; keine Mikrodaten.</p></div><SourceButton contextLabel="Nettowirkung nach Einkommensdezilen" metricId="metric-income-tax-distribution" onClick={() => onOpenSource("metric-income-tax-distribution", `${formatNumber(result.winnersM)} Mio. Gewinner`)} /></div><div className="distribution-bars">{result.deciles.map((item) => { const positive = item.monthlyChange >= 0; const width = Math.abs(item.monthlyChange) / max * 50; return <div key={item.id}><span>{item.id}</span><i><b className={positive ? "positive" : "negative"} style={{ left: positive ? "50%" : `${50 - width}%`, width: `${width}%` }} /></i><em className={positive ? "positive" : "negative"}>{formatSignedEuro(item.monthlyChange)}</em></div>; })}</div><p className="distribution-summary"><strong>{formatNumber(result.winnersM)} Mio.</strong> Gewinner · <strong>{formatNumber(result.losersM)} Mio.</strong> Verlierer · <strong>{formatNumber(result.neutralM)} Mio.</strong> nahezu unverändert</p></div>; }
function RegionsTab({ onOpenSource }: { onOpenSource: (metricId: string, value?: string) => void }) { return <div><div className="section-title"><div><h3>Regionale Wirkung</h3><p className="section-description">Für dieses Szenario liegen keine regional aufgeschlüsselten Ergebnisse vor.</p></div><SourceButton contextLabel="Regionale Wirkung" metricId="metric-regional-effects" onClick={() => onOpenSource("metric-regional-effects", "noch nicht berechnet")} /></div><div className="notice-box region-unavailable" role="status"><strong>Noch nicht berechnet.</strong><span>Es gibt derzeit keine regionalen Werte, Karte oder Rangfolge, die du interpretieren kannst.</span></div></div>; }
function TimeTab({ totalDelta, onOpenSource, onNavigateLongTerm }: { totalDelta: number | null; onOpenSource: (metricId: string, value?: string) => void; onNavigateLongTerm: () => void }) { return <div className="time-summary"><div className="section-title"><div><h3>Ein Jahreswert, keine Fortschreibung</h3><p className="section-description">Der modellierte Jahreswert gegenüber dem Status quo ist keine Zeitreihe. Für Szenarien über mehrere Zieljahre gibt es die Langfristansicht.</p></div><SourceButton contextLabel="Änderung des jährlichen Saldos" metricId="metric-time-path" onClick={() => onOpenSource("metric-time-path", displayDelta(totalDelta))} /></div>{totalDelta === null ? <p className="notice-box" role="status">Gesamtergebnis unvollständig. Eine jährliche Änderung wird erst bei vollständigen Teilwerten angezeigt.</p> : <div className="time-summary-value"><span>Änderung des jährlichen Saldos der ausgewiesenen Posten</span><strong>{fmtDiff(totalDelta)}</strong><small>Ein einzelner Jahreswert wird nicht automatisch auf Folgejahre übertragen.</small></div>}<button className="button primary" type="button" onClick={onNavigateLongTerm}>Langfristansicht öffnen</button></div>; }
function MigrationCard({ result, onOpenSource, onOpen }: { result: ExpenseModuleResult; onOpenSource: (metricId: string, value?: string) => void; onOpen: () => void }) { return <article className="card-flat migration-card"><div className="section-title"><div><h3>Migration und Asyl · getrennte Teilbereiche</h3><p>Unterbringung, Verfahren, Integration sowie Bildung und weitere Aufgaben bleiben getrennt.</p></div><div><button className="button secondary small" onClick={onOpen}>Modul öffnen</button><SourceButton contextLabel="Migration und Asyl" metricId="metric-expense-migration" onClick={() => onOpenSource("metric-expense-migration", fmtBn(result.value))} /></div></div><div className="migration-grid">{result.components.map((item) => <span key={item.id}><b>{item.value.toLocaleString("de-DE", { maximumFractionDigits: 1 })}</b> {item.label}</span>)}</div></article>; }
function SavedScenarios({ scenarios, onLoad, onDelete }: { scenarios: ScenarioState[]; onLoad: (scenario: ScenarioState) => void; onDelete: (scenario: ScenarioState) => void }) {
  return <section className="card-flat saved-scenarios">
    <header>
      <div>
        <span className="eyebrow">Nur in diesem Browser gespeichert</span>
        <h3>Gespeicherte Szenarien</h3>
        <p className="saved-scenarios-help">Lade eine Szenario-Datei herunter, wenn du eine Variante auf ein anderes Gerät mitnehmen möchtest.</p>
      </div>
      <strong aria-label={`${scenarios.length} gespeicherte Szenarien`}>{scenarios.length}</strong>
    </header>
    {scenarios.length === 0 ? <p className="empty-state">Noch keine Szenarien gespeichert. Dein Arbeitsentwurf bleibt in diesem Browser gesichert.</p> : <ul>{scenarios.map((scenario) => <li key={scenario.id}>
      <button onClick={() => onLoad(scenario)}>
        <strong>{scenario.name}</strong>
        <small className="saved-scenario-description">{scenario.description.trim() || "Keine Beschreibung angegeben."}</small>
        <small className="saved-scenario-updated">Zuletzt gespeichert: {new Date(scenario.updatedAt).toLocaleString("de-DE")}</small>
      </button>
      <button className="plain-icon delete" aria-label={`${scenario.name} löschen`} onClick={() => onDelete(scenario)}><Trash2 size={14} /></button>
    </li>)}</ul>}
  </section>;
}
function SourceButton({ metricId, contextLabel, onClick, iconOnly = false }: { metricId: string; contextLabel: string; onClick: () => void; iconOnly?: boolean }) { const { metricsById, sources } = useContext(EvidenceContext); return <EvidenceSourceButton contextLabel={contextLabel} iconOnly={iconOnly} metric={metricsById[metricId]} sources={sources} onClick={onClick} />; }
function displayTotal(value: number | null) { return value === null ? "Nicht vollständig" : fmtBn(value); }
function displayDelta(value: number | null) { return value === null ? "nicht berechnet" : fmtDiff(value); }
function formatNumber(value: number) { return value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 }); }
function formatEuro(value: number) { return `${Math.round(value).toLocaleString("de-DE")} €`; }
function formatSignedEuro(value: number) { const sign = value > 0 ? "+" : value < 0 ? "−" : "±"; return `${sign}${Math.abs(Math.round(value)).toLocaleString("de-DE")} €`; }
