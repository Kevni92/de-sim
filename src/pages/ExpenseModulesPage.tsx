import { ModuleCalculationContextCard, ModuleMetric, ModulePageHeader, ModuleSummaryHeader } from "../components/ModuleDetailComponents";
import { Sgb2ExpenseEditor } from "../components/Sgb2ExpenseEditor";
import { defaultExpenseParameters, expenseModuleDefinitionById, expenseModuleDefinitions, expenseParameterKey, type ExpenseModuleId, type ExpenseModuleResult } from "../lib/expense-modules";
import { modelLevelLabel } from "../lib/scenario-calculation";
import type { Sgb2ScenarioReference } from "../lib/sgb2-policy";
import { resetSgb2Ui, type Sgb2UiPreviewResult } from "../lib/sgb2-ui";
import { fmtBn, fmtDiff } from "../lib/sim-data";
import type { ModelLevel, TimeHorizon } from "../lib/types";

type Props = {
  selectedId: ExpenseModuleId;
  results: ExpenseModuleResult[];
  parameters: Record<string, number>;
  modelLevel: ModelLevel;
  horizonYears: TimeHorizon;
  sgb2: Sgb2ScenarioReference;
  sgb2Preview: Sgb2UiPreviewResult | null;
  sgb2PreviewLoading: boolean;
  sgb2PreviewError: string;
  populationAvailable: boolean;
  onSelect: (id: ExpenseModuleId) => void;
  onParameters: (parameters: Record<string, number>) => void;
  onSgb2: (reference: Sgb2ScenarioReference) => void;
  onBack: () => void;
  onOpenSource: (metricId: string, value?: string) => void;
};

