import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AppBar, type AppRoute } from "./components/AppBar";
import { ModelBasisStatus, type ModelBasisStatusKind } from "./components/ModelBasisStatus";
import { ScenarioPanel } from "./components/ScenarioPanel";
import { ScenarioGuardDialog, type ScenarioGuardRequest } from "./components/ScenarioGuardDialog";
import { SourceDrawer } from "./components/SourceDrawer";
import { calculateExpenseModules, type ExpenseModuleId } from "./lib/expense-modules";
import { calculateBudgetSummary } from "./lib/budget-summary";
import { estimateIncomeTaxRevenue, type IncomeTaxResult } from "./lib/income-tax";
import { localServer } from "./lib/local-server-client";
import { SUPPORTED_LEGAL_YEAR } from "./lib/model-baseline";
import type { EffectRun } from "./lib/long-term-effects";
import { canReconstructPopulationBasis, populationBasisFromRun, type PopulationBasisReference } from "./lib/population-basis";
import { populationSources } from "./lib/population-model";
import { calculateRevenueModules, type RevenueModuleId } from "./lib/revenue-modules";
import { activeReformContextKeys, contextualSources, deriveReformEffectParameters, effectInputSignature, hasContextualEffects, summarizeScenarioEffects } from "./lib/reform-effects";
import { resolveCalculationFreshness, type CalculationFreshness } from "./lib/scenario-calculation";
import { createScenarioHistory, defaultScenarioDraft, normalizeScenarioDraft, scenarioFromJson, scenarioHistoryReducer, scenarioToJson, type ScenarioDraftWithPopulationBasis } from "./lib/scenario-state";
import { fmtBn, fmtDiff } from "./lib/sim-data";
import { sgb2PreviewClient } from "./lib/sgb2-preview-client";
import type { Sgb2UiPreviewResult } from "./lib/sgb2-ui";
import type { MetricRecord, PopulationGenerationOptions, PopulationRun, ScenarioState, SourceRecord } from "./lib/types";
import { ComparisonPage } from "./pages/ComparisonPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExpenseModulesPage } from "./pages/ExpenseModulesPage";
import { IncomeTaxPage } from "./pages/IncomeTaxPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { PopulationPage } from "./pages/PopulationPage";
import { RevenueModulesPage } from "./pages/RevenueModulesPage";
import { TransparencyPage } from "./pages/TransparencyPage";
import { LongTermPage } from "./pages/LongTermPage";

