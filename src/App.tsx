import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { AppBar, type AppRoute } from "./components/AppBar";
import { ScenarioPanel } from "./components/ScenarioPanel";
import { SourceDrawer } from "./components/SourceDrawer";
import { calculateExpenseModules, expenseLineResultsById, type ExpenseModuleId } from "./lib/expense-modules";
import { estimateIncomeTaxRevenue, type IncomeTaxResult } from "./lib/income-tax";
import { localServer } from "./lib/local-server-client";
import { populationSources } from "./lib/population-model";
import { calculateRevenueModules, revenueResultsById, type RevenueModuleId } from "./lib/revenue-modules";
import { createScenarioHistory, defaultScenarioDraft, normalizeScenarioDraft, scenarioFromJson, scenarioHistoryReducer, scenarioToJson } from "./lib/scenario-state";
import { expenseItems, fmtBn, fmtDiff, revenueItems } from "./lib/sim-data";
import type { MetricRecord, PopulationGenerationOptions, PopulationRun, ScenarioDraft, ScenarioState, SourceRecord } from "./lib/types";
import { ComparisonPage } from "./pages/ComparisonPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExpenseModulesPage } from "./pages/ExpenseModulesPage";
import { IncomeTaxPage } from "./pages/IncomeTaxPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { PopulationPage } from "./pages/PopulationPage";
import { RevenueModulesPage } from "./pages/RevenueModulesPage";
import { TransparencyPage } from "./pages/TransparencyPage";