export function ExpenseModulesPage({ selectedId, results, parameters, modelLevel, horizonYears, sgb2, sgb2Preview, sgb2PreviewLoading, sgb2PreviewError, populationAvailable, onSelect, onParameters, onSgb2, onBack, onOpenSource }: Props) {
  const definition = expenseModuleDefinitionById[selectedId];
  const result = results.find((item) => item.id === selectedId) ?? results[0];
  const updateParameter = (key: string, value: number) => onParameters({ ...parameters, [expenseParameterKey(selectedId, key)]: value });
  const resetModule = () => {
    const next = { ...parameters };
    definition.parameters.forEach((item) => { next[expenseParameterKey(selectedId, item.key)] = defaultExpenseParameters[expenseParameterKey(selectedId, item.key)]; });
    onParameters(next);
  };

  return <main className="content-width revenue-modules-page expense-modules-page">
    <ModulePageHeader
      eyebrow="Milestone 6 · Ausgabenmodule"
      title="Ausgaben und Leistungen"
      description="Neun priorisierte Module mit einheitlichem Aufbau für Baseline, Szenario, direkte Wirkung, zentralen Berechnungsrahmen und Nachweise."
      onBack={onBack}
    />

    <section className="revenue-module-layout">
      <aside className="card-flat revenue-module-list expense-module-list" aria-label="Ausgabenmodule"><header><h2>Module</h2><span>{results.length}</span></header><nav>{expenseModuleDefinitions.map((module) => {
        const item = results.find((entry) => entry.id === module.id)!;
        return <button key={module.id} className={module.id === selectedId ? "active" : ""} onClick={() => onSelect(module.id)} aria-current={module.id === selectedId ? "page" : undefined}><span><strong>{module.label}</strong><small>{module.legalBasis}</small></span><span className="module-list-value"><b>{fmtBn(item.value)}</b><em className={item.delta <= 0 ? "positive" : "negative"}>{fmtDiff(item.delta)}</em></span></button>;
      })}</nav></aside>

      <div className="revenue-module-content">
        <section className="card-flat revenue-module-summary">
          <ModuleSummaryHeader
            badge={`Konfidenz ${definition.confidence}`}
            badgeTone={definition.confidence}
            title={definition.label}
            description={selectedId === "social" ? "Regelbedarfe, Mehrbedarfe, Einkommen sowie regional anerkannte Unterkunft und Heizung werden personengenau berechnet und gewichtet aggregiert." : definition.description}
            onOpenSource={() => onOpenSource(`metric-expense-${selectedId}`, `${fmtBn(result.value)} · ${fmtDiff(result.delta)}`)}
            onReset={selectedId === "social" ? () => onSgb2(resetSgb2Ui(sgb2)) : resetModule}
          />
          <div className="revenue-kpi-grid">
            <ModuleMetric label="Baseline" value={fmtBn(result.baseline)} note={definition.legalBasis} />
            <ModuleMetric label="Szenariowert" value={fmtBn(result.value)} note={`${fmtDiff(result.delta)} gegenüber Baseline`} tone={result.delta <= 0 ? "positive" : "negative"} testId="expense-module-value" />
            <ModuleMetric label="Direkte Wirkung" value={fmtDiff(result.staticDelta)} note="vor modellierter Folgewirkung" tone={result.staticDelta <= 0 ? "positive" : "negative"} />
            <ModuleMetric label="Folgewirkung" value={fmtDiff(result.feedbackAdjustment)} note={modelLevelLabel(modelLevel)} tone={result.feedbackAdjustment <= 0 ? "positive" : "negative"} />
          </div>
        </section>

        {selectedId === "social" ? <>
          <ModuleCalculationContextCard
            modelLevel={modelLevel}
            horizonYears={horizonYears}
            description="Der Berechnungsrahmen gilt auch für Bürgergeld und weitere Leistungen; die unmittelbare Mikrosimulation bleibt getrennt nachvollziehbar."
          />
          <Sgb2ExpenseEditor
            reference={sgb2}
            preview={sgb2Preview}
            loading={sgb2PreviewLoading}
            error={sgb2PreviewError}
            populationAvailable={populationAvailable}
            onReference={onSgb2}
            onOpenSource={onOpenSource}
          />
        </> : <>
          <section className="revenue-editor-grid">
            <article className="card-flat revenue-parameters"><div className="section-title"><div><h3>Szenarioparameter</h3><p>Änderungen werden im zentralen Szenario gespeichert und wirken sofort auf Dashboard und Saldo.</p></div></div><div className="parameter-list">{definition.parameters.map((item) => {
              const key = expenseParameterKey(selectedId, item.key); const value = parameters[key] ?? item.baseline;
              return <label className="revenue-parameter" key={item.key}><span><strong>{item.label}</strong><small>{item.description}</small></span><div className="parameter-controls"><input aria-label={`${item.label} Regler`} type="range" min={item.min} max={item.max} step={item.step} value={value} onChange={(event) => updateParameter(item.key, Number(event.target.value))} /><input aria-label={`${item.label} Wert`} type="number" min={item.min} max={item.max} step={item.step} value={value} onChange={(event) => updateParameter(item.key, Number(event.target.value))} /><b>{item.unit}</b></div></label>;
            })}</div></article>

            <aside className="revenue-side-stack">
              <ModuleCalculationContextCard
                modelLevel={modelLevel}
                horizonYears={horizonYears}
                description="Direkte Haushaltswirkung und mögliche Folgewirkungen bleiben getrennt; die Einstellung gilt für das gesamte Szenario."
              />
              <article className="card-flat incidence-card"><div className="section-title"><div><h3>Begünstigte und Leistungskanäle</h3><p>Modellierte Verteilung des Aggregats, keine individuellen Ansprüche.</p></div></div><div className="incidence-bar" role="img" aria-label={`Begünstigtenstruktur für ${definition.label}`}>{result.beneficiaries.map((item) => <i key={item.label} style={{ width: `${item.share}%` }} title={`${item.label}: ${item.share} %`} />)}</div><ul>{result.beneficiaries.map((item) => <li key={item.label}><span>{item.label}</span><strong>{item.share} %</strong></li>)}</ul><p className="uncertainty-note">Ergebnisband: ± {result.uncertaintyPercent} %. Folgewirkungen sind keine Prognose.</p></article>
            </aside>
          </section>

          {result.components.length > 0 && <section className="card-flat expense-component-card"><div className="section-title"><div><h3>Getrennte Teilaggregate</h3><p>Einzeln berechnet und erst danach zusammengeführt.</p></div></div><div className="expense-component-grid">{result.components.map((component) => <article key={component.id}><span>{component.label}</span><strong>{fmtBn(component.value)}</strong><small>{fmtBn(component.baseline)} Baseline · {fmtDiff(component.value - component.baseline)}</small></article>)}</div></section>}
        </>}

        <section className="card-flat revenue-overview-table"><div className="section-title"><div><h3>Gesamtwirkung der Ausgabenmodule</h3><p>Getrennte Berechnung, konsistente Übernahme in den Staatshaushalt.</p></div></div><div className="revenue-table-head"><span>Modul</span><span>Baseline</span><span>Direkt</span><span>Folgewirkung</span><span>Szenario</span></div>{results.map((item) => <button key={item.id} onClick={() => onSelect(item.id)} className={item.id === selectedId ? "active" : ""}><strong>{item.label}</strong><span>{fmtBn(item.baseline)}</span><span className={item.staticDelta <= 0 ? "positive" : "negative"}>{fmtDiff(item.staticDelta)}</span><span className={item.feedbackAdjustment <= 0 ? "positive" : "negative"}>{fmtDiff(item.feedbackAdjustment)}</span><span><b>{fmtBn(item.value)}</b></span></button>)}</section>
      </div>
    </section>
  </main>;
}
