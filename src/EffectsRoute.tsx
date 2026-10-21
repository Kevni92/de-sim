import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppBar, type AppRoute } from "./components/AppBar";
import { ScenarioPanel } from "./components/ScenarioPanel";
import { calculateExpenseModules } from "./lib/expense-modules";
import { localServer } from "./lib/local-server-client";
import { SUPPORTED_LEGAL_YEAR } from "./lib/model-baseline";
import type { EffectModuleDefinition, EffectRun } from "./lib/long-term-effects";
import { deriveReformEffectParameters, effectInputSignature } from "./lib/reform-effects";
import { resolveCalculationFreshness } from "./lib/scenario-calculation";
import { defaultScenarioDraft, normalizeScenarioDraft, scenarioToJson, type ScenarioDraftWithPopulationBasis } from "./lib/scenario-state";
import type { PopulationRun, ScenarioState } from "./lib/types";
import { EffectsPage } from "./pages/EffectsPage";

export function EffectsRoute() {
  const [scenario, setScenario] = useState<ScenarioDraftWithPopulationBasis>(defaultScenarioDraft);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioState[]>([]);
  const [scenarioPanelOpen, setScenarioPanelOpen] = useState(false);
  const [modules, setModules] = useState<EffectModuleDefinition[]>([]);
  const [populationRun, setPopulationRun] = useState<PopulationRun | null>(null);
  const [run, setRun] = useState<EffectRun | null>(null);
  const [ready, setReady] = useState(false);
  const [draftSaveStatus, setDraftSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draftSavedAt, setDraftSavedAt] = useState<string>();
  const [draftSaveError, setDraftSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeRole, setNoticeRole] = useState<"status" | "alert">("status");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const calculationRequest = useRef(0);
  const draftSaveSequence = useRef(0);
  const pendingDraftSaveTimer = useRef<number | null>(null);
  const scenarioSaveInFlight = useRef(false);
  const expenseResults = useMemo(() => calculateExpenseModules(scenario.expenseChanges, scenario.modelLevel), [scenario.expenseChanges, scenario.modelLevel]);
  const calculationParameters = useMemo(() => deriveReformEffectParameters(scenario, expenseResults), [expenseResults, scenario.effectParameters, scenario.expenseChanges]);
  const inputSignature = useMemo(() => populationRun ? effectInputSignature({ scenario, populationRunId: scenario.populationRunId ?? populationRun.metadata.id, parameters: calculationParameters }) : undefined, [calculationParameters, populationRun, scenario.dataYear, scenario.expenseChanges, scenario.horizonYears, scenario.modelLevel, scenario.populationRunId, scenario.revenueChanges]);
  const activeSavedScenario = useMemo(() => activeScenarioId ? scenarios.find((item) => item.id === activeScenarioId) : undefined, [activeScenarioId, scenarios]);
  const hasChangesSinceSaved = Boolean(activeSavedScenario && scenarioToJson(scenario) !== scenarioToJson(normalizeScenarioDraft(activeSavedScenario)));

  const navigate = (route: AppRoute) => {
    window.location.hash = route;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      localServer.getActiveDraft(),
      localServer.listScenarios(),
      localServer.listEffectModules(),
      localServer.getActivePopulation(),
    ]).then(([draft, savedScenarios, loadedModules, population]: [Awaited<ReturnType<typeof localServer.getActiveDraft>>, ScenarioState[], EffectModuleDefinition[], PopulationRun]) => {
      if (cancelled) return;
      const nextScenario = normalizeScenarioDraft(draft?.scenario ?? defaultScenarioDraft);
      setScenario(nextScenario);
      setActiveScenarioId(draft?.activeScenarioId ?? null);
      setScenarios(savedScenarios);
      setDraftSavedAt(draft?.savedAt);
      setDraftSaveStatus(draft?.savedAt ? "saved" : "idle");
      setModules(loadedModules);
      setPopulationRun(population);
      setReady(true);
    }).catch((cause) => {
      if (!cancelled) {
        setError(cause instanceof Error ? cause.message : "Wirkungs-Engine konnte nicht geladen werden.");
        setReady(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const persistActiveDraft = useCallback(async (
    draftScenario: ScenarioDraftWithPopulationBasis = scenario,
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
    } catch (cause) {
      if (requestSequence === draftSaveSequence.current) {
        setDraftSaveStatus("error");
        setDraftSaveError(cause instanceof Error ? cause.message : "Unbekannter Speicherfehler.");
      }
      throw cause;
    }
  }, [activeScenarioId, scenario]);

  useEffect(() => {
    if (!ready) return;
    const requestSequence = ++draftSaveSequence.current;
    setDraftSaveStatus("saving");
    setDraftSaveError("");
    const timeout = window.setTimeout(() => {
      if (pendingDraftSaveTimer.current === timeout) pendingDraftSaveTimer.current = null;
      void persistActiveDraft(scenario, activeScenarioId, requestSequence).catch(() => undefined);
    }, 250);
    pendingDraftSaveTimer.current = timeout;
    return () => {
      window.clearTimeout(timeout);
      if (pendingDraftSaveTimer.current === timeout) pendingDraftSaveTimer.current = null;
    };
  }, [activeScenarioId, persistActiveDraft, ready, scenario]);

  const calculate = useCallback(async (requestId: number) => {
    const populationRunId = scenario.populationRunId ?? populationRun?.metadata.id;
    if (!populationRunId || !inputSignature) {
      if (requestId === calculationRequest.current) {
        setError("Für die Wirkungsrechnung ist eine verfügbare Modellbasis erforderlich.");
        setLoading(false);
      }
      return;
    }
    setError("");
    try {
      const result = await localServer.calculateEffects({
        scenarioId: activeScenarioId ?? "active-draft",
        populationRunId,
        modelLevel: scenario.modelLevel,
        horizonYears: scenario.horizonYears,
        dataYear: scenario.dataYear,
        legalYear: SUPPORTED_LEGAL_YEAR,
        inputSignature,
        parameters: calculationParameters,
      });
      if (requestId === calculationRequest.current) {
        setRun(result);
        setScenario((current) => normalizeScenarioDraft({
          ...current,
          effectRunReference: {
            runId: result.id,
            modelVersion: result.modelVersion,
            populationRunId: result.populationRunId,
            modelLevel: result.modelLevel,
            horizonYears: result.horizonYears as 1 | 5 | 10 | 20,
            inputSignature: result.inputSignature ?? inputSignature,
            calculatedAt: result.createdAt,
          },
        }));
      }
    } catch (cause) {
      if (requestId === calculationRequest.current) setError(cause instanceof Error ? cause.message : "Wirkungen konnten nicht berechnet werden.");
    } finally {
      if (requestId === calculationRequest.current) setLoading(false);
    }
  }, [activeScenarioId, calculationParameters, inputSignature, populationRun?.metadata.id, scenario.dataYear, scenario.horizonYears, scenario.modelLevel, scenario.populationRunId]);

  useEffect(() => {
    if (!ready || !populationRun || modules.length === 0 || !inputSignature) return;
    const requestId = ++calculationRequest.current;
    setLoading(true);
    setError("");
    const timeout = window.setTimeout(() => void calculate(requestId), 350);
    return () => window.clearTimeout(timeout);
  }, [calculate, inputSignature, modules.length, populationRun, ready]);

  const retryCalculation = () => {
    const requestId = ++calculationRequest.current;
    setLoading(true);
    void calculate(requestId);
  };
  const patch = (value: Partial<ScenarioDraftWithPopulationBasis>) => setScenario((current) => normalizeScenarioDraft({ ...current, ...value }));
  const refreshScenarios = useCallback(async () => setScenarios(await localServer.listScenarios()), []);
  const showNotice = (message: string, role: "status" | "alert" = "status") => {
    setNotice(message);
    setNoticeRole(role);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const saveScenario = async () => {
    if (scenarioSaveInFlight.current) return;
    scenarioSaveInFlight.current = true;
    try {
      const now = new Date().toISOString();
      const existing = activeScenarioId ? scenarios.find((item) => item.id === activeScenarioId) : undefined;
      if (activeScenarioId && !existing) throw new Error("Die gespeicherte Szenariofassung wurde nicht gefunden. Lade die Seite neu und prüfe deine gespeicherten Szenarien.");
      const saved = await localServer.saveScenario({
        ...scenario,
        id: existing?.id ?? crypto.randomUUID(),
        name: scenario.name.trim() || "Unbenanntes Szenario",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      setActiveScenarioId(saved.id);
      await refreshScenarios();
      await persistActiveDraft(scenario, saved.id);
      showNotice("Szenario lokal gespeichert");
    } catch (cause) {
      const details = cause instanceof Error ? cause.message : "Unbekannter Speicherfehler.";
      showNotice(`Szenario konnte nicht vollständig gespeichert werden. Deine Eingaben bleiben erhalten. ${details}`, "alert");
    } finally {
      scenarioSaveInFlight.current = false;
    }
  };
  const duplicateScenario = async () => {
    if (scenarioSaveInFlight.current) return;
    scenarioSaveInFlight.current = true;
    try {
      const now = new Date().toISOString();
      const duplicate = { ...scenario, id: crypto.randomUUID(), name: `${scenario.name} (Kopie)`, createdAt: now, updatedAt: now };
      const saved = await localServer.saveScenario(duplicate);
      const nextScenario = normalizeScenarioDraft(saved);
      setScenario(nextScenario);
      setActiveScenarioId(saved.id);
      await refreshScenarios();
      await persistActiveDraft(nextScenario, saved.id);
      showNotice("Neue Szenariovariante lokal gespeichert");
    } catch (cause) {
      const details = cause instanceof Error ? cause.message : "Unbekannter Speicherfehler.";
      showNotice(`Neue Variante konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten. ${details}`, "alert");
    } finally {
      scenarioSaveInFlight.current = false;
    }
  };
  const calculationStatus = resolveCalculationFreshness({
    loading: loading || !ready,
    hasResult: Boolean(run),
    runModelLevel: run?.modelLevel,
    runHorizonYears: run?.horizonYears,
    modelLevel: scenario.modelLevel,
    horizonYears: scenario.horizonYears,
    runInputSignature: run?.inputSignature,
    inputSignature,
  });

  return <div className="app-shell">
    <AppBar
      route="/wirkungen"
      scenarioName={scenario.name}
      canUndo={false}
      canRedo={false}
      onScenarioName={(name) => patch({ name })}
      onNavigate={navigate}
      onUndo={() => undefined}
      onRedo={() => undefined}
      onSave={() => void saveScenario()}
      onOpenScenario={() => setScenarioPanelOpen(true)}
    />
    <EffectsPage
      modules={modules}
      run={run}
      parameters={calculationParameters}
      modelLevel={scenario.modelLevel}
      horizonYears={scenario.horizonYears}
      populationRun={populationRun}
      loading={loading || !ready}
      calculationStatus={calculationStatus}
      error={error}
      onParameters={(effectParameters) => patch({ effectParameters })}
      onCalculate={retryCalculation}
      onOpenSource={() => navigate("/transparenz")}
      onBack={() => navigate("/dashboard")}
    />
    <ScenarioPanel
      open={scenarioPanelOpen}
      scenario={scenario}
      activeScenarioId={activeScenarioId}
      savedCount={scenarios.length}
      draftSaveStatus={draftSaveStatus}
      draftSavedAt={draftSavedAt}
      draftSaveError={draftSaveError}
      savedScenarioExists={Boolean(activeSavedScenario)}
      savedScenarioUpdatedAt={activeSavedScenario?.updatedAt}
      hasChangesSinceSaved={hasChangesSinceSaved}
      onPatch={patch}
      onClose={() => setScenarioPanelOpen(false)}
      onSaveDraft={() => persistActiveDraft()}
      onRetryDraftSave={() => persistActiveDraft()}
      onSave={() => void saveScenario()}
      onDuplicate={() => void duplicateScenario()}
    />
    {notice && <div className="toast" role={noticeRole}>{notice}</div>}
  </div>;
}
