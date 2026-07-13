import { useCallback, useEffect, useState } from "react";
import { AppBar, type AppRoute } from "./components/AppBar";
import { localServer } from "./lib/local-server-client";
import type { EffectModuleDefinition, EffectRun } from "./lib/long-term-effects";
import { defaultScenarioDraft, normalizeScenarioDraft } from "./lib/scenario-state";
import type { PopulationRun, ScenarioDraft, TimeHorizon } from "./lib/types";
import { EffectsPage } from "./pages/EffectsPage";

export function EffectsRoute() {
  const [scenario, setScenario] = useState<ScenarioDraft>(defaultScenarioDraft);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [modules, setModules] = useState<EffectModuleDefinition[]>([]);
  const [populationRun, setPopulationRun] = useState<PopulationRun | null>(null);
  const [run, setRun] = useState<EffectRun | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = (route: AppRoute) => {
    window.location.hash = route;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      localServer.getActiveDraft(),
      localServer.listEffectModules(),
      localServer.getActivePopulation(),
    ]).then(([draft, loadedModules, population]) => {
      if (cancelled) return;
      const nextScenario = normalizeScenarioDraft(draft?.scenario ?? defaultScenarioDraft);
      setScenario(nextScenario);
      setActiveScenarioId(draft?.activeScenarioId ?? null);
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

  const calculate = useCallback(async () => {
    const populationRunId = scenario.populationRunId ?? populationRun?.metadata.id;
    if (!populationRunId) {
      setError("Für die Wirkungsrechnung ist ein aktiver Bevölkerungslauf erforderlich.");
      return;
    }
    setLoading(true);
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
      setRun(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wirkungen konnten nicht berechnet werden.");
    } finally {
      setLoading(false);
    }
  }, [activeScenarioId, populationRun?.metadata.id, scenario]);

  useEffect(() => {
    if (!ready || !populationRun || modules.length === 0) return;
    const timeout = window.setTimeout(() => void calculate(), 350);
    return () => window.clearTimeout(timeout);
  }, [calculate, modules.length, populationRun, ready]);

  const patch = (value: Partial<ScenarioDraft>) => setScenario((current) => normalizeScenarioDraft({ ...current, ...value }));

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
      onOpenScenario={() => navigate("/dashboard")}
    />
    <EffectsPage
      modules={modules}
      run={run}
      parameters={scenario.effectParameters}
      modelLevel={scenario.modelLevel}
      horizonYears={scenario.horizonYears}
      populationRun={populationRun}
      loading={loading || !ready}
      error={error}
      onParameters={(effectParameters) => patch({ effectParameters })}
      onModelLevel={(modelLevel) => patch({ modelLevel })}
      onHorizon={(horizonYears: TimeHorizon) => patch({ horizonYears })}
      onCalculate={() => void calculate()}
      onOpenSource={() => navigate("/transparenz")}
      onBack={() => navigate("/dashboard")}
    />
  </div>;
}
