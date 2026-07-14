import type { ChangeEvent } from "react";
import { ModuleModelLevelCard, ModulePageHeader } from "../components/ModuleDetailComponents";
import { ReformDisclosureSection, ReformResultLayout, type ReformMetric, type ReformResultStatus } from "../components/ReformResultLayout";
import type { IncomeTaxResult } from "../lib/income-tax";
import {
  defaultRevenueParameters,
  revenueModuleDefinitionById,
  revenueModuleDefinitions,
  revenueParameterKey,
  type RevenueModuleId,
  type RevenueModuleResult,
  type RevenueParameterDefinition,
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
  const result = results.find((item) => item.id === selectedId);
  const primaryParameter = definition.parameters[0];
  const additionalParameters = definition.parameters.slice(1);

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

  const status = resultStatus(result);
  const topIncidence = result?.incidence.reduce((largest, item) => item.share > largest.share ? item : largest, result.incidence[0]);
  const metrics: ReformMetric[] = result ? [
    { label: "Ausgangswert", value: fmtBn(result.baseline), note: definition.legalBasis },
    { label: "Direkte staatliche Wirkung", value: fmtDiff(result.staticDelta), note: `direkter Szenariowert ${fmtBn(result.staticValue)}`, tone: result.staticDelta >= 0 ? "positive" : "negative", testId: "revenue-module-value" },
    { label: "Am stärksten betroffen", value: topIncidence?.label ?? "Noch offen", note: topIncidence ? `${topIncidence.share} % der modellierten Belastung` : "keine belastbare Verteilung vorhanden" },
    { label: "Belastbarkeit", value: confidenceLabel(definition.confidence), note: `Ergebnisband ± ${result.uncertaintyPercent} %` },
  ] : [];

  return (
    <main className="content-width revenue-modules-page">
      <ModulePageHeader
        eyebrow="Einnahmen"
        title="Steuern und Sozialbeiträge"
        description="Maßnahme ändern, direkte Wirkung verstehen und fachliche Details nur bei Bedarf öffnen."
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
          <ReformResultLayout
            badge="Einnahmenmaßnahme"
            title={definition.label}
            description={definition.description}
            onOpenSource={() => result && onOpenSource(`metric-revenue-${selectedId}`, `${fmtBn(result.value)} · ${fmtDiff(result.delta)}`)}
            onReset={resetModule}
            primaryTitle={primaryParameter?.label ?? "Keine Stellschraube verfügbar"}
            primaryDescription={primaryParameter?.description ?? "Für dieses Modul ist noch keine veränderbare Maßnahme hinterlegt."}
            primaryControl={primaryParameter ? <RevenueParameterControl item={primaryParameter} value={parameterValue(parameters, selectedId, primaryParameter)} onValue={(value) => updateParameter(primaryParameter.key, value)} /> : null}
            metrics={metrics}
            status={status}
          >
            {result && <>
              <ReformDisclosureSection title="Wer ist betroffen?" summary="Die modellierte wirtschaftliche Belastung wird getrennt vom gesetzlichen Steuerschuldner ausgewiesen." testId="reform-affected-section">
                <div className="incidence-card reform-inline-card">
                  <div className="section-title"><div><h4>Modellierte Betroffenheit</h4><p>Die Anteile sind eine dokumentierte Inzidenzannahme und keine individuelle Steuerberechnung.</p></div></div>
                  <div className="incidence-bar" role="img" aria-label={`Inzidenzannahme für ${definition.label}`}>
                    {result.incidence.map((item) => <i key={item.label} style={{ width: `${item.share}%` }} title={`${item.label}: ${item.share} %`} />)}
                  </div>
                  <ul>{result.incidence.map((item) => <li key={item.label}><span>{item.label}</span><strong>{item.share} %</strong></li>)}</ul>
                  <p className="uncertainty-note">Die Verteilung ist eine Modellannahme innerhalb des Ergebnisbands von ± {result.uncertaintyPercent} %.</p>
                </div>
              </ReformDisclosureSection>

              <ReformDisclosureSection title="Mögliche Folgewirkungen" summary="Verhaltensreaktionen bleiben sichtbar von der direkten staatlichen Wirkung getrennt." testId="reform-follow-up-section">
                <div className="reform-effect-grid">
                  <article><span>Direkte staatliche Wirkung</span><strong className={result.staticDelta >= 0 ? "positive" : "negative"}>{fmtDiff(result.staticDelta)}</strong><small>ohne modellierte Verhaltensreaktion</small></article>
                  <article><span>Modellierte Folgewirkung</span><strong className={result.behavioralAdjustment >= 0 ? "positive" : "negative"}>{fmtDiff(result.behavioralAdjustment)}</strong><small>separater Modellpfad, keine sichere Prognose</small></article>
                </div>
                <ModuleModelLevelCard
                  description="Die direkte Wirkung bleibt unverändert sichtbar. Nur die getrennte Folgewirkung hängt von der Modellstufe ab."
                  ariaLabel="Modellstufe Einnahmemodul"
                  modelLevel={modelLevel}
                  onModelLevel={onModelLevel}
                  modelLabel={modelLabel}
                  modelDescription={modelDescription}
                />
              </ReformDisclosureSection>

              <ReformDisclosureSection title="Finanzierung und Teilkomponenten" summary="Die Einnahmemodule werden getrennt berechnet und erst im Staatshaushalt zusammengeführt." testId="reform-financing-section">
                <section className="revenue-overview-table reform-overview-table">
                  <div className="section-title"><div><h4>Gesamtwirkung der Einnahmemodule</h4><p>Die Tabelle dient der Einordnung; sie verändert keine anderen Module.</p></div></div>
                  <div className="revenue-table-head"><span>Modul</span><span>Baseline</span><span>Direkt</span><span>Folgewirkung</span><span>Szenario</span></div>
                  {results.map((item) => <button key={item.id} onClick={() => onSelect(item.id)} className={item.id === selectedId ? "active" : ""}><strong>{item.label}</strong><span>{fmtBn(item.baseline)}</span><span className={item.staticDelta >= 0 ? "positive" : "negative"}>{fmtDiff(item.staticDelta)}</span><span className={item.behavioralAdjustment >= 0 ? "positive" : "negative"}>{fmtDiff(item.behavioralAdjustment)}</span><span><b>{fmtBn(item.value)}</b></span></button>)}
                </section>
              </ReformDisclosureSection>

              <ReformDisclosureSection title="Berechnung und Quellen" summary="Rechtsgrundlage, verwendete Parameter, Rechenweg, Unsicherheit und Grenzen bleiben vollständig erreichbar." testId="reform-evidence-section">
                <div className="reform-source-callout">
                  <div><h4>{definition.legalBasis}</h4><p>Der Nachweis zeigt den vollständigen Rechenweg, die verwendeten Quellen und bekannte Grenzen des Modells.</p></div>
                  <button className="button secondary small" type="button" onClick={() => onOpenSource(`metric-revenue-${selectedId}`, `${fmtBn(result.value)} · ${fmtDiff(result.delta)}`)}>Vollständigen Nachweis öffnen</button>
                </div>
              </ReformDisclosureSection>

              <ReformDisclosureSection title="Erweiterte Parameter" summary="Weitere Annahmen bleiben verfügbar, dominieren aber nicht die Standardansicht." testId="reform-advanced-section">
                <p className="reform-parameter-intro">Die wichtigste Stellschraube bleibt oben sichtbar. Hier können die ergänzenden Modellparameter verändert werden.</p>
                {additionalParameters.length > 0 ? <div className="parameter-list">
                  {additionalParameters.map((item) => <RevenueParameterControl key={item.key} item={item} value={parameterValue(parameters, selectedId, item)} onValue={(value) => updateParameter(item.key, value)} />)}
                </div> : <p className="reform-parameter-intro">Für dieses Modul gibt es keine weiteren Parameter.</p>}
              </ReformDisclosureSection>
            </>}
          </ReformResultLayout>
        </div>
      </section>
    </main>
  );
}

