import { ModuleMetric, ModuleModelLevelCard, ModulePageHeader, ModuleSummaryHeader } from "../components/ModuleDetailComponents";
import type { IncomeTaxResult } from "../lib/income-tax";
import {
  defaultRevenueParameters,
  revenueModuleDefinitionById,
  revenueModuleDefinitions,
  revenueParameterKey,
  type RevenueModuleId,
  type RevenueModuleResult,
} from "../lib/revenue-modules";
import { fmtBn, fmtDiff } from "../lib/sim-data";
import type { ModelLevel } from "../lib/types";

export function RevenueModulesPage({
  selectedId,
  results,
  incomeTaxResult,
  parameters,
  modelLevel,
  onSelect,
  onNavigateIncomeTax,
  onParameters,
  onModelLevel,
  onBack,
  onOpenSource,
}: {
  selectedId: RevenueModuleId;
  results: RevenueModuleResult[];
  incomeTaxResult: IncomeTaxResult;
  parameters: Record<string, number>;
  modelLevel: ModelLevel;
  onSelect: (id: RevenueModuleId) => void;
  onNavigateIncomeTax: () => void;
  onParameters: (parameters: Record<string, number>) => void;
  onModelLevel: (level: ModelLevel) => void;
  onBack: () => void;
  onOpenSource: (metricId: string, value?: string) => void;
}) {
  const definition = revenueModuleDefinitionById[selectedId];
  const result = results.find((item) => item.id === selectedId) ?? results[0];

  const updateParameter = (key: string, value: number) => {
    onParameters({ ...parameters, [revenueParameterKey(selectedId, key)]: value });
  };

  const resetModule = () => {
    const next = { ...parameters };
    definition.parameters.forEach((item) => {
      next[revenueParameterKey(selectedId, item.key)] = defaultRevenueParameters[revenueParameterKey(selectedId, item.key)];
    });
    onParameters(next);
  };

  return (
    <main className="content-width revenue-modules-page">
      <ModulePageHeader
        eyebrow="Milestone 5 · Einnahmenmodule"
        title="Steuern und Sozialbeiträge"
        description="Acht getrennte Module mit einheitlichem Aufbau für Baseline, Szenario, Erstwirkung, Modellstufe und Nachweise."
        onBack={onBack}
      />

      <section className="revenue-module-layout">
        <aside className="card-flat revenue-module-list" aria-label="Einnahmemodule">
          <header><h2>Module</h2><span>{results.length + 1}</span></header>
          <nav>
            <button onClick={onNavigateIncomeTax}>
              <span><strong>Einkommensteuer</strong><small>§ 32a EStG · gesetzlicher Tarif 2026</small></span>
              <span className="module-list-value"><b>{fmtBn(incomeTaxResult.value)}</b><em className={incomeTaxResult.delta >= 0 ? "positive" : "negative"}>{fmtDiff(incomeTaxResult.delta)}</em></span>
            </button>
            {revenueModuleDefinitions.map((module) => {
              const moduleResult = results.find((item) => item.id === module.id)!;
              return (
                <button key={module.id} className={module.id === selectedId ? "active" : ""} onClick={() => onSelect(module.id)} aria-current={module.id === selectedId ? "page" : undefined}>
                  <span><strong>{module.label}</strong><small>{module.id === "verm" ? "Hypothetisches Szenario · Baseline 0" : module.legalBasis}</small></span>
                  <span className="module-list-value"><b>{fmtBn(moduleResult.value)}</b><em className={moduleResult.delta >= 0 ? "positive" : "negative"}>{fmtDiff(moduleResult.delta)}</em></span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="revenue-module-content">
          <section className="card-flat revenue-module-summary">
            <ModuleSummaryHeader
              badge={`Konfidenz ${definition.confidence}`}
              badgeTone={definition.confidence}
              title={definition.label}
              description={definition.description}
              onOpenSource={() => onOpenSource(`metric-revenue-${selectedId}`, `${fmtBn(result.value)} · ${fmtDiff(result.delta)}`)}
              onReset={resetModule}
            />
            <div className="revenue-kpi-grid">
              <ModuleMetric label="Baseline" value={fmtBn(result.baseline)} note={definition.legalBasis} />
              <ModuleMetric label="Szenariowert" value={fmtBn(result.value)} note={`${fmtDiff(result.delta)} gegenüber Baseline`} tone={result.delta >= 0 ? "positive" : "negative"} testId="revenue-module-value" />
              <ModuleMetric label="Statische Wirkung" value={fmtDiff(result.staticDelta)} note="ohne Verhaltensreaktion" tone={result.staticDelta >= 0 ? "positive" : "negative"} />
              <ModuleMetric label="Verhaltenskomponente" value={fmtDiff(result.behavioralAdjustment)} note={`Modellstufe ${modelLabel(modelLevel)}`} tone={result.behavioralAdjustment >= 0 ? "positive" : "negative"} />
            </div>
          </section>

          <section className="revenue-editor-grid">
            <article className="card-flat revenue-parameters">
              <div className="section-title"><div><h3>Parameter</h3><p>Jede Änderung wird im zentralen Szenario gespeichert und wirkt sofort auf Dashboard und Vergleichswerte.</p></div></div>
              <div className="parameter-list">
                {definition.parameters.map((item) => {
                  const key = revenueParameterKey(selectedId, item.key);
                  const value = parameters[key] ?? item.baseline;
                  return (
                    <label className="revenue-parameter" key={item.key}>
                      <span><strong>{item.label}</strong><small>{item.description}</small></span>
                      <div className="parameter-controls">
                        <input aria-label={`${item.label} Regler`} type="range" min={item.min} max={item.max} step={item.step} value={value} onChange={(event) => updateParameter(item.key, Number(event.target.value))} />
                        <input aria-label={`${item.label} Wert`} type="number" min={item.min} max={item.max} step={item.step} value={value} onChange={(event) => updateParameter(item.key, Number(event.target.value))} />
                        <b>{item.unit}</b>
                      </div>
                    </label>
                  );
                })}
              </div>
            </article>

            <aside className="revenue-side-stack">
              <ModuleModelLevelCard
                description="Die statische Erstwirkung bleibt sichtbar. Verhaltensannahmen werden separat hinzugerechnet."
                ariaLabel="Modellstufe Einnahmemodul"
                modelLevel={modelLevel}
                onModelLevel={onModelLevel}
                modelLabel={modelLabel}
                modelDescription={modelDescription}
              />

              <article className="card-flat incidence-card">
                <div className="section-title"><div><h3>Inzidenzannahme</h3><p>Wer die Belastung wirtschaftlich trägt, ist nicht zwingend identisch mit dem gesetzlichen Steuerschuldner.</p></div></div>
                <div className="incidence-bar" role="img" aria-label={`Inzidenzannahme für ${definition.label}`}>
                  {result.incidence.map((item) => <i key={item.label} style={{ width: `${item.share}%` }} title={`${item.label}: ${item.share} %`} />)}
                </div>
                <ul>{result.incidence.map((item) => <li key={item.label}><span>{item.label}</span><strong>{item.share} %</strong></li>)}</ul>
                <p className="uncertainty-note">Ergebnisband: ± {result.uncertaintyPercent} %. Die Inzidenz ist eine dokumentierte Modellannahme.</p>
              </article>
            </aside>
          </section>

          <section className="card-flat revenue-overview-table">
            <div className="section-title"><div><h3>Gesamtwirkung der Einnahmemodule</h3><p>Alle Module werden unabhängig berechnet und erst anschließend im Staatshaushalt zusammengeführt.</p></div></div>
            <div className="revenue-table-head"><span>Modul</span><span>Baseline</span><span>Statisch</span><span>Verhalten</span><span>Szenario</span></div>
            {results.map((item) => <button key={item.id} onClick={() => onSelect(item.id)} className={item.id === selectedId ? "active" : ""}><strong>{item.label}</strong><span>{fmtBn(item.baseline)}</span><span className={item.staticDelta >= 0 ? "positive" : "negative"}>{fmtDiff(item.staticDelta)}</span><span className={item.behavioralAdjustment >= 0 ? "positive" : "negative"}>{fmtDiff(item.behavioralAdjustment)}</span><span><b>{fmtBn(item.value)}</b></span></button>)}
          </section>
        </div>
      </section>
    </main>
  );
}

function modelLabel(level: ModelLevel) {
  if (level === "statisch") return "statisch";
  if (level === "verhalten") return "mit Verhalten";
  return "langfristig";
}

function modelDescription(level: ModelLevel) {
  if (level === "statisch") return "Bemessungsgrundlagen bleiben konstant";
  if (level === "verhalten") return "moderate kurzfristige Reaktion";
  return "stärkere mittelfristige Anpassung";
}
