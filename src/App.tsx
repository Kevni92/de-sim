import { useCallback, useEffect, useMemo, useState } from "react";
import { AppBar } from "./components/AppBar";
import { SourceDrawer } from "./components/SourceDrawer";
import { baselineIncomeTax, estimateIncomeTaxRevenue } from "./lib/sim-data";
import { localServer } from "./lib/local-server-client";
import type { IncomeTaxSettings, ModelLevel, ScenarioState, SourceRecord } from "./lib/types";
import { ComparisonPage } from "./pages/ComparisonPage";
import { DashboardPage } from "./pages/DashboardPage";
import { IncomeTaxPage } from "./pages/IncomeTaxPage";
import { OnboardingPage } from "./pages/OnboardingPage";

type Route = "/" | "/dashboard" | "/einkommensteuer" | "/vergleich";

const initialTaxSettings: IncomeTaxSettings = {
  ...baselineIncomeTax,
  allowance: 13_500,
  entryRate: 12,
  topThreshold: 75_000,
};

function readRoute(): Route {
  const path = window.location.hash.replace(/^#/, "") || "/";
  return (["/", "/dashboard", "/einkommensteuer", "/vergleich"] as Route[]).includes(path as Route) ? path as Route : "/dashboard";
}

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [drawer, setDrawer] = useState<{ source: SourceRecord; value?: string } | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioState[]>([]);
  const [scenarioName, setScenarioName] = useState("Reformentwurf A");
  const [modelLevel, setModelLevel] = useState<ModelLevel>("verhalten");
  const [incomeTax, setIncomeTax] = useState<IncomeTaxSettings>(initialTaxSettings);
  const [notice, setNotice] = useState("");

  const refreshScenarios = useCallback(async () => setScenarios(await localServer.listScenarios()), []);

  useEffect(() => {
    const listener = () => setRoute(readRoute());
    window.addEventListener("hashchange", listener);
    void localServer.listSources().then(setSources);
    void refreshScenarios();
    return () => window.removeEventListener("hashchange", listener);
  }, [refreshScenarios]);

  const taxResult = useMemo(() => estimateIncomeTaxRevenue(incomeTax, modelLevel), [incomeTax, modelLevel]);

  const navigate = (next: Route) => {
    if (window.location.hash === `#${next}`) setRoute(next);
    else window.location.hash = next;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openSource = (sourceId: string, value?: string) => {
    const source = sources.find((item) => item.id === sourceId) ?? sources[0];
    if (source) setDrawer({ source, value });
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const saveScenario = async () => {
    const now = new Date().toISOString();
    const normalizedName = scenarioName.trim() || "Unbenanntes Szenario";
    const existing = scenarios.find((scenario) => scenario.name === normalizedName);
    await localServer.saveScenario({
      id: existing?.id ?? crypto.randomUUID(),
      name: normalizedName,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      modelLevel,
      revenueChanges: { est: taxResult.delta, kredit: -taxResult.delta },
      expenseChanges: {},
      incomeTax,
    });
    await refreshScenarios();
    showNotice("Szenario lokal gespeichert");
  };

  const loadScenario = (scenario: ScenarioState) => {
    setScenarioName(scenario.name);
    setModelLevel(scenario.modelLevel);
    if (scenario.incomeTax) setIncomeTax(scenario.incomeTax);
    navigate("/dashboard");
    showNotice(`„${scenario.name}“ geladen`);
  };

  const deleteScenario = async (scenario: ScenarioState) => {
    await localServer.deleteScenario(scenario.id);
    await refreshScenarios();
    showNotice(`„${scenario.name}“ gelöscht`);
  };

  return (
    <div className="app-shell">
      <AppBar route={route} scenarioName={scenarioName} onScenarioName={setScenarioName} onNavigate={navigate} onSave={() => void saveScenario()} />

      {route === "/" && <OnboardingPage modelLevel={modelLevel} onModelLevel={setModelLevel} onStart={() => navigate("/dashboard")} />}
      {route === "/dashboard" && <DashboardPage incomeTaxValue={taxResult.value} incomeTaxDelta={taxResult.delta} scenarios={scenarios} onNavigateIncomeTax={() => navigate("/einkommensteuer")} onNavigateComparison={() => navigate("/vergleich")} onOpenSource={openSource} onLoadScenario={loadScenario} onDeleteScenario={(scenario) => void deleteScenario(scenario)} />}
      {route === "/einkommensteuer" && <IncomeTaxPage settings={incomeTax} modelLevel={modelLevel} revenue={taxResult.value} delta={taxResult.delta} onSettings={setIncomeTax} onModelLevel={setModelLevel} onBack={() => navigate("/dashboard")} onApply={() => navigate("/dashboard")} onOpenSource={openSource} />}
      {route === "/vergleich" && <ComparisonPage settings={incomeTax} revenue={taxResult.value} onBack={() => navigate("/dashboard")} onOpenSource={openSource} />}

      {notice && <div className="toast" role="status">{notice}</div>}
      <SourceDrawer source={drawer?.source ?? null} value={drawer?.value} onClose={() => setDrawer(null)} />
    </div>
  );
}