function RevenueParameterControl({ item, value, onValue }: { item: RevenueParameterDefinition; value: number; onValue: (value: number) => void }) {
  return (
    <label className="revenue-parameter">
      <span><strong>{item.label}</strong><small>{item.description}</small></span>
      <div className="parameter-controls">
        <input aria-label={`${item.label} Regler`} type="range" min={item.min} max={item.max} step={item.step} value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => onValue(Number(event.target.value))} />
        <input aria-label={`${item.label} Wert`} type="number" min={item.min} max={item.max} step={item.step} value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => onValue(Number(event.target.value))} />
        <b>{item.unit}</b>
      </div>
    </label>
  );
}

function parameterValue(parameters: Record<string, number>, moduleId: RevenueModuleId, item: RevenueParameterDefinition) {
  return parameters[revenueParameterKey(moduleId, item.key)] ?? item.baseline;
}

function resultStatus(result: RevenueModuleResult | undefined): ReformResultStatus {
  if (!result) return { kind: "empty", title: "Für dieses Modul liegt noch kein Ergebnis vor.", message: "Wähle eine verfügbare Maßnahme oder stelle die Szenariodaten wieder her." };
  const values = [result.baseline, result.staticValue, result.value, result.staticDelta, result.behavioralAdjustment, result.delta, result.uncertaintyPercent];
  if (!values.every(Number.isFinite)) return { kind: "not-calculable", title: "Die Wirkung kann mit den aktuellen Angaben nicht belastbar berechnet werden.", message: "Es wird bewusst kein Ersatzwert angezeigt. Prüfe Parameter und Berechnungsgrundlage im vollständigen Nachweis." };
  return { kind: "ready" };
}

function confidenceLabel(confidence: "hoch" | "mittel" | "niedrig") {
  return confidence === "hoch" ? "Hoch" : confidence === "mittel" ? "Mittel" : "Niedrig";
}

function modelLabel(level: ModelLevel) {
  if (level === "statisch") return "nur direkte Wirkung";
  if (level === "verhalten") return "mit kurzfristiger Reaktion";
  return "mit längerfristiger Reaktion";
}

function modelDescription(level: ModelLevel) {
  if (level === "statisch") return "Bemessungsgrundlagen bleiben konstant";
  if (level === "verhalten") return "moderate kurzfristige Reaktion";
  return "stärkere mittelfristige Anpassung";
}
