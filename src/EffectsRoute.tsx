import { useCallback, useEffect, useRef, useState } from "react";
import { AppBar, type AppRoute } from "./components/AppBar";
import { ScenarioPanel } from "./components/ScenarioPanel";
import { localServer } from "./lib/local-server-client";
import type { EffectModuleDefinition, EffectRun } from "./lib/long-term-effects";
import { resolveCalculationFreshness } from "./lib/scenario-calculation";
import { defaultScenarioDraft, normalizeScenarioDraft } from "./lib/scenario-state";
import type { PopulationRun, ScenarioDraft, ScenarioState } from "./lib/types";
import { EffectsPage } from "./pages/EffectsPage";

export function EffectsRoute() {
  const [scenario, setScenario] = useState<ScenarioDraft>(defaultScenarioDraft);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [scenarioPanelOpen, setScenarioPanelOpen] = useState(false);
  const [modules, setModules] = useState<EffectModuleDefinition[]>([]);
  const [populationRun, setPopulationRun] = useState<PopulationRun | null>(null);
  const [run, setRun] = useState<EffectRun | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const calculationRequest = useRef(0);

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
      setSavedCount(savedScenarios.length);
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

  useEffect(() => {
    if (!ready) return;
    const timeout = window.setTimeout(() => {
      void localServer.saveActiveDraft({ activeScenarioId, scenario });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [activeScenarioId, ready, scenario]);

  const calculate = useCallback(async (requestId: number) => {
    const populationRunId = scenario.populationRunId ?? populationRun?.metadata.id;
    if (!populationRunId) {
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
        legalYear: scenario.legalYear,
        parameters: scenario.effectParameters,
      });
      if (requestId === calculationRequest.current) setRun(result);
    } catch (cause) {
      if (requestId === calculationRequest.current) setError(cause instanceof Error ? cause.message : "Wirkungen konnten nicht berechnet werden.");
    } finally {
      if (requestId === calculationRequest.current) setLoading(false);
    }
  }, [activeScenarioId, populationRun?.metadata.id, scenario]);

  useEffect(() => {
    if (!ready || !populationRun || modules.length === 0) return;
    const requestId = ++calculationRequest.current;
    setLoading(true);
    setError("");
    const timeout = window.setTimeout(() => void calculate(requestId), 350);
    return () => window.clearTimeout(timeout);
  }, [calculate, modules.length, populationRun, ready]);

  const retryCalculation = () => {
    const requestId = ++calculationRequest.current;
    setLoading(true);
    void calculate(requestId);
  };
  const patch = (value: Partial<ScenarioDraft>) => setScenario((current) => normalizeScenarioDraft({ ...current, ...value }));
  const calculationStatus = resolveCalculationFreshness({
    loading: loading || !ready,
    hasResult: Boolean(run),
    runModelLevel: run?.modelLevel,
    runHorizonYears: run?.horizonYears,
    modelLevel: scenario.modelLevel,
    horizonYears: scenario.horizonYears,
  });

  return <div className="app-shell">
    <AppBar
      route="/wirkungen"
      scenarioName={scenario.name}
      legalYear={scenario.legalYear}
      dataYear={scenario.dataYear}
      canUndo={false}
      canRedo={false}
      onScenarioName={(name) => patch({ name })}
      onNavigate={navigate}
      onUndo={() => undefined}
      onRedo={() => undefined}
      onSave={() => void localServer.saveActiveDraft({ activeScenarioId, scenario })}
      onOpenScenario={() => setScenarioPanelOpen(true)}
    />
    <EffectsPage
      modules={modules}
      run={run}
      parameters={scenario.effectParameters}
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
      savedCount={savedCount}
      onPatch={patch}
      onClose={() => setScenarioPanelOpen(false)}
    />
  </div>;
}
