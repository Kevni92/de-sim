import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { AppBar } from "./components/AppBar";
import { ScenarioPanel } from "./components/ScenarioPanel";
import { SourceDrawer } from "./components/SourceDrawer";
import {
  createScenarioHistory,
  defaultScenarioDraft,
  normalizeScenarioDraft,
  scenarioFromJson,
  scenarioHistoryReducer,
  scenarioToJson,
} from "./lib/scenario-state";
import { estimateIncomeTaxRevenue } from "./lib/sim-data";
import { localServer } from "./lib/local-server-client";
import type { ScenarioDraft, ScenarioState, SourceRecord } from "./lib/types";
import { ComparisonPage } from "./pages/ComparisonPage";
import { DashboardPage } from "./pages/DashboardPage";
import { IncomeTaxPage } from "./pages/IncomeTaxPage";
import { OnboardingPage } from "./pages/OnboardingPage";

type Route = "/" | "/dashboard" | "/einkommensteuer" | "/vergleich";

function readRoute(): Route {
  const path = window.location.hash.replace(/^#/, "") || "/";
  return (["/", "/dashboard", "/einkommensteuer", "/vergleich"] as Route[]).includes(path as Route) ? path as Route : "/dashboard";
}

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [drawer, setDrawer] = useState<{ source: SourceRecord; value?: string } | null>(null);
  const [scenarioPanelOpen, setScenarioPanelOpen] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioState[]>([]);
  const [history, dispatch] = useReducer(scenarioHistoryReducer, defaultScenarioDraft, createScenarioHistory);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  const scenario = history.present;
  const taxResult = useMemo(
    () => estimateIncomeTaxRevenue(scenario.incomeTax, scenario.modelLevel),
    [scenario.incomeTax, scenario.modelLevel],
  );
  const materializedScenario = useMemo<ScenarioDraft>(() => ({
    ...scenario,
    revenueChanges: { ...scenario.revenueChanges, est: taxResult.delta, kredit: -taxResult.delta },
  }), [scenario, taxResult.delta]);

  const refreshScenarios = useCallback(async () => setScenarios(await localServer.listScenarios()), []);

  useEffect(() => {
    let cancelled = false;
    const listener = () => setRoute(readRoute());
    window.addEventListener("hashchange", listener);

    void Promise.all([
      localServer.listSources(),
      localServer.listScenarios(),
      localServer.getActiveDraft(),
    ]).then(([loadedSources, loadedScenarios, draft]) => {
      if (cancelled) return;
      setSources(loadedSources);
      setScenarios(loadedScenarios);
      if (draft) {
        dispatch({ type: "replace", scenario: normalizeScenarioDraft(draft.scenario) });
        setActiveScenarioId(draft.activeScenarioId);
      }
      setReady(true);
    });

    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", listener);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timeout = window.setTimeout(() => {
      void localServer.saveActiveDraft({ activeScenarioId, scenario: materializedScenario });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [activeScenarioId, materializedScenario, ready]);

  const navigate = (next: Route) => {
    if (window.location.hash === `#${next}`) setRoute(next);
    else window.location.hash = next;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateScenario = (patch: Partial<ScenarioDraft>) => dispatch({ type: "change", patch });

  const openSource = (sourceId: string, value?: string) => {
    const source = sources.find((item) => item.id === sourceId) ?? sources[0];
    if (source) setDrawer({ source, value });
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const saveScenario = async () => {
    const now = new Date().toISOString();
    const existing = activeScenarioId ? scenarios.find((item) => item.id === activeScenarioId) : undefined;
    const saved = await localServer.saveScenario({
      ...materializedScenario,
      id: existing?.id ?? crypto.randomUUID(),
      name: materializedScenario.name.trim() || "Unbenanntes Szenario",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    setActiveScenarioId(saved.id);
    await refreshScenarios();
    showNotice("Szenario lokal gespeichert");
  };

  const loadScenario = (saved: ScenarioState) => {
    dispatch({ type: "replace", scenario: normalizeScenarioDraft(saved) });
    setActiveScenarioId(saved.id);
    navigate("/dashboard");
    showNotice(`„${saved.name}“ geladen`);
  };

  const deleteScenario = async (saved: ScenarioState) => {
    await localServer.deleteScenario(saved.id);
    if (saved.id === activeScenarioId) setActiveScenarioId(null);
    await refreshScenarios();
    showNotice(`„${saved.name}“ gelöscht`);
  };

  const newScenario = () => {
    dispatch({ type: "replace", scenario: { ...defaultScenarioDraft, name: "Neues Szenario" } });
    setActiveScenarioId(null);
    showNotice("Neuer lokaler Entwurf angelegt");
  };

  const duplicateScenario = async () => {
    const now = new Date().toISOString();
    const duplicate: ScenarioState = {
      ...materializedScenario,
      id: crypto.randomUUID(),
      name: `${materializedScenario.name} (Kopie)`,
      createdAt: now,
      updatedAt: now,
    };
    await localServer.saveScenario(duplicate);
    dispatch({ type: "replace", scenario: duplicate });
    setActiveScenarioId(duplicate.id);
    await refreshScenarios();
    showNotice("Szenario dupliziert");
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
      dispatch({ type: "replace", scenario: imported });
      setActiveScenarioId(null);
      showNotice("Szenario importiert und als Entwurf geladen");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Szenario konnte nicht importiert werden");
    }
  };

  const copyScenario = async () => {
    try {
      await navigator.clipboard.writeText(scenarioToJson(materializedScenario));
      showNotice("Szenario-JSON kopiert");
    } catch {
      showNotice("Kopieren wurde vom Browser blockiert");
    }
  };

  return (
    <div className="app-shell">
      <AppBar
        route={route}
        scenarioName={scenario.name}
        legalYear={scenario.legalYear}
        dataYear={scenario.dataYear}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onScenarioName={(name) => updateScenario({ name })}
        onNavigate={navigate}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        onSave={() => void saveScenario()}
        onOpenScenario={() => setScenarioPanelOpen(true)}
      />

      {route === "/" && <OnboardingPage modelLevel={scenario.modelLevel} onModelLevel={(modelLevel) => updateScenario({ modelLevel })} onStart={() => navigate("/dashboard")} />}
      {route === "/dashboard" && <DashboardPage incomeTaxValue={taxResult.value} incomeTaxDelta={taxResult.delta} scenarios={scenarios} onNavigateIncomeTax={() => navigate("/einkommensteuer")} onNavigateComparison={() => navigate("/vergleich")} onOpenSource={openSource} onLoadScenario={loadScenario} onDeleteScenario={(saved) => void deleteScenario(saved)} />}
      {route === "/einkommensteuer" && <IncomeTaxPage settings={scenario.incomeTax} modelLevel={scenario.modelLevel} revenue={taxResult.value} delta={taxResult.delta} onSettings={(incomeTax) => updateScenario({ incomeTax })} onModelLevel={(modelLevel) => updateScenario({ modelLevel })} onBack={() => navigate("/dashboard")} onApply={() => navigate("/dashboard")} onOpenSource={openSource} />}
      {route === "/vergleich" && <ComparisonPage settings={scenario.incomeTax} revenue={taxResult.value} onBack={() => navigate("/dashboard")} onOpenSource={openSource} />}

      {notice && <div className="toast" role="status">{notice}</div>}
      <SourceDrawer source={drawer?.source ?? null} value={drawer?.value} onClose={() => setDrawer(null)} />
      <ScenarioPanel
        open={scenarioPanelOpen}
        scenario={scenario}
        activeScenarioId={activeScenarioId}
        savedCount={scenarios.length}
        onPatch={updateScenario}
        onClose={() => setScenarioPanelOpen(false)}
        onNew={newScenario}
        onDuplicate={() => void duplicateScenario()}
        onExport={exportScenario}
        onImport={importScenario}
        onCopy={() => void copyScenario()}
      />
    </div>
  );
}