function readRoute(): AppRoute {
  const path = window.location.hash.replace(/^#/, "") || "/";
  return (["/", "/dashboard", "/bevoelkerung", "/einkommensteuer", "/einnahmen", "/ausgaben", "/vergleich", "/langfrist", "/transparenz"] as AppRoute[]).includes(path as AppRoute) ? path as AppRoute : "/dashboard";
}

const legacyMetricIds: Record<string, string> = {
  "source-est": "metric-income-tax-revenue",
  "source-budget": "metric-public-budget-lines",
  "source-debt": "metric-public-debt",
};
const signedEuro = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(Math.round(value)).toLocaleString("de-DE")} € / Monat`;
const formatMillion = (value: number) => value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const centsToBillions = (value: number) => value / 100_000_000_000;
type DraftSaveStatus = "idle" | "saving" | "saved" | "error";

function createNewScenarioDraft(): ScenarioDraftWithPopulationBasis {
  return normalizeScenarioDraft({
    ...defaultScenarioDraft,
    name: "Neues Szenario",
    populationRunId: null,
    populationModelVersion: null,
    populationBasis: null,
    effectRunReference: null,
    sgb2: { ...defaultScenarioDraft.sgb2, populationRunId: null },
  });
}

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
  const [populationLoading, setPopulationLoading] = useState(false);
  const [populationGenerating, setPopulationGenerating] = useState(false);
  const [populationError, setPopulationError] = useState("");
  const [missingPopulationReference, setMissingPopulationReference] = useState<PopulationBasisReference | null>(null);
  const [sgb2Preview, setSgb2Preview] = useState<Sgb2UiPreviewResult | null>(null);
  const [sgb2PreviewLoading, setSgb2PreviewLoading] = useState(false);
  const [sgb2PreviewError, setSgb2PreviewError] = useState("");
  const [taxResult, setTaxResult] = useState<IncomeTaxResult>(() => estimateIncomeTaxRevenue(defaultScenarioDraft.incomeTax, defaultScenarioDraft.modelLevel));
  const [effectRun, setEffectRun] = useState<EffectRun | null>(null);
  const [effectLoading, setEffectLoading] = useState(false);
  const [effectError, setEffectError] = useState("");
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeRole, setNoticeRole] = useState<"status" | "alert">("status");
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>("idle");
  const [draftSavedAt, setDraftSavedAt] = useState<string>();
  const [draftSaveError, setDraftSaveError] = useState("");
  const [scenarioGuard, setScenarioGuard] = useState<ScenarioGuardRequest | null>(null);
  const [scenarioGuardBusy, setScenarioGuardBusy] = useState(false);
  const [scenarioGuardError, setScenarioGuardError] = useState("");
  const populationAttemptKey = useRef<string | null>(null);
  const effectRequest = useRef(0);
  const draftSaveSequence = useRef(0);
  const pendingDraftSaveTimer = useRef<number | null>(null);
  const scenarioSaveInFlight = useRef(false);
  const scenarioGuardInFlight = useRef(false);

  const scenario = history.present;
  const revenueModuleResults = useMemo(() => calculateRevenueModules(scenario.revenueChanges, scenario.modelLevel), [scenario.modelLevel, scenario.revenueChanges]);
  const baseExpenseModuleResults = useMemo(() => calculateExpenseModules(scenario.expenseChanges, scenario.modelLevel), [scenario.expenseChanges, scenario.modelLevel]);
  const expenseModuleResults = useMemo(() => baseExpenseModuleResults.map((item) => {
    if (item.id !== "social" || !sgb2Preview) return item;
    const baseline = centsToBillions(sgb2Preview.baselinePaymentCents);
    const value = centsToBillions(sgb2Preview.scenarioPaymentCents);
    const standard = sgb2Preview.components.find((component) => component.id === "standard-need");
    const additional = sgb2Preview.components.find((component) => component.id === "additional-need");
    const accommodation = sgb2Preview.components.find((component) => component.id === "accommodation");
    const heating = sgb2Preview.components.find((component) => component.id === "heating");
    const benefitValue = centsToBillions((standard?.scenarioCents ?? 0) + (additional?.scenarioCents ?? 0));
    const housingValue = centsToBillions((accommodation?.scenarioCents ?? 0) + (heating?.scenarioCents ?? 0));
    return {
      ...item,
      baseline,
      staticValue: value,
      value,
      staticDelta: value - baseline,
      feedbackAdjustment: 0,
      delta: value - baseline,
      lineValues: { ...item.lineValues, buerger: benefitValue, wohnen: housingValue },
      components: sgb2Preview.components.map((component) => ({ id: component.id, label: component.label, baseline: centsToBillions(component.baselineCents), value: centsToBillions(component.scenarioCents) })),
    };
  }), [baseExpenseModuleResults, sgb2Preview]);
  const budgetSummary = useMemo(() => calculateBudgetSummary({ incomeTaxResult: taxResult, revenueModules: revenueModuleResults, expenseModules: expenseModuleResults }), [expenseModuleResults, revenueModuleResults, taxResult]);
  const directFiscalDelta = taxResult.staticDelta + revenueModuleResults.reduce((sum, item) => sum + item.staticDelta, 0) - expenseModuleResults.reduce((sum, item) => sum + item.staticDelta, 0);
  const activeEffectContexts = useMemo(() => activeReformContextKeys(scenario).filter(hasContextualEffects), [scenario]);
  const effectParameters = useMemo(() => deriveReformEffectParameters(scenario, expenseModuleResults), [expenseModuleResults, scenario]);
  const routeNeedsEffects = route === "/einnahmen" || route === "/ausgaben" || route === "/vergleich";
  const hasActiveEffects = activeEffectContexts.length > 0;
  const routeNeedsPopulation = route === "/bevoelkerung" || route === "/einkommensteuer" || (route === "/ausgaben" && selectedExpenseModule === "social") || (routeNeedsEffects && hasActiveEffects);
  const showCompactModelBasis = route === "/einkommensteuer" || (route === "/ausgaben" && selectedExpenseModule === "social") || (routeNeedsEffects && hasActiveEffects);
  const currentEffectSignature = useMemo(() => activePopulation ? effectInputSignature({ scenario, populationRunId: activePopulation.metadata.id, parameters: effectParameters }) : undefined, [activePopulation, effectParameters, scenario]);
  const effectStatus: CalculationFreshness = hasActiveEffects ? resolveCalculationFreshness({
    loading: effectLoading || (routeNeedsEffects && populationLoading),
    hasResult: Boolean(effectRun),
    runModelLevel: effectRun?.modelLevel,
    runHorizonYears: effectRun?.horizonYears,
    modelLevel: scenario.modelLevel,
    horizonYears: scenario.horizonYears,
    runInputSignature: effectRun?.inputSignature,
    inputSignature: currentEffectSignature,
  }) : "current";
  const effectSummary = useMemo(() => summarizeScenarioEffects(activeEffectContexts, effectRun), [activeEffectContexts, effectRun]);

  const materializedScenario = useMemo<ScenarioDraftWithPopulationBasis>(() => ({
    ...scenario,
    modelVersion: "synthetic-population-0.7.0",
    sourceIds: Array.from(new Set([
      ...scenario.sourceIds,
      "source-revenue-model",
      "source-expense-model",
      "source-effect-engine",
      ...activeEffectContexts.flatMap(contextualSources),
      ...populationSources.map((source) => source.id),
      ...(sgb2Preview?.sourceIds ?? []),
    ])),
    revenueChanges: {
      ...scenario.revenueChanges,
      ...Object.fromEntries(revenueModuleResults.map((item) => [item.id, item.delta])),
      est: taxResult.delta,
      kredit: 0,
    },
    expenseChanges: {
      ...scenario.expenseChanges,
      ...Object.fromEntries(expenseModuleResults.map((item) => [item.id, item.delta])),
    },
  }), [activeEffectContexts, expenseModuleResults, revenueModuleResults, scenario, sgb2Preview?.sourceIds, taxResult.delta]);
  const activeSavedScenario = useMemo(
    () => activeScenarioId ? scenarios.find((item) => item.id === activeScenarioId) : undefined,
    [activeScenarioId, scenarios],
  );
  const hasChangesSinceSaved = Boolean(activeSavedScenario && scenarioToJson(materializedScenario) !== scenarioToJson(normalizeScenarioDraft(activeSavedScenario)));
  const hasUnsavedScenarioChanges = activeSavedScenario
    ? hasChangesSinceSaved
    : scenarioToJson(scenario) !== scenarioToJson(defaultScenarioDraft) && scenarioToJson(scenario) !== scenarioToJson(createNewScenarioDraft());

  const metricValues = useMemo<Record<string, string>>(() => {
    const { revenueTotal, expenseTotal, balance, revenueDelta, balanceDelta } = budgetSummary;
    const displayedTotal = (value: number | null) => value === null ? "nicht vollständig" : fmtBn(value);
    const revenueValues = Object.fromEntries(revenueModuleResults.map((item) => [`metric-revenue-${item.id}`, `${fmtBn(item.value)} · ${fmtDiff(item.delta)} · statisch ${fmtDiff(item.staticDelta)}`]));
    const expenseValues = Object.fromEntries(expenseModuleResults.map((item) => [`metric-expense-${item.id}`, `${fmtBn(item.value)} · ${fmtDiff(item.delta)} · direkt ${fmtDiff(item.staticDelta)}`]));
    const migration = expenseModuleResults.find((item) => item.id === "migration");
    return {
      "metric-total-revenue": displayedTotal(revenueTotal),
      "metric-total-expense": displayedTotal(expenseTotal),
      "metric-budget-balance": balance === null ? "nicht vollständig" : `${fmtBn(balance)} · ${balanceDelta === null ? "Änderung nicht berechnet" : fmtDiff(balanceDelta)}`,
      "metric-public-debt": "2.634,0 Mrd. € · Beispielwert; Datenstand nicht belegt",
      "metric-public-budget-lines": "positionsabhängig",
      "metric-income-tax-revenue": `${fmtBn(taxResult.value)} · ${fmtDiff(taxResult.delta)}`,
      "metric-income-tax-tariff": `${scenario.incomeTax.entryRate.toLocaleString("de-DE")}–${scenario.incomeTax.richRate.toLocaleString("de-DE")} %`,
      "metric-income-tax-distribution": `${formatMillion(taxResult.winnersM)} Mio. Gewinner · ${formatMillion(taxResult.losersM)} Mio. Verlierer`,
      "metric-household-examples": signedEuro(taxResult.medianMonthlyChange),
      "metric-regional-effects": "noch nicht berechnet",
      "metric-time-path": balanceDelta === null ? "nicht vollständig" : fmtDiff(balanceDelta),
      "metric-migration-components": migration ? `${fmtBn(migration.value)} · ${migration.components.map((item) => `${item.label} ${item.value.toLocaleString("de-DE", { maximumFractionDigits: 1 })}`).join(" · ")}` : "nicht berechnet",
      ...revenueValues,
      ...expenseValues,
    };
  }, [budgetSummary, expenseModuleResults, revenueModuleResults, scenario.incomeTax.entryRate, scenario.incomeTax.richRate, taxResult]);

  const refreshScenarios = useCallback(async () => setScenarios(await localServer.listScenarios()), []);
  const refreshPopulationRuns = useCallback(async () => setPopulationRuns(await localServer.listPopulationRuns()), []);

  const persistActiveDraft = useCallback(async (
    draftScenario: ScenarioDraftWithPopulationBasis = materializedScenario,
    draftScenarioId: string | null = activeScenarioId,
    requestSequence = ++draftSaveSequence.current,
  ) => {
    if (pendingDraftSaveTimer.current !== null) {
      window.clearTimeout(pendingDraftSaveTimer.current);
      pendingDraftSaveTimer.current = null;
    }
    setDraftSaveStatus("saving");
    setDraftSaveError("");
    const savedAt = new Date().toISOString();
    try {
      await localServer.saveActiveDraft({ activeScenarioId: draftScenarioId, scenario: draftScenario, savedAt });
      if (requestSequence === draftSaveSequence.current) {
        setDraftSavedAt(savedAt);
        setDraftSaveStatus("saved");
      }
    } catch (error) {
      if (requestSequence === draftSaveSequence.current) {
        setDraftSaveStatus("error");
        setDraftSaveError(error instanceof Error ? error.message : "Unbekannter Speicherfehler.");
      }
      throw error;
    }
  }, [activeScenarioId, materializedScenario]);

  useEffect(() => {
    let cancelled = false;
    const listener = () => setRoute(readRoute());
    window.addEventListener("hashchange", listener);
    void Promise.all([localServer.listSources(), localServer.listMetrics(), localServer.listScenarios(), localServer.getActiveDraft()])
      .then(([loadedSources, loadedMetrics, loadedScenarios, draft]) => {
        if (cancelled) return;
        setSources([...loadedSources, ...populationSources]);
        setMetrics(loadedMetrics);
        setScenarios(loadedScenarios);
        if (draft) {
          dispatch({ type: "replace", scenario: normalizeScenarioDraft(draft.scenario) });
          setActiveScenarioId(draft.activeScenarioId);
          setDraftSavedAt(draft.savedAt);
          setDraftSaveStatus(draft.savedAt ? "saved" : "idle");
        }
        setReady(true);
      })
      .catch((error) => {
        if (!cancelled) {
          setPopulationError(error instanceof Error ? error.message : "Lokale Datenbasis konnte nicht geladen werden.");
          setReady(true);
        }
      });
    return () => { cancelled = true; window.removeEventListener("hashchange", listener); };
  }, []);

  useEffect(() => {
    if (!ready || activePopulation || !routeNeedsPopulation) return;
    const reference = populationReferenceFromScenario(scenario);
    const attemptKey = reference?.runId ?? "__standard__";
    if (populationAttemptKey.current === attemptKey) return;
    populationAttemptKey.current = attemptKey;
    let cancelled = false;
    setPopulationLoading(true);
    setPopulationError("");

    const loadPopulation = async () => {
      try {
        let population: PopulationRun;
        if (reference) {
          try {
            population = await localServer.activatePopulation(reference.runId);
          } catch {
            const runs = await localServer.listPopulationRuns();
            if (!cancelled) {
              setPopulationRuns(runs);
              setMissingPopulationReference(reference);
              setPopulationError("");
            }
            return;
          }
        } else {
          population = await localServer.ensureStandardPopulation();
        }
        const runs = await localServer.listPopulationRuns();
        if (cancelled) return;
        const basis = populationBasisFromRun(population);
        setActivePopulation(population);
        setPopulationRuns(runs.map((run) => ({ ...run, metadata: { ...run.metadata, active: run.metadata.id === population.metadata.id } })));
        setMissingPopulationReference(null);
        setPopulationError("");
        if (scenario.populationRunId !== basis.runId || scenario.populationBasis?.runId !== basis.runId) {
          dispatch({
            type: "change",
            patch: {
              populationRunId: basis.runId,
              populationModelVersion: basis.modelVersion,
              populationBasis: basis,
              sgb2: { ...scenario.sgb2, populationRunId: basis.runId },
            },
          });
        }
      } catch (error) {
        if (!cancelled) setPopulationError(error instanceof Error ? error.message : "Modellbasis konnte nicht geladen werden.");
      } finally {
        if (!cancelled) setPopulationLoading(false);
      }
    };

    void loadPopulation();
    return () => { cancelled = true; };
  }, [activePopulation, ready, routeNeedsPopulation, scenario.populationBasis, scenario.populationModelVersion, scenario.populationRunId, scenario.sgb2]);

  useEffect(() => {
    if (!ready || !activePopulation) {
      setSgb2Preview(null);
      setSgb2PreviewLoading(false);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setSgb2PreviewLoading(true);
      setSgb2PreviewError("");
      void sgb2PreviewClient.preview(activePopulation.metadata.id, { ...scenario.sgb2, populationRunId: activePopulation.metadata.id })
        .then((preview) => { if (!cancelled) setSgb2Preview(preview); })
        .catch((error) => { if (!cancelled) setSgb2PreviewError(error instanceof Error ? error.message : "Bürgergeld-Vorschau konnte nicht berechnet werden."); })
        .finally(() => { if (!cancelled) setSgb2PreviewLoading(false); });
    }, 220);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [activePopulation, ready, scenario.sgb2]);

  useEffect(() => {
    if (!ready) return;
    const requestSequence = ++draftSaveSequence.current;
    setDraftSaveStatus("saving");
    setDraftSaveError("");
    const timeout = window.setTimeout(() => {
      if (pendingDraftSaveTimer.current === timeout) pendingDraftSaveTimer.current = null;
      void persistActiveDraft(materializedScenario, activeScenarioId, requestSequence).catch(() => undefined);
    }, 250);
    pendingDraftSaveTimer.current = timeout;
    return () => {
      window.clearTimeout(timeout);
      if (pendingDraftSaveTimer.current === timeout) pendingDraftSaveTimer.current = null;
    };
  }, [activeScenarioId, materializedScenario, persistActiveDraft, ready]);

  useEffect(() => {
    let cancelled = false;
    const fallback = () => { if (!cancelled) setTaxResult(estimateIncomeTaxRevenue(scenario.incomeTax, scenario.modelLevel)); };
    if (!ready || !activePopulation) {
      fallback();
      return () => { cancelled = true; };
    }
    void localServer.estimatePopulationIncomeTax(scenario.incomeTax, scenario.modelLevel, activePopulation.metadata.id)
      .then((result) => {
        if (!cancelled) {
          setTaxResult(result);
          setPopulationError("");
        }
      })
      .catch((error) => {
        fallback();
        if (!cancelled) setPopulationError(error instanceof Error ? error.message : "Einkommensteuer konnte die Modellbasis nicht laden.");
      });
    return () => { cancelled = true; };
  }, [activePopulation, ready, scenario.incomeTax, scenario.modelLevel]);

  const calculateEffects = useCallback(async (requestId: number) => {
    if (!activePopulation || !currentEffectSignature) {
      if (requestId === effectRequest.current) setEffectLoading(false);
      return;
    }
    setEffectError("");
    try {
      const result = await localServer.calculateEffects({
        scenarioId: activeScenarioId ?? "active-draft",
        populationRunId: activePopulation.metadata.id,
        modelLevel: scenario.modelLevel,
        horizonYears: scenario.horizonYears,
        dataYear: scenario.dataYear,
        legalYear: SUPPORTED_LEGAL_YEAR,
        inputSignature: currentEffectSignature,
        parameters: effectParameters,
      });
      if (requestId !== effectRequest.current) return;
      setEffectRun(result);
      dispatch({
        type: "sync",
        patch: {
          effectRunReference: {
            runId: result.id,
            modelVersion: result.modelVersion,
            populationRunId: result.populationRunId,
            modelLevel: result.modelLevel,
            horizonYears: result.horizonYears as 1 | 5 | 10 | 20,
            inputSignature: result.inputSignature ?? currentEffectSignature,
            calculatedAt: result.createdAt,
          },
        },
      });
    } catch (error) {
      if (requestId === effectRequest.current) setEffectError(error instanceof Error ? error.message : "Kontextbezogene Wirkungen konnten nicht berechnet werden.");
    } finally {
      if (requestId === effectRequest.current) setEffectLoading(false);
    }
  }, [activePopulation, activeScenarioId, currentEffectSignature, effectParameters, scenario.dataYear, scenario.horizonYears, scenario.modelLevel]);

  useEffect(() => {
    if (!ready || !routeNeedsEffects || !hasActiveEffects) {
      setEffectLoading(false);
      return;
    }
    if (!activePopulation || !currentEffectSignature) return;
    const requestId = ++effectRequest.current;
    setEffectLoading(true);
    setEffectError("");
    const timeout = window.setTimeout(() => void calculateEffects(requestId), 350);
    return () => window.clearTimeout(timeout);
  }, [activePopulation, calculateEffects, currentEffectSignature, hasActiveEffects, ready, routeNeedsEffects]);

  const retryEffects = () => {
    if (!activePopulation || !currentEffectSignature) return;
    const requestId = ++effectRequest.current;
    setEffectLoading(true);
    void calculateEffects(requestId);
  };

  const navigate = (next: AppRoute) => {
    if (window.location.hash === `#${next}`) setRoute(next);
    else window.location.hash = next;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const updateScenario = (patch: Partial<ScenarioDraftWithPopulationBasis>) => dispatch({ type: "change", patch });
  const showNotice = (message: string, role: "status" | "alert" = "status") => {
    setNotice(message);
    setNoticeRole(role);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const resetEffectState = () => {
    effectRequest.current += 1;
    setEffectRun(null);
    setEffectLoading(false);
    setEffectError("");
  };
  const requestScenarioReplacement = async (actionLabel: string, apply: () => void | Promise<void>) => {
    if (hasUnsavedScenarioChanges) {
      setScenarioGuardError("");
      setScenarioGuard({
        kind: "replace",
        scenarioName: scenario.name,
        actionLabel,
        savedScenarioExists: Boolean(activeSavedScenario),
        apply,
      });
      return;
    }
    await apply();
  };
  const cancelScenarioGuard = () => {
    if (scenarioGuardInFlight.current) return;
    setScenarioGuard(null);
    setScenarioGuardError("");
  };
  const resolveScenarioReplacement = async (choice: "save" | "discard") => {
    const request = scenarioGuard;
    if (request?.kind !== "replace" || scenarioGuardInFlight.current) return;
    scenarioGuardInFlight.current = true;
    setScenarioGuardBusy(true);
    setScenarioGuardError("");
    let savedVariantName: string | null = null;
    try {
      if (choice === "save") {
        if (scenarioSaveInFlight.current) throw new Error("Ein anderer Speichervorgang läuft bereits.");
        scenarioSaveInFlight.current = true;
        try {
          const now = new Date().toISOString();
          const name = materializedScenario.name.trim() || "Unbenanntes Szenario";
          const saved = await localServer.saveScenario({
            ...materializedScenario,
            id: crypto.randomUUID(),
            name: `${name} (Kopie)`,
            createdAt: now,
            updatedAt: now,
          });
          savedVariantName = saved.name;
          setScenarios((current) => [saved, ...current.filter((item) => item.id !== saved.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
        } finally {
          scenarioSaveInFlight.current = false;
        }
      }
      await request.apply();
      setScenarioGuard(null);
      setScenarioGuardError("");
      if (savedVariantName) showNotice(`„${savedVariantName}“ als Variante gesichert; ${request.actionLabel} abgeschlossen.`);
    } catch (error) {
      setScenarioGuardError(error instanceof Error ? error.message : "Der Entwurf konnte nicht gesichert werden.");
    } finally {
      scenarioGuardInFlight.current = false;
      setScenarioGuardBusy(false);
    }
  };
  const requestDeleteScenario = (saved: ScenarioState) => {
    setScenarioGuardError("");
    setScenarioGuard({ kind: "delete", scenario: saved, wasActive: saved.id === activeScenarioId });
  };
  const confirmDeleteScenario = async () => {
    const request = scenarioGuard;
    if (request?.kind !== "delete" || scenarioGuardInFlight.current) return;
    scenarioGuardInFlight.current = true;
    setScenarioGuardBusy(true);
    setScenarioGuardError("");
    try {
      if (request.wasActive) {
        await persistActiveDraft(materializedScenario, null);
      }
      await localServer.deleteScenario(request.scenario.id);
      if (request.wasActive) setActiveScenarioId(null);
      setScenarios((current) => current.filter((item) => item.id !== request.scenario.id));
      setScenarioGuard(null);
      showNotice(request.wasActive
        ? `„${request.scenario.name}“ gelöscht. Dein aktueller Entwurf bleibt erhalten.`
        : `„${request.scenario.name}“ gelöscht.`);
    } catch (error) {
      const details = error instanceof Error ? error.message : "Unbekannter Speicherfehler.";
      setScenarioGuardError(`„${request.scenario.name}“ konnte nicht gelöscht werden. ${details}`);
    } finally {
      scenarioGuardInFlight.current = false;
      setScenarioGuardBusy(false);
    }
  };
  const adoptPopulation = (run: PopulationRun) => {
    const basis = populationBasisFromRun(run);
    populationAttemptKey.current = basis.runId;
    setActivePopulation(run);
    setMissingPopulationReference(null);
    setPopulationError("");
    resetEffectState();
    updateScenario({ populationRunId: basis.runId, populationModelVersion: basis.modelVersion, populationBasis: basis, effectRunReference: null, sgb2: { ...scenario.sgb2, populationRunId: basis.runId } });
  };
  const openSource = (metricOrSourceId: string, value?: string) => {
    const metric = metrics.find((item) => item.id === (legacyMetricIds[metricOrSourceId] ?? metricOrSourceId));
    if (metric) { setDrawer({ metric, value: value ?? metricValues[metric.id] }); return; }
    const source = sources.find((item) => item.id === metricOrSourceId);
    if (source) {
      setDrawer({
        metric: {
          id: source.id,
          label: source.title,
          category: source.id.includes("effect") ? "Wirkungsmodell" : "Bevölkerung",
          description: source.summary,
          unit: "Nachweis",
          status: source.status,
          confidence: source.confidence,
          dataYear: source.dataYear,
          legalYear: source.legalYear,
          sourceIds: [source.id],
          formula: source.method,
          parameters: [],
          calculation: [{ label: "Verwendung", expression: source.method }],
          uncertainty: { kind: "range", description: source.limitations.join(" ") },
          limitations: source.limitations,
          changeLog: [{ date: source.checkedAt, version: "0.8.0", note: "Für den kontextbezogenen Wirkungsvertrag geprüft." }],
        },
      });
    }
  };

  const saveScenario = async () => {
    if (scenarioSaveInFlight.current) return;
    scenarioSaveInFlight.current = true;
    try {
      const now = new Date().toISOString();
      const existing = activeScenarioId ? scenarios.find((item) => item.id === activeScenarioId) : undefined;
      if (activeScenarioId && !existing) throw new Error("Die gespeicherte Szenariofassung wurde nicht gefunden. Lade die Seite neu und prüfe deine gespeicherten Szenarien.");
      const saved = await localServer.saveScenario({
        ...materializedScenario,
        id: existing?.id ?? crypto.randomUUID(),
        name: materializedScenario.name.trim() || "Unbenanntes Szenario",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      setActiveScenarioId(saved.id);
      await refreshScenarios();
      await persistActiveDraft(materializedScenario, saved.id);
      showNotice("Szenario lokal gespeichert");
    } catch (error) {
      const details = error instanceof Error ? error.message : "Unbekannter Speicherfehler.";
      showNotice(`Szenario konnte nicht vollständig gespeichert werden. Deine Eingaben bleiben erhalten. ${details}`, "alert");
    } finally {
      scenarioSaveInFlight.current = false;
    }
  };
  const loadScenario = async (saved: ScenarioState) => {
    await requestScenarioReplacement(`das gespeicherte Szenario „${saved.name}“ laden`, () => {
      const normalized = normalizeScenarioDraft(saved);
      populationAttemptKey.current = null;
      setActivePopulation(null);
      setMissingPopulationReference(null);
      setPopulationError("");
      resetEffectState();
      dispatch({ type: "replace", scenario: normalized });
      setActiveScenarioId(saved.id);
      navigate("/dashboard");
      showNotice(`„${saved.name}“ geladen`);
    });
  };
  const newScenario = () => {
    void requestScenarioReplacement("einen neuen Entwurf beginnen", () => {
      populationAttemptKey.current = null;
      setActivePopulation(null);
      setMissingPopulationReference(null);
      setPopulationError("");
      resetEffectState();
      dispatch({ type: "replace", scenario: createNewScenarioDraft() });
      setActiveScenarioId(null);
      showNotice("Neuer lokaler Entwurf angelegt");
    });
  };
  const duplicateScenario = async () => {
    if (scenarioSaveInFlight.current) return;
    scenarioSaveInFlight.current = true;
    try {
      const now = new Date().toISOString();
      const duplicate = { ...materializedScenario, id: crypto.randomUUID(), name: `${materializedScenario.name} (Kopie)`, createdAt: now, updatedAt: now };
      const saved = await localServer.saveScenario(duplicate);
      dispatch({ type: "replace", scenario: saved });
      setActiveScenarioId(saved.id);
      await refreshScenarios();
      await persistActiveDraft(normalizeScenarioDraft(saved), saved.id);
      showNotice("Neue Szenariovariante lokal gespeichert");
    } catch (error) {
      const details = error instanceof Error ? error.message : "Unbekannter Speicherfehler.";
      showNotice(`Neue Variante konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten. ${details}`, "alert");
    } finally {
      scenarioSaveInFlight.current = false;
    }
  };
  const exportScenario = () => {
    const blob = new Blob([scenarioToJson(materializedScenario)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${materializedScenario.name.trim().replace(/[^a-z0-9äöüß-]+/gi, "-").toLowerCase() || "szenario"}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showNotice("Szenario als JSON exportiert");
  };
  const importScenario = async (file: File) => {
    try {
      const imported = scenarioFromJson(await file.text());
      const runs = await localServer.listPopulationRuns();
      const reference = populationReferenceFromScenario(imported);
      await requestScenarioReplacement("das importierte Szenario laden", () => {
        populationAttemptKey.current = null;
        setActivePopulation(null);
        setPopulationRuns(runs);
        setPopulationError("");
        resetEffectState();
        setMissingPopulationReference(reference && !runs.some((run) => run.metadata.id === reference.runId) ? reference : null);
        dispatch({ type: "replace", scenario: imported });
        setActiveScenarioId(null);
        showNotice(reference && !runs.some((run) => run.metadata.id === reference.runId) ? "Szenario importiert; ursprüngliche Modellbasis fehlt lokal" : "Szenario importiert und als Entwurf geladen");
      });
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Szenario konnte nicht importiert werden");
    }
  };
  const copyScenario = async () => {
    try { await navigator.clipboard.writeText(scenarioToJson(materializedScenario)); showNotice("Szenario-JSON kopiert"); }
    catch { showNotice("Kopieren wurde vom Browser blockiert"); }
  };
  const navigateRevenueModule = (id: RevenueModuleId) => { setSelectedRevenueModule(id); navigate("/einnahmen"); };
  const navigateExpenseModule = (id: ExpenseModuleId) => { setSelectedExpenseModule(id); navigate("/ausgaben"); };

  const generatePopulation = async (options: PopulationGenerationOptions) => {
    setPopulationGenerating(true);
    setPopulationError("");
    try {
      const run = await localServer.generatePopulation(options);
      adoptPopulation(run);
      await refreshPopulationRuns();
      showNotice("Synthetische Modellbasis erzeugt und aktiviert");
    } catch (error) {
      setPopulationError(error instanceof Error ? error.message : "Modellbasis konnte nicht erzeugt werden.");
    } finally {
      setPopulationGenerating(false);
    }
  };
  const activatePopulation = async (runId: string) => {
    try {
      const run = await localServer.activatePopulation(runId);
      adoptPopulation(run);
      await refreshPopulationRuns();
      showNotice("Modellbasis für dieses Szenario geändert");
    } catch (error) {
      setPopulationError(error instanceof Error ? error.message : "Lauf konnte nicht aktiviert werden.");
    }
  };
  const deletePopulationRun = async (runId: string) => {
    try {
      const referenced = scenario.populationRunId === runId;
      const reference = referenced ? populationReferenceFromScenario(scenario) : null;
      await localServer.deletePopulationRun(runId);
      await refreshPopulationRuns();
      if (referenced && reference) {
        populationAttemptKey.current = reference.runId;
        setActivePopulation(null);
        setMissingPopulationReference(reference);
        setPopulationError("");
        resetEffectState();
        showNotice("Referenzierter Lauf gelöscht; Szenarioreferenz bleibt erhalten");
      }
    } catch (error) {
      setPopulationError(error instanceof Error ? error.message : "Lauf konnte nicht gelöscht werden.");
    }
  };
  const reconstructPopulation = async () => {
    if (!missingPopulationReference) return;
    setPopulationLoading(true);
    setPopulationError("");
    try {
      const run = await localServer.reconstructPopulation(missingPopulationReference);
      adoptPopulation(run);
      await refreshPopulationRuns();
      showNotice("Identische Modellbasis neu erzeugt");
    } catch (error) {
      setPopulationError(error instanceof Error ? error.message : "Identische Modellbasis konnte nicht erzeugt werden.");
    } finally {
      setPopulationLoading(false);
    }
  };
  const useStandardPopulation = async () => {
    setPopulationLoading(true);
    setPopulationError("");
    try {
      const run = await localServer.ensureStandardPopulation();
      adoptPopulation(run);
      await refreshPopulationRuns();
      showNotice("Standard-Modellbasis bewusst übernommen");
    } catch (error) {
      setPopulationError(error instanceof Error ? error.message : "Standard-Modellbasis konnte nicht bereitgestellt werden.");
    } finally {
      setPopulationLoading(false);
    }
  };
  const retryPopulation = () => {
    const reference = populationReferenceFromScenario(scenario);
    if (reference && canReconstructPopulationBasis(reference)) void reconstructPopulation();
    else void useStandardPopulation();
  };

  const modelBasisStatus: ModelBasisStatusKind = missingPopulationReference
    ? "missing"
    : populationError
      ? "error"
      : populationLoading || populationGenerating || !activePopulation
        ? "preparing"
        : activePopulation.metadata.quality.status === "warnung"
          ? "warning"
          : "ready";

  return <div className="app-shell">
    <AppBar route={route} scenarioName={scenario.name} canUndo={history.past.length > 0} canRedo={history.future.length > 0} onScenarioName={(name) => updateScenario({ name })} onNavigate={navigate} onUndo={() => dispatch({ type: "undo" })} onRedo={() => dispatch({ type: "redo" })} onSave={() => void saveScenario()} onOpenScenario={() => setScenarioPanelOpen(true)} />
    {showCompactModelBasis && <ModelBasisStatus status={modelBasisStatus} canReconstruct={canReconstructPopulationBasis(missingPopulationReference)} message={populationError || undefined} onReconstruct={() => void reconstructPopulation()} onUseStandard={() => void useStandardPopulation()} onRetry={retryPopulation} onManage={() => navigate("/bevoelkerung")} />}
    {route === "/" && <OnboardingPage modelLevel={scenario.modelLevel} horizonYears={scenario.horizonYears} onStart={() => navigate("/dashboard")} />}
    {route === "/dashboard" && <DashboardPage incomeTaxResult={taxResult} budgetSummary={budgetSummary} revenueModuleResults={revenueModuleResults} expenseModuleResults={expenseModuleResults} metrics={metrics} sources={sources} scenarios={scenarios} onNavigateIncomeTax={() => navigate("/einkommensteuer")} onNavigateRevenue={navigateRevenueModule} onNavigateExpense={navigateExpenseModule} onNavigateComparison={() => navigate("/vergleich")} onNavigateLongTerm={() => navigate("/langfrist")} onOpenSource={openSource} onLoadScenario={(saved) => void loadScenario(saved)} onDeleteScenario={requestDeleteScenario} />}
    {route === "/bevoelkerung" && <PopulationPage activeRun={activePopulation} runs={populationRuns} generating={populationLoading || populationGenerating} error={populationError} onGenerate={(options) => void generatePopulation(options)} onActivate={(runId) => void activatePopulation(runId)} onDelete={(runId) => void deletePopulationRun(runId)} onOpenSource={openSource} />}
    {route === "/einkommensteuer" && <IncomeTaxPage settings={scenario.incomeTax} modelLevel={scenario.modelLevel} horizonYears={scenario.horizonYears} result={taxResult} revenueResults={revenueModuleResults} onSettings={(incomeTax) => updateScenario({ incomeTax })} onNavigateRevenue={navigateRevenueModule} onBack={() => navigate("/dashboard")} onOpenSource={openSource} />}
    {route === "/einnahmen" && <RevenueModulesPage selectedId={selectedRevenueModule} results={revenueModuleResults} incomeTaxResult={taxResult} parameters={scenario.revenueChanges} modelLevel={scenario.modelLevel} horizonYears={scenario.horizonYears} effectRun={effectRun} effectStatus={effectStatus} effectError={effectError} populationAvailable={Boolean(activePopulation)} onSelect={setSelectedRevenueModule} onNavigateIncomeTax={() => navigate("/einkommensteuer")} onParameters={(revenueChanges) => updateScenario({ revenueChanges })} onRetryEffects={retryEffects} onOpenAdvancedEffects={() => navigate("/wirkungen")} onManageBasis={() => navigate("/bevoelkerung")} onBack={() => navigate("/dashboard")} onOpenSource={openSource} />}
    {route === "/ausgaben" && <ExpenseModulesPage selectedId={selectedExpenseModule} results={expenseModuleResults} parameters={scenario.expenseChanges} modelLevel={scenario.modelLevel} horizonYears={scenario.horizonYears} effectRun={effectRun} effectStatus={effectStatus} effectError={effectError} sgb2={scenario.sgb2} sgb2Preview={sgb2Preview} sgb2PreviewLoading={sgb2PreviewLoading} sgb2PreviewError={sgb2PreviewError} populationAvailable={Boolean(activePopulation)} onSelect={setSelectedExpenseModule} onParameters={(expenseChanges) => updateScenario({ expenseChanges })} onSgb2={(sgb2) => updateScenario({ sgb2 })} onRetryEffects={retryEffects} onOpenAdvancedEffects={() => navigate("/wirkungen")} onManageBasis={() => navigate("/bevoelkerung")} onBack={() => navigate("/dashboard")} onOpenSource={openSource} />}
    {route === "/vergleich" && <ComparisonPage settings={scenario.incomeTax} modelLevel={scenario.modelLevel} budgetSummary={budgetSummary} revenue={taxResult.value} directFiscalDelta={directFiscalDelta} effectSummary={effectSummary} effectStatus={effectStatus} effectError={effectError} onOpenAdvancedEffects={() => navigate("/wirkungen")} onOpenLongTerm={() => navigate("/langfrist")} onBack={() => navigate("/dashboard")} onOpenSource={openSource} />}
    {route === "/langfrist" && <LongTermPage settings={scenario.longTerm} onTargetYear={(targetYear) => updateScenario({ longTerm: { ...scenario.longTerm, targetYear } })} onBack={() => navigate("/vergleich")} onOpenSource={openSource} />}
    {route === "/transparenz" && <TransparencyPage metrics={metrics} sources={sources} values={metricValues} onOpenMetric={openSource} onNavigatePopulation={() => navigate("/bevoelkerung")} onNavigateEffects={() => navigate("/wirkungen")} />}
    {notice && <div className="toast" role={noticeRole}>{notice}</div>}
    <SourceDrawer metric={drawer?.metric ?? null} sources={sources} scenario={scenario} value={drawer?.value} onClose={() => setDrawer(null)} />
    <ScenarioPanel
      open={scenarioPanelOpen}
      scenario={scenario}
      activeScenarioId={activeScenarioId}
      savedCount={scenarios.length}
      draftSaveStatus={draftSaveStatus}
      draftSavedAt={draftSavedAt}
      draftSaveError={draftSaveError}
      savedScenarioExists={Boolean(activeSavedScenario)}
      hasChangesSinceSaved={hasChangesSinceSaved}
      savedScenarioUpdatedAt={activeSavedScenario?.updatedAt}
      onPatch={updateScenario}
      onClose={() => setScenarioPanelOpen(false)}
      onSaveDraft={() => persistActiveDraft()}
      onRetryDraftSave={() => persistActiveDraft()}
      onSave={() => void saveScenario()}
      onNew={newScenario}
      onDuplicate={() => void duplicateScenario()}
      onExport={exportScenario}
      onImport={importScenario}
      onCopy={() => void copyScenario()}
    />
    <ScenarioGuardDialog
      request={scenarioGuard}
      busy={scenarioGuardBusy}
      error={scenarioGuardError}
      onCancel={cancelScenarioGuard}
      onDelete={() => void confirmDeleteScenario()}
      onSaveVariant={() => void resolveScenarioReplacement("save")}
      onDiscard={() => void resolveScenarioReplacement("discard")}
    />
  </div>;
}

function populationReferenceFromScenario(scenario: ScenarioDraftWithPopulationBasis): PopulationBasisReference | null {
  if (scenario.populationBasis) return scenario.populationBasis;
  if (!scenario.populationRunId) return null;
  return {
    runId: scenario.populationRunId,
    modelVersion: scenario.populationModelVersion,
    seed: null,
    sampleSize: null,
    baselineId: null,
  };
}
