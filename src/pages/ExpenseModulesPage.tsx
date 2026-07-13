import { ChevronLeft, Info, RotateCcw } from "lucide-react";
import { defaultExpenseParameters, expenseModuleDefinitionById, expenseModuleDefinitions, expenseParameterKey, type ExpenseModuleId, type ExpenseModuleResult } from "../lib/expense-modules";
import { fmtBn, fmtDiff } from "../lib/sim-data";
import type { ModelLevel } from "../lib/types";

type Props = {
  selectedId: ExpenseModuleId;
  results: ExpenseModuleResult[];
  parameters: Record<string, number>;
  modelLevel: ModelLevel;
  onSelect: (id: ExpenseModuleId) => void;
  onParameters: (parameters: Record<string, number>) => void;
  onModelLevel: (level: ModelLevel) => void;
  onBack: () => void;
  onOpenSource: (metricId: string, value?: string) => void;
};

export function ExpenseModulesPage({ selectedId, results, parameters, modelLevel, onSelect, onParameters, onModelLevel, onBack, onOpenSource }: Props) {
  const definition = expenseModuleDefinitionById[selectedId];
  const result = results.find((item) => item.id === selectedId) ?? results[0];
  const updateParameter = (key: string, value: number) => onParameters({ ...parameters, [expenseParameterKey(selectedId, key)]: value });
  const resetModule = () => {
    const next = { ...parameters };
    definition.parameters.forEach((item) => { next[expenseParameterKey(selectedId, item.key)] = defaultExpenseParameters[expenseParameterKey(selectedId, item.key)]; });
    onParameters(next);
  };

  return <main className="content-width revenue-modules-page expense-modules-page">
    <header className="detail-header revenue-header">
      <div><button className="back-link" onClick={onBack}><ChevronLeft size={14} /> Zurück zum Dashboard</button><span className="eyebrow">Milestone 6 · Ausgaben und Leistungen</span><h1>Ausgaben und Leistungen</h1><p>Neun priorisierte Module mit getrennten Teilaggregaten, direkter Wirkung, Folgewirkung und Unsicherheit.</p></div>
      <button className="source-badge" onClick={() => onOpenSource(`metric-expense-${selectedId}`, `${fmtBn(result.value)} · ${fmtDiff(result.delta)}`)}><Info size={10} /> Berechnung und Quellen</button>
    </header>

    <section className="revenue-module-layout">
      <aside className="card-flat revenue-module-list expense-module-list" aria-label="Ausgabenmodule"><header><h2>Module</h2><span>{results.length}</span></header><nav>{expenseModuleDefinitions.map((module) => {
        const item = results.find((entry) => entry.id === module.id)!;
        return <button key={module.id} className={module.id === selectedId ? "active" : ""} onClick={() => onSelect(module.id)} aria-current={module.id === selectedId ? "page" : undefined}><span><strong>{module.label}</strong><small>{module.legalBasis}</small></span><span className="module-list-value"><b>{fmtBn(item.value)}</b><em className={item.delta <= 0 ? "positive" : "negative"}>{fmtDiff(item.delta)}</em></span></button>;
      })}</nav></aside>

      <div className="revenue-module-content">
        <section className="card-flat revenue-module-summary"><div className="module-summary-head"><div><span className={`evidence-pill ${definition.confidence}`}>Konfidenz {definition.confidence}</span><h2>{definition.label}</h2><p>{definition.description}</p></div><button className="button secondary small" onClick={resetModule}><RotateCcw size={13} /> Baseline wiederherstellen</button></div><div className="revenue-kpi-grid"><Metric label="Baseline" value={fmtBn(result.baseline)} note={definition.legalBasis} /><Metric label="Szenariowert" value={fmtBn(result.value)} note={`${fmtDiff(result.delta)} gegenüber Baseline`} tone={result.delta <= 0 ? "positive" : "negative"} testId="expense-module-value" /><Metric label="Direkte Wirkung" value={fmtDiff(result.staticDelta)} note="vor modellierter Folgewirkung" tone={result.staticDelta <= 0 ? "positive" : "negative"} /><Metric label="Folgewirkung" value={fmtDiff(result.feedbackAdjustment)} note={`Modellstufe ${modelLabel(modelLevel)}`} tone={result.feedbackAdjustment <= 0 ? "positive" : "negative"} /></div></section>

        <section className="revenue-editor-grid">
          <article className="card-flat revenue-parameters"><div className="section-title"><div><h3>Szenarioparameter</h3><p>Änderungen werden im zentralen Szenario gespeichert und wirken sofort auf Dashboard und Saldo.</p></div></div><div className="parameter-list">{definition.parameters.map((item) => {
            const key = expenseParameterKey(selectedId, item.key); const value = parameters[key] ?? item.baseline;
            return <label className="revenue-parameter" key={item.key}><span><strong>{item.label}</strong><small>{item.description}</small></span><div className="parameter-controls"><input aria-label={`${item.label} Regler`} type="range" min={item.min} max={item.max} step={item.step} value={value} onChange={(event) => updateParameter(item.key, Number(event.target.value))} /><input aria-label={`${item.label} Wert`} type="number" min={item.min} max={item.max} step={item.step} value={value} onChange={(event) => updateParameter(item.key, Number(event.target.value))} /><b>{item.unit}</b></div></label>;
          })}</div></article>

          <aside className="revenue-side-stack"><article className="card-flat model-level-card"><h3>Modellstufe</h3><p>Direkte Haushaltswirkung und Folgewirkung bleiben getrennt.</p><div className="model-level-options" role="radiogroup" aria-label="Modellstufe Ausgabenmodul">{(["statisch", "verhalten", "langfrist"] as const).map((level) => <button key={level} role="radio" aria-checked={modelLevel === level} className={modelLevel === level ? "active" : ""} onClick={() => onModelLevel(level)}><strong>{modelLabel(level)}</strong><small>{modelDescription(level)}</small></button>)}</div></article><article className="card-flat incidence-card"><div className="section-title"><div><h3>Begünstigte und Leistungskanäle</h3><p>Modellierte Verteilung des Aggregats, keine individuellen Ansprüche.</p></div></div><div className="incidence-bar" role="img" aria-label={`Begünstigtenstruktur für ${definition.label}`}>{result.beneficiaries.map((item) => <i key={item.label} style={{ width: `${item.share}%` }} title={`${item.label}: ${item.share} %`} />)}</div><ul>{result.beneficiaries.map((item) => <li key={item.label}><span>{item.label}</span><strong>{item.share} %</strong></li>)}</ul><p className="uncertainty-note">Ergebnisband: ± {result.uncertaintyPercent} %. Folgewirkungen sind keine Prognose.</p></article></aside>
        </section>

        {result.components.length > 0 && <section className="card-flat expense-component-card"><div className="section-title"><div><h3>Getrennte Teilaggregate</h3><p>Einzeln berechnet und erst danach zusammengeführt.</p></div></div><div className="expense-component-grid">{result.components.map((component) => <article key={component.id}><span>{component.label}</span><strong>{fmtBn(component.value)}</strong><small>{fmtBn(component.baseline)} Baseline · {fmtDiff(component.value - component.baseline)}</small></article>)}</div></section>}

        <section className="card-flat revenue-overview-table"><div className="section-title"><div><h3>Gesamtwirkung der Ausgabenmodule</h3><p>Getrennte Berechnung, konsistente Übernahme in den Staatshaushalt.</p></div></div><div className="revenue-table-head"><span>Modul</span><span>Baseline</span><span>Direkt</span><span>Folgewirkung</span><span>Szenario</span></div>{results.map((item) => <button key={item.id} onClick={() => onSelect(item.id)} className={item.id === selectedId ? "active" : ""}><strong>{item.label}</strong><span>{fmtBn(item.baseline)}</span><span className={item.staticDelta <= 0 ? "positive" : "negative"}>{fmtDiff(item.staticDelta)}</span><span className={item.feedbackAdjustment <= 0 ? "positive" : "negative"}>{fmtDiff(item.feedbackAdjustment)}</span><span><b>{fmtBn(item.value)}</b></span></button>)}</section>
      </div>
    </section>
  </main>;
}

function Metric({ label, value, note, tone = "neutral", testId }: { label: string; value: string; note: string; tone?: "positive" | "negative" | "neutral"; testId?: string }) { return <article><span>{label}</span><strong className={tone} data-testid={testId}>{value}</strong><small>{note}</small></article>; }
function modelLabel(level: ModelLevel) { return level === "statisch" ? "statisch" : level === "verhalten" ? "mit Folgewirkung" : "langfristig"; }
function modelDescription(level: ModelLevel) { return level === "statisch" ? "nur direkte Haushaltswirkung" : level === "verhalten" ? "moderate Rückwirkung" : "stärkere mittelfristige Rückwirkung"; }
