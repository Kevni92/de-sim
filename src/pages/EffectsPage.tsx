import { AlertTriangle, ArrowLeft, Clock3, Database, Info, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ModuleCalculationContextCard } from "../components/ModuleDetailComponents";
import type { EffectModuleDefinition, EffectRun } from "../lib/long-term-effects";
import { modelLevelLabel, timeHorizonLabel, type CalculationFreshness } from "../lib/scenario-calculation";
import type { ModelLevel, PopulationRun, TimeHorizon } from "../lib/types";

const evidenceLabels: Record<string, string> = {
  "amtlich-beobachtet": "Amtlich beobachtet",
  modellrechnung: "Modellrechnung",
  szenarioannahme: "Szenarioannahme",
  "externe-evidenz": "Externe Evidenz",
  "nicht-berechnet": "Nicht berechnet",
  "nicht-ausreichend-belegt": "Nicht ausreichend belegt",
};
const causalityLabels: Record<string, string> = {
  deskriptiv: "Deskriptiv",
  korrelativ: "Korrelativ",
  "kausal-geschaetzt": "Kausal geschätzt",
  modelliert: "Modelliert",
  hypothetisch: "Hypothetisch",
};

const formatBn = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mrd. €`;
const formatCount = (value: number) => Math.round(value).toLocaleString("de-DE");
const formatParameter = (value: number, unit: string) => `${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })} ${unit}`;

export function EffectsPage({
  modules,
  run,
  parameters,
  modelLevel,
  horizonYears,
  populationRun,
  loading,
  calculationStatus,
  error,
  onParameters,
  onCalculate,
  onOpenSource,
  onBack,
}: {
  modules: EffectModuleDefinition[];
  run: EffectRun | null;
  parameters: Record<string, number>;
  modelLevel: ModelLevel;
  horizonYears: TimeHorizon;
  populationRun: PopulationRun | null;
  loading: boolean;
  calculationStatus: CalculationFreshness;
  error: string;
  onParameters: (parameters: Record<string, number>) => void;
  onCalculate: () => void;
  onOpenSource: (id: string, value?: string) => void;
  onBack: () => void;
}) {
  const [selectedId, setSelectedId] = useState("kita-betreuung");
  useEffect(() => {
    if (modules.length && !modules.some((module) => module.id === selectedId)) setSelectedId(modules[0].id);
  }, [modules, selectedId]);
  const selected = modules.find((module) => module.id === selectedId) ?? modules[0];
  const result = run?.moduleResults.find((item) => item.moduleId === selected?.id) ?? null;
  const summary = useMemo(() => {
    if (!run) return { calculated: 0, unavailable: 0 };
    return {
      calculated: run.moduleResults.filter((item) => item.evidenceStatus !== "nicht-berechnet" && item.evidenceStatus !== "nicht-ausreichend-belegt").length,
      unavailable: run.moduleResults.filter((item) => item.evidenceStatus === "nicht-berechnet" || item.evidenceStatus === "nicht-ausreichend-belegt").length,
    };
  }, [run]);
  const calculationStatusMessage = calculationStatus === "updating"
    ? run
      ? "Die vorhandene Rechnung bleibt zur Orientierung sichtbar, wird aber gerade mit dem neuen Berechnungsrahmen aktualisiert."
      : "Die Wirkungsrechnung wird mit dem zentralen Berechnungsrahmen vorbereitet."
    : calculationStatus === "stale" && run
      ? `Die sichtbare Rechnung verwendet noch ${modelLevelLabel(run.modelLevel)} mit ${timeHorizonLabel(run.horizonYears)} und wird nicht als aktuell ausgewiesen.`
      : undefined;

  if (!selected) {
    return <main className="effects-page"><div className="effects-empty">Wirkungsregister wird geladen …</div></main>;
  }

  return (
    <main className="effects-page" data-calculation-status={calculationStatus} aria-busy={loading}>
      <header className="effects-header">
        <button className="text-button effects-back" onClick={onBack}><ArrowLeft size={15} /> Zurück zum Dashboard</button>
        <div className="effects-title-row">
          <div>
            <p className="eyebrow">Milestone 8 · Wirkungs-Engine</p>
            <h1>Indirekte und langfristige Wirkungen</h1>
            <p>Direkte Erstwirkung, zeitliche Verzögerung, Rückkopplungen und Unsicherheit werden getrennt ausgewiesen. Änderungen am zentralen Szenario lösen die Aktualisierung automatisch aus.</p>
          </div>
        </div>
      </header>

      <section className="effects-warning" role="note">
        <AlertTriangle size={18} />
        <div><strong>Keine sichere Prognose.</strong> Die Ergebnisse zeigen mögliche Pfade unter den gewählten Annahmen. Nicht ausreichend belegte Wirkungen bleiben ausdrücklich unberechnet.</div>
      </section>

      {error && <div className="effects-error" role="alert"><span>{error}</span><button className="button secondary small" onClick={onCalculate} disabled={loading}><RefreshCw className={loading ? "spin" : ""} size={14} /> Erneut versuchen</button></div>}

      <section className="effects-overview" aria-label="Status der Wirkungsrechnung">
        <article><Database size={17} /><span>Bevölkerungslauf</span><strong>{populationRun?.metadata.id.slice(0, 16) ?? "nicht verfügbar"}</strong><small>{populationRun ? `${formatCount(populationRun.summary.weightedPopulation)} gewichtete Personen` : "Modellbasis nicht verfügbar"}</small></article>
        <article><Clock3 size={17} /><span>Zeithorizont</span><strong>{timeHorizonLabel(horizonYears)}</strong><small>{run ? `${run.dataYear} bis ${run.dataYear + run.horizonYears}` : "noch nicht berechnet"}</small></article>
        <article><Info size={17} /><span>Berechnete Module</span><strong>{summary.calculated} von {modules.length}</strong><small>{summary.unavailable} bewusst ohne Punktwert</small></article>
        <article><AlertTriangle size={17} /><span>Modellversion</span><strong>{run?.modelVersion ?? "0.8.0"}</strong><small>{run ? new Date(run.createdAt).toLocaleString("de-DE") : "noch kein Lauf"}</small></article>
      </section>

      <ModuleCalculationContextCard
        modelLevel={modelLevel}
        horizonYears={horizonYears}
        status={calculationStatus}
        statusMessage={calculationStatusMessage}
        description="Modellstufe und Zeitraum gelten für das gesamte Szenario. Die Wirkungsseite übernimmt sie schreibgeschützt und berechnet automatisch neu."
      />

      <div className="effects-layout">
        <aside className="effects-module-list" aria-label="Wirkungsbereiche">
          {modules.map((module) => {
            const moduleResult = run?.moduleResults.find((item) => item.moduleId === module.id);
            return (
              <button key={module.id} className={selected.id === module.id ? "active" : ""} onClick={() => setSelectedId(module.id)}>
                <span>{module.title}</span>
                <small>{evidenceLabels[moduleResult?.evidenceStatus ?? module.evidenceStatus]}</small>
              </button>
            );
          })}
        </aside>

        <div className="effects-content">
          <section className="effects-module-hero">
            <div>
              <div className="effects-badges">
                <span className={`evidence-badge evidence-${result?.evidenceStatus ?? selected.evidenceStatus}`}>{evidenceLabels[result?.evidenceStatus ?? selected.evidenceStatus]}</span>
                <span className="causality-badge">{causalityLabels[selected.causality]}</span>
              </div>
              <h2>{selected.title}</h2>
              <p>{selected.description}</p>
            </div>
            <button className="button secondary" onClick={() => onOpenSource(`metric-effect-${selected.id}`, result ? formatBn(result.central) : undefined)}>Berechnung und Quellen</button>
          </section>

          <section className="effects-separation-grid">
            <article><span>Baseline</span><strong>{result ? formatBn(result.baselineValue) : "—"}</strong><small>beobachtete oder modellierte Ausgangsgröße</small></article>
            <article><span>Direkte Erstwirkung</span><strong>{result ? formatBn(result.directEffect) : "—"}</strong><small>ohne Verhaltensreaktion</small></article>
            <article><span>Indirekte Wirkung</span><strong>{result ? formatBn(result.indirectEffect) : "—"}</strong><small>kurz- bis mittelfristig</small></article>
            <article><span>Langfristige Wirkung</span><strong>{result ? formatBn(result.longTermEffect) : "—"}</strong><small>nur in langfristiger Stufe</small></article>
            <article><span>Rückkopplung</span><strong>{result ? formatBn(result.feedbackEffect) : "—"}</strong><small>separat vom direkten Budget</small></article>
            <article className="uncertainty-card"><span>Unsicherheitsband</span><strong>{result ? `${formatBn(result.lower)} bis ${formatBn(result.upper)}` : "—"}</strong><small>Zentralwert {result ? formatBn(result.central) : "—"}</small></article>
          </section>

          {selected.parameters.length > 0 && (
            <section className="effects-card">
              <div className="effects-section-heading"><div><p className="eyebrow">Szenarioannahmen</p><h3>Parameter</h3></div><small>Änderungen werden im zentralen Szenario gespeichert.</small></div>
              <div className="effects-parameters">
                {selected.parameters.map((parameter) => {
                  const value = parameters[parameter.id] ?? parameter.defaultValue;
                  return (
                    <label key={parameter.id}>
                      <span><strong>{parameter.label}</strong><output>{formatParameter(value, parameter.unit)}</output></span>
                      <input type="range" min={parameter.min} max={parameter.max} step={parameter.step} value={value} onChange={(event) => onParameters({ ...parameters, [parameter.id]: Number(event.target.value) })} aria-label={parameter.label} />
                      <small>{parameter.description} · Unsicherheit: {parameter.uncertainty}</small>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          <section className="effects-card">
            <div className="effects-section-heading"><div><p className="eyebrow">Zielgruppen und nicht monetäre Wirkung</p><h3>Betroffenheit</h3></div></div>
            <div className="effects-affected-grid">
              <article><span>Betroffene Personen</span><strong>{result ? formatCount(result.affectedPersons) : "—"}</strong></article>
              <article><span>Betroffene Haushalte</span><strong>{result ? formatCount(result.affectedHouseholds) : "—"}</strong></article>
              {(result?.nonMonetaryEffects ?? []).map((measure) => <article key={measure.label}><span>{measure.label}</span><strong>{formatCount(measure.value)} {measure.unit}</strong></article>)}
            </div>
            <div className="effects-groups">{(result?.relevantGroups ?? []).map((group) => <span key={group}>{group}</span>)}</div>
          </section>

          <section className="effects-card" data-testid="effect-timeline">
            <div className="effects-section-heading"><div><p className="eyebrow">Zeitpfad</p><h3>Wirkung nach Jahr</h3></div><small>Beginn {selected.timing.startYear} · Anlauf {selected.timing.rampYears} Jahre · Maximum {selected.timing.peakYear}</small></div>
            {result ? (
              <div className="effects-table-wrap">
                <table>
                  <thead><tr><th>Jahr</th><th>Direkt</th><th>Indirekt</th><th>Rückkopplung</th><th>Zentraler Pfad</th><th>Band</th></tr></thead>
                  <tbody>{result.timeSeries.map((point) => {
                    const delta = point.scenarioValue - point.baseline;
                    return <tr key={point.year}><td>{point.year}</td><td>{formatBn(point.directEffect)}</td><td>{formatBn(point.indirectEffect)}</td><td>{formatBn(point.feedback)}</td><td>{formatBn(delta)}</td><td>{formatBn(point.lower - point.baseline)} bis {formatBn(point.upper - point.baseline)}</td></tr>;
                  })}</tbody>
                </table>
              </div>
            ) : <p className="effects-empty">Noch keine Rechnung für dieses Szenario.</p>}
          </section>

          <section className="effects-card effects-method-card">
            <div><p className="eyebrow">Modellgrenzen</p><h3>Warum diese Wirkung nicht als Prognose gilt</h3></div>
            <div className="effects-method-columns">
              <div><strong>Zeitliche Struktur</strong><p>{selected.timing.feedback}</p><p>{selected.timing.permanence === "dauerhaft" ? "Dauerhafter" : "Temporärer"} Effekt mit Zeithorizont bis {selected.timing.horizonYears} Jahre.</p></div>
              <div><strong>Unsicherheit</strong><p>{selected.uncertaintyModel}</p></div>
              <div><strong>Bekannte Grenzen</strong><ul>{(result?.warnings ?? selected.limitations).map((warning) => <li key={warning}>{warning}</li>)}</ul></div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