function readRoute(): AppRoute {
  const path = window.location.hash.replace(/^#/, "") || "/";
  return (["/", "/dashboard", "/bevoelkerung", "/einkommensteuer", "/einnahmen", "/ausgaben", "/vergleich", "/transparenz"] as AppRoute[]).includes(path as AppRoute) ? path as AppRoute : "/dashboard";
}
const legacyMetricIds: Record<string, string> = { "source-est": "metric-income-tax-revenue", "source-budget": "metric-public-budget-lines", "source-debt": "metric-public-debt" };
const signedEuro = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(Math.round(value)).toLocaleString("de-DE")} € / Monat`;
const formatMillion = (value: number) => value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function App() {
  const [route, setRoute] = useState<AppRoute>(readRoute);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [metrics, setMetrics] = useState<MetricRecord[]>([]);
  const [drawer, setDrawer] = useState<{ metric: MetricRecord; value?: string } | null>(null);
  const [scenarioPanelOpen, setScenarioPanelOpen] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioState[]>([]);
  const [history, dispatch] = useReducer(scenarioHistoryReducer, defaultScenarioDraft, createScenarioHistory);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [selectedRevenueModule, setSelectedRevenueModule] = useState<RevenueModuleId>("ust");
  const [selectedExpenseModule, setSelectedExpenseModule] = useState<ExpenseModuleId>("social");
  const [activePopulation, setActivePopulation] = useState<PopulationRun | null>(null);
  const [populationRuns, setPopulationRuns] = useState<PopulationRun[]>([]);
  const [populationGenerating, setPopulationGenerating] = useState(false);
  const [populationError, setPopulationError] = useState("");
  const [taxResult, setTaxResult] = useState<IncomeTaxResult>(() => estimateIncomeTaxRevenue(defaultScenarioDraft.incomeTax, defaultScenarioDraft.modelLevel));
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  const scenario = history.present;
  const revenueModuleResults = useMemo(() => calculateRevenueModules(scenario.revenueChanges, scenario.modelLevel), [scenario.modelLevel, scenario.revenueChanges]);
  const expenseModuleResults = useMemo(() => calculateExpenseModules(scenario.expenseChanges, scenario.modelLevel), [scenario.expenseChanges, scenario.modelLevel]);
  const revenueModulesById = useMemo(() => revenueResultsById(revenueModuleResults), [revenueModuleResults]);
  const expenseLinesById = useMemo(() => expenseLineResultsById(expenseModuleResults), [expenseModuleResults]);
  const otherRevenueDelta = revenueModuleResults.reduce((sum, item) => sum + item.delta, 0);
  const totalExpenseDelta = expenseModuleResults.reduce((sum, item) => sum + item.delta, 0);
  const totalBudgetDelta = taxResult.delta + otherRevenueDelta - totalExpenseDelta;

  const materializedScenario = useMemo<ScenarioDraft>(() => ({
    ...scenario,
    modelVersion: "synthetic-population-0.7.0",
    sourceIds: Array.from(new Set([...scenario.sourceIds, "source-revenue-model", "source-expense-model", ...populationSources.map((source) => source.id)])),
    revenueChanges: { ...scenario.revenueChanges, ...Object.fromEntries(revenueModuleResults.map((item) => [item.id, item.delta])), est: taxResult.delta, kredit: 0 },
    expenseChanges: { ...scenario.expenseChanges, ...Object.fromEntries(expenseModuleResults.map((item) => [item.id, item.delta])) },
  }), [expenseModuleResults, revenueModuleResults, scenario, taxResult.delta]);

  const metricValues = useMemo<Record<string, string>>(() => {
    const revenueTotal = revenueItems.reduce((sum, item) => item.id === "est" ? sum + taxResult.value : item.id in revenueModulesById ? sum + revenueModulesById[item.id as RevenueModuleId].value : sum + item.statusQuo, 0);
    const expenseTotal = expenseItems.reduce((sum, item) => sum + (expenseLinesById[item.id]?.value ?? item.statusQuo), 0);
    const balance = revenueTotal - expenseTotal;
    const revenueValues = Object.fromEntries(revenueModuleResults.map((item) => [`metric-revenue-${item.id}`, `${fmtBn(item.value)} · ${fmtDiff(item.delta)} · statisch ${fmtDiff(item.staticDelta)}`]));
    const expenseValues = Object.fromEntries(expenseModuleResults.map((item) => [`metric-expense-${item.id}`, `${fmtBn(item.value)} · ${fmtDiff(item.delta)} · direkt ${fmtDiff(item.staticDelta)}`]));
    const migration = expenseModuleResults.find((item) => item.id === "migration");
    return {
      "metric-total-revenue": fmtBn(revenueTotal), "metric-total-expense": fmtBn(expenseTotal), "metric-budget-balance": `${fmtBn(balance)} · ${fmtDiff(totalBudgetDelta)}`,
      "metric-public-debt": "2.634,0 Mrd. €", "metric-public-budget-lines": "positionsabhängig", "metric-income-tax-revenue": `${fmtBn(taxResult.value)} · ${fmtDiff(taxResult.delta)}`,
      "metric-income-tax-tariff": `${scenario.incomeTax.entryRate.toLocaleString("de-DE")}–${scenario.incomeTax.richRate.toLocaleString("de-DE")} %`,
      "metric-income-tax-distribution": `${formatMillion(taxResult.winnersM)} Mio. Gewinner · ${formatMillion(taxResult.losersM)} Mio. Verlierer`,
      "metric-household-examples": signedEuro(taxResult.medianMonthlyChange), "metric-regional-effects": "noch nicht kalibriert", "metric-time-path": fmtDiff(totalBudgetDelta),
      "metric-migration-components": migration ? `${fmtBn(migration.value)} · ${migration.components.map((item) => `${item.label} ${item.value.toLocaleString("de-DE", { maximumFractionDigits: 1 })}`).join(" · ")}` : "nicht berechnet",
      ...revenueValues, ...expenseValues,
    };
  }, [expenseLinesById, expenseModuleResults, revenueModuleResults, revenueModulesById, scenario.incomeTax.entryRate, scenario.incomeTax.richRate, taxResult, totalBudgetDelta]);

  const refreshScenarios = useCallback(async () => setScenarios(await localServer.listScenarios()), []);
  const refreshPopulationRuns = useCallback(async () => setPopulationRuns(await localServer.listPopulationRuns()), []);
  useEffect(() => {
    let cancelled = false;
    const listener = () => setRoute(readRoute());
    window.addEventListener("hashchange", listener);
    void Promise.all([localServer.listSources(), localServer.listMetrics(), localServer.listScenarios(), localServer.getActiveDraft(), localServer.getActivePopulation(), localServer.listPopulationRuns()]).then(async ([loadedSources, loadedMetrics, loadedScenarios, draft, population, runs]) => {
      if (cancelled) return;
      setSources([...loadedSources, ...populationSources]); setMetrics(loadedMetrics); setScenarios(loadedScenarios); setPopulationRuns(runs);
      let selectedPopulation = population;
      if (draft) {
        const normalized = normalizeScenarioDraft(draft.scenario);
        dispatch({ type: "replace", scenario: normalized }); setActiveScenarioId(draft.activeScenarioId);
        if (normalized.populationRunId && normalized.populationRunId !== population.metadata.id) {
          try { selectedPopulation = await localServer.activatePopulation(normalized.populationRunId); }
          catch { setPopulationError("Der im Szenario referenzierte Bevölkerungslauf fehlt lokal. Bitte einen Lauf aktivieren oder neu erzeugen."); }
        }
      } else {
        dispatch({ type: "change", patch: { populationRunId: population.metadata.id, populationModelVersion: population.metadata.modelVersion } });
      }
      if (!cancelled) { setActivePopulation(selectedPopulation); setReady(true); }
    }).catch((error) => { if (!cancelled) { setPopulationError(error instanceof Error ? error.message : "Lokale Datenbasis konnte nicht geladen werden."); setReady(true); } });
    return () => { cancelled = true; window.removeEventListener("hashchange", listener); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timeout = window.setTimeout(() => void localServer.saveActiveDraft({ activeScenarioId, scenario: materializedScenario }), 250);
    return () => window.clearTimeout(timeout);
  }, [activeScenarioId, materializedScenario, ready]);

  useEffect(() => {
    let cancelled = false;
    const fallback = () => { if (!cancelled) setTaxResult(estimateIncomeTaxRevenue(scenario.incomeTax, scenario.modelLevel)); };
    if (!ready || !scenario.populationRunId) { fallback(); return () => { cancelled = true; }; }
    void localServer.estimatePopulationIncomeTax(scenario.incomeTax, scenario.modelLevel, scenario.populationRunId)
      .then((result) => { if (!cancelled) { setTaxResult(result); setPopulationError(""); } })
      .catch((error) => { fallback(); if (!cancelled) setPopulationError(error instanceof Error ? error.message : "Einkommensteuer konnte den Bevölkerungslauf nicht laden."); });
    return () => { cancelled = true; };
  }, [ready, scenario.incomeTax, scenario.modelLevel, scenario.populationRunId]);

  const navigate = (next: AppRoute) => { if (window.location.hash === `#${next}`) setRoute(next); else window.location.hash = next; window.scrollTo({ top: 0, behavior: "smooth" }); };
  const updateScenario = (patch: Partial<ScenarioDraft>) => dispatch({ type: "change", patch });
  const showNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };
  const openSource = (metricOrSourceId: string, value?: string) => {
    const metric = metrics.find((item) => item.id === (legacyMetricIds[metricOrSourceId] ?? metricOrSourceId));
    if (metric) { setDrawer({ metric, value: value ?? metricValues[metric.id] }); return; }
    const source = sources.find((item) => item.id === metricOrSourceId);
    if (source) setDrawer({ metric: { id: source.id, label: source.title, category: "Bevölkerung", description: source.summary, unit: "Nachweis", status: source.status, confidence: source.confidence, dataYear: source.dataYear, legalYear: source.legalYear, sourceIds: [source.id], formula: source.method, parameters: [], calculation: [{ label: "Verwendung", expression: source.method }], uncertainty: { kind: "range", description: source.limitations.join(" ") }, limitations: source.limitations, changeLog: [{ date: source.checkedAt, version: "0.7.0", note: "Für Milestone 7 geprüft." }] } });
  };

  const saveScenario = async () => {
    const now = new Date().toISOString(); const existing = activeScenarioId ? scenarios.find((item) => item.id === activeScenarioId) : undefined;
    const saved = await localServer.saveScenario({ ...materializedScenario, id: existing?.id ?? crypto.randomUUID(), name: materializedScenario.name.trim() || "Unbenanntes Szenario", createdAt: existing?.createdAt ?? now, updatedAt: now });
    setActiveScenarioId(saved.id); await refreshScenarios(); showNotice("Szenario lokal gespeichert");
  };
  const loadScenario = async (saved: ScenarioState) => {
    const normalized = normalizeScenarioDraft(saved);
    if (normalized.populationRunId) {
      try { const population = await localServer.activatePopulation(normalized.populationRunId); setActivePopulation(population); setPopulationError(""); await refreshPopulationRuns(); }
      catch { setPopulationError("Der gespeicherte Bevölkerungslauf fehlt lokal. Das Szenario wurde geladen, die Verteilungsrechnung nutzt keinen stillen Ersatz."); }
    }
    dispatch({ type: "replace", scenario: normalized }); setActiveScenarioId(saved.id); navigate("/dashboard"); showNotice(`„${saved.name}“ geladen`);
  };
  const deleteScenario = async (saved: ScenarioState) => { await localServer.deleteScenario(saved.id); if (saved.id === activeScenarioId) setActiveScenarioId(null); await refreshScenarios(); showNotice(`„${saved.name}“ gelöscht`); };
  const newScenario = () => { dispatch({ type: "replace", scenario: { ...defaultScenarioDraft, name: "Neues Szenario", populationRunId: activePopulation?.metadata.id ?? null, populationModelVersion: activePopulation?.metadata.modelVersion ?? null } }); setActiveScenarioId(null); showNotice("Neuer lokaler Entwurf angelegt"); };
  const duplicateScenario = async () => { const now = new Date().toISOString(); const duplicate: ScenarioState = { ...materializedScenario, id: crypto.randomUUID(), name: `${materializedScenario.name} (Kopie)`, createdAt: now, updatedAt: now }; await localServer.saveScenario(duplicate); dispatch({ type: "replace", scenario: duplicate }); setActiveScenarioId(duplicate.id); await refreshScenarios(); showNotice("Szenario dupliziert"); };
  const exportScenario = () => { const blob = new Blob([scenarioToJson(materializedScenario)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${materializedScenario.name.trim().replace(/[^a-z0-9äöüß-]+/gi, "-").toLowerCase() || "szenario"}.json`; link.click(); URL.revokeObjectURL(url); showNotice("Szenario als JSON exportiert"); };
  const importScenario = async (file: File) => {
    try {
      const imported = scenarioFromJson(await file.text());
      dispatch({ type: "replace", scenario: imported }); setActiveScenarioId(null);
      if (imported.populationRunId && !populationRuns.some((run) => run.metadata.id === imported.populationRunId)) { setPopulationError("Der importierte Bevölkerungslauf ist lokal nicht vorhanden. Bitte auf der Bevölkerungsseite neu erzeugen oder einen vorhandenen Lauf auswählen."); navigate("/bevoelkerung"); }
      else if (imported.populationRunId) { const population = await localServer.activatePopulation(imported.populationRunId); setActivePopulation(population); await refreshPopulationRuns(); }
      showNotice("Szenario importiert und als Entwurf geladen");
    } catch (error) { showNotice(error instanceof Error ? error.message : "Szenario konnte nicht importiert werden"); }
  };
  const copyScenario = async () => { try { await navigator.clipboard.writeText(scenarioToJson(materializedScenario)); showNotice("Szenario-JSON kopiert"); } catch { showNotice("Kopieren wurde vom Browser blockiert"); } };
  const navigateRevenueModule = (id: RevenueModuleId) => { setSelectedRevenueModule(id); navigate("/einnahmen"); };
  const navigateExpenseModule = (id: ExpenseModuleId) => { setSelectedExpenseModule(id); navigate("/ausgaben"); };
  const generatePopulation = async (options: PopulationGenerationOptions) => {
    setPopulationGenerating(true); setPopulationError("");
    try { const run = await localServer.generatePopulation(options); setActivePopulation(run); updateScenario({ populationRunId: run.metadata.id, populationModelVersion: run.metadata.modelVersion }); await refreshPopulationRuns(); showNotice("Synthetische Bevölkerung erzeugt und aktiviert"); }
    catch (error) { setPopulationError(error instanceof Error ? error.message : "Bevölkerung konnte nicht erzeugt werden."); }
    finally { setPopulationGenerating(false); }
  };
  const activatePopulation = async (runId: string) => { try { const run = await localServer.activatePopulation(runId); setActivePopulation(run); updateScenario({ populationRunId: run.metadata.id, populationModelVersion: run.metadata.modelVersion }); setPopulationError(""); await refreshPopulationRuns(); } catch (error) { setPopulationError(error instanceof Error ? error.message : "Lauf konnte nicht aktiviert werden."); } };
  const deletePopulationRun = async (runId: string) => { try { await localServer.deletePopulationRun(runId); const next = await localServer.getActivePopulation(); setActivePopulation(next); updateScenario({ populationRunId: next.metadata.id, populationModelVersion: next.metadata.modelVersion }); await refreshPopulationRuns(); } catch (error) { setPopulationError(error instanceof Error ? error.message : "Lauf konnte nicht gelöscht werden."); } };

  return <div className="app-shell">
    <AppBar route={route} scenarioName={scenario.name} legalYear={scenario.legalYear} dataYear={scenario.dataYear} canUndo={history.past.length > 0} canRedo={history.future.length > 0} onScenarioName={(name) => updateScenario({ name })} onNavigate={navigate} onUndo={() => dispatch({ type: "undo" })} onRedo={() => dispatch({ type: "redo" })} onSave={() => void saveScenario()} onOpenScenario={() => setScenarioPanelOpen(true)} />
    {route === "/" && <OnboardingPage modelLevel={scenario.modelLevel} onModelLevel={(modelLevel) => updateScenario({ modelLevel })} onStart={() => navigate("/dashboard")} />}
    {route === "/dashboard" && <DashboardPage incomeTaxResult={taxResult} revenueModuleResults={revenueModuleResults} expenseModuleResults={expenseModuleResults} metrics={metrics} sources={sources} scenarios={scenarios} onNavigateIncomeTax={() => navigate("/einkommensteuer")} onNavigateRevenue={navigateRevenueModule} onNavigateExpense={navigateExpenseModule} onNavigateComparison={() => navigate("/vergleich")} onOpenSource={openSource} onLoadScenario={(saved) => void loadScenario(saved)} onDeleteScenario={(saved) => void deleteScenario(saved)} />}
    {route === "/bevoelkerung" && <PopulationPage activeRun={activePopulation} runs={populationRuns} generating={populationGenerating} error={populationError} onGenerate={(options) => void generatePopulation(options)} onActivate={(runId) => void activatePopulation(runId)} onDelete={(runId) => void deletePopulationRun(runId)} onOpenSource={openSource} />}
    {route === "/einkommensteuer" && <IncomeTaxPage settings={scenario.incomeTax} modelLevel={scenario.modelLevel} result={taxResult} populationRun={activePopulation} revenueResults={revenueModuleResults} onSettings={(incomeTax) => updateScenario({ incomeTax })} onModelLevel={(modelLevel) => updateScenario({ modelLevel })} onNavigateRevenue={navigateRevenueModule} onBack={() => navigate("/dashboard")} onOpenSource={openSource} />}
    {route === "/einnahmen" && <RevenueModulesPage selectedId={selectedRevenueModule} results={revenueModuleResults} incomeTaxResult={taxResult} parameters={scenario.revenueChanges} modelLevel={scenario.modelLevel} onSelect={setSelectedRevenueModule} onNavigateIncomeTax={() => navigate("/einkommensteuer")} onParameters={(revenueChanges) => updateScenario({ revenueChanges })} onModelLevel={(modelLevel) => updateScenario({ modelLevel })} onBack={() => navigate("/dashboard")} onOpenSource={openSource} />}
    {route === "/ausgaben" && <ExpenseModulesPage selectedId={selectedExpenseModule} results={expenseModuleResults} parameters={scenario.expenseChanges} modelLevel={scenario.modelLevel} onSelect={setSelectedExpenseModule} onParameters={(expenseChanges) => updateScenario({ expenseChanges })} onModelLevel={(modelLevel) => updateScenario({ modelLevel })} onBack={() => navigate("/dashboard")} onOpenSource={openSource} />}
    {route === "/vergleich" && <ComparisonPage settings={scenario.incomeTax} revenue={taxResult.value} onBack={() => navigate("/dashboard")} onOpenSource={openSource} />}
    {route === "/transparenz" && <TransparencyPage metrics={metrics} sources={sources} values={metricValues} onOpenMetric={openSource} />}
    {notice && <div className="toast" role="status">{notice}</div>}
    <SourceDrawer metric={drawer?.metric ?? null} sources={sources} scenario={scenario} value={drawer?.value} onClose={() => setDrawer(null)} />
    <ScenarioPanel open={scenarioPanelOpen} scenario={scenario} activeScenarioId={activeScenarioId} savedCount={scenarios.length} onPatch={updateScenario} onClose={() => setScenarioPanelOpen(false)} onNew={newScenario} onDuplicate={() => void duplicateScenario()} onExport={exportScenario} onImport={importScenario} onCopy={() => void copyScenario()} />
  </div>;
}
