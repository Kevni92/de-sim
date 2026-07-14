import { ChevronDown, Info, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { Sgb2ScenarioReference } from "../lib/sgb2-policy";
import {
  getSgb2Parameter,
  resetSgb2Ui,
  resolvedSgb2UiValue,
  setSgb2UiGroupPercent,
  setSgb2UiParameter,
  sgb2UiDisplayValue,
  sgb2UiFields,
  sgb2UiGroupPercent,
  sgb2UiGroups,
  sgb2UiHasChanges,
  sgb2UiInputStep,
  sgb2UiInputValue,
  sgb2UiModelValue,
  type Sgb2UiMode,
  type Sgb2UiPreviewResult,
} from "../lib/sgb2-ui";

interface Props {
  reference: Sgb2ScenarioReference;
  preview: Sgb2UiPreviewResult | null;
  loading: boolean;
  error: string;
  populationAvailable: boolean;
  onReference: (reference: Sgb2ScenarioReference) => void;
  onOpenSource: (sourceId: string, value?: string) => void;
}

function formatBnFromCents(cents: number) {
  return `${(cents / 100_000_000_000).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Mrd. €`;
}

function formatDeltaFromCents(cents: number) {
  const sign = cents > 0 ? "+" : cents < 0 ? "−" : "±";
  return `${sign}${formatBnFromCents(Math.abs(cents))}`;
}

function formatWeighted(value: number) {
  return value.toLocaleString("de-DE", { maximumFractionDigits: 0 });
}

function FieldEditor({ field, reference, onReference, onOpenSource }: {
  field: (typeof sgb2UiFields)[number];
  reference: Sgb2ScenarioReference;
  onReference: (reference: Sgb2ScenarioReference) => void;
  onOpenSource: Props["onOpenSource"];
}) {
  const parameter = getSgb2Parameter(field.id);
  const value = resolvedSgb2UiValue(reference, field.id);
  if (typeof value !== "number" || typeof parameter.value !== "number") return null;
  const inputValue = sgb2UiInputValue(parameter, value);
  const min = parameter.constraints?.min == null ? undefined : sgb2UiInputValue(parameter, parameter.constraints.min);
  const max = parameter.constraints?.max == null ? undefined : sgb2UiInputValue(parameter, parameter.constraints.max);
  const step = parameter.unit === "cent-pro-monat" ? 0.01 : parameter.unit === "anteil" ? 0.1 : sgb2UiInputStep(parameter);
  const changed = Math.abs(value - parameter.value) > 1e-9;

  return <article className={`sgb2-field ${changed ? "changed" : ""}`} data-parameter-id={field.id}>
    <div className="sgb2-field-copy">
      <div><strong>{field.label}</strong>{changed && <span className="sgb2-change-chip">geändert</span>}</div>
      <p>{field.description}</p>
      <small>Baseline: {sgb2UiDisplayValue(parameter, parameter.value)}</small>
    </div>
    <div className="sgb2-field-input">
      <input
        aria-label={`${field.label} Wert`}
        type="number"
        value={inputValue}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onReference(setSgb2UiParameter(reference, field.id, sgb2UiModelValue(parameter, Number(event.target.value))))}
      />
      <span>{parameter.unit === "cent-pro-monat" ? "€ / Monat" : parameter.unit === "anteil" ? "%" : parameter.unit === "monate" ? "Monate" : parameter.unit === "quadratmeter" ? "m²" : parameter.unit}</span>
    </div>
    <details className="sgb2-field-evidence">
      <summary><Info size={14} /> Quelle und Unsicherheit <ChevronDown size={14} /></summary>
      <div>
        <dl>
          <div><dt>Quelle</dt><dd>{parameter.sourceId}</dd></div>
          <div><dt>Rechtsstand</dt><dd>{parameter.legalStatusDate}</dd></div>
          <div><dt>Datenstand</dt><dd>{parameter.dataStatusDate ?? "nicht getrennt ausgewiesen"}</dd></div>
          <div><dt>Evidenz</dt><dd>{parameter.evidenceClass}</dd></div>
          <div><dt>Unsicherheit</dt><dd>{parameter.uncertaintyClass}</dd></div>
        </dl>
        <button type="button" onClick={() => onOpenSource(parameter.sourceId, sgb2UiDisplayValue(parameter, value))}>Vollständigen Nachweis öffnen</button>
      </div>
    </details>
  </article>;
}

export function Sgb2ExpenseEditor({ reference, preview, loading, error, populationAvailable, onReference, onOpenSource }: Props) {
  const [mode, setMode] = useState<Sgb2UiMode>("simple");
  const hasChanges = sgb2UiHasChanges(reference);

  return <div className="sgb2-editor" data-testid="sgb2-editor">
    <section className="card-flat sgb2-editor-head">
      <div>
        <span className="eyebrow">Mikrosimulation · Rechtsstand Juli 2026</span>
        <h3>Konkrete Bürgergeld-Parameter</h3>
        <p>Einfach- und Expertenmodus schreiben in denselben versionierten Parametersatz. Änderungen werden ohne Seitenneuladen gegen den aktiven Bevölkerungslauf berechnet.</p>
      </div>
      <div className="sgb2-editor-actions">
        <div className="sgb2-mode-switch" role="group" aria-label="Bürgergeld Bearbeitungsmodus">
          <button type="button" className={mode === "simple" ? "active" : ""} aria-pressed={mode === "simple"} onClick={() => setMode("simple")}>Einfach</button>
          <button type="button" className={mode === "expert" ? "active" : ""} aria-pressed={mode === "expert"} onClick={() => setMode("expert")}>Experte</button>
        </div>
        <button className="sgb2-reset" type="button" disabled={!hasChanges} onClick={() => onReference(resetSgb2Ui(reference))}><RotateCcw size={15} /> Baseline wiederherstellen</button>
      </div>
    </section>

    {mode === "simple" ? <section className="sgb2-simple-grid" aria-label="Einfachmodus Parametergruppen">
      {sgb2UiGroups.map((group) => {
        const state = sgb2UiGroupPercent(reference, group.id);
        const rounded = Math.round(state.percent * 10) / 10;
        return <article className="card-flat sgb2-group-card" key={group.id}>
          <div><h4>{group.label}</h4>{state.mixed && <span>gemischte Einzelwerte</span>}</div>
          <p>{group.description}</p>
          <output>{rounded.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % der Baseline</output>
          <input aria-label={`${group.label} Prozent der Baseline`} type="range" min="70" max="140" step="1" value={Math.max(70, Math.min(140, rounded))} onChange={(event) => onReference(setSgb2UiGroupPercent(reference, group.id, Number(event.target.value)))} />
          <div className="sgb2-group-scale"><span>70 %</span><span>100 %</span><span>140 %</span></div>
          <small>{group.parameterIds.length} konkrete Parameter werden gemeinsam geändert.</small>
        </article>;
      })}
    </section> : <section className="sgb2-expert-sections" aria-label="Expertenmodus konkrete Parameter">
      {sgb2UiGroups.map((group) => <article className="card-flat sgb2-expert-section" key={group.id}>
        <header><div><h4>{group.label}</h4><p>{group.description}</p></div><span>{group.parameterIds.length} Felder</span></header>
        <div className="sgb2-field-list">{sgb2UiFields.filter((field) => field.section === group.id).map((field) => <FieldEditor key={field.id} field={field} reference={reference} onReference={onReference} onOpenSource={onOpenSource} />)}</div>
      </article>)}
    </section>}

    <section className="card-flat sgb2-live-result" aria-live="polite">
      <header><div><span className="eyebrow">Live-Ergebnis</span><h3>Baseline gegen Szenario</h3></div>{preview && <span className={`sgb2-uncertainty ${preview.uncertaintyClass}`}>Unsicherheit {preview.uncertaintyClass}</span>}</header>
      {!populationAvailable && <div className="sgb2-result-message">Für die Kostenwirkung muss zuerst ein synthetischer Bevölkerungslauf aktiviert werden.</div>}
      {populationAvailable && loading && <div className="sgb2-result-message">Ansprüche, Unterkunftskosten und Kostenträger werden neu berechnet …</div>}
      {populationAvailable && error && <div className="sgb2-result-message error">{error}</div>}
      {preview && <>
        <div className="sgb2-kpi-grid">
          <article><span>Baseline</span><strong>{formatBnFromCents(preview.baselinePaymentCents)}</strong><small>{preview.periodFrom} bis {preview.periodTo}</small></article>
          <article><span>Szenario</span><strong>{formatBnFromCents(preview.scenarioPaymentCents)}</strong><small>{formatDeltaFromCents(preview.deltaPaymentCents)}</small></article>
          <article><span>Betroffene BG</span><strong>{formatWeighted(preview.affectedBenefitUnits)}</strong><small>hochgerechnete Bedarfsgemeinschaften</small></article>
          <article><span>Betroffene Personen</span><strong>{formatWeighted(preview.affectedPersons)}</strong><small>hochgerechnete Personen</small></article>
        </div>
        <div className="sgb2-result-columns">
          <div><h4>Leistungsbestandteile</h4><div className="sgb2-result-table"><div><span>Bestandteil</span><span>Baseline</span><span>Szenario</span><span>Änderung</span></div>{preview.components.map((item) => <div key={item.id}><strong>{item.label}</strong><span>{formatBnFromCents(item.baselineCents)}</span><span>{formatBnFromCents(item.scenarioCents)}</span><span className={item.deltaCents <= 0 ? "positive" : "negative"}>{formatDeltaFromCents(item.deltaCents)}</span></div>)}</div></div>
          <div><h4>Nettofinanzierung</h4><ul className="sgb2-payer-list">{preview.payers.map((payer) => <li key={payer.payer}><span>{payer.label}</span><strong>{formatBnFromCents(payer.scenarioCents)}</strong></li>)}</ul><p className="sgb2-calibration">Abstimmungsdifferenz / freie Kalibriergröße: <strong>{formatBnFromCents(preview.calibrationAdjustmentCents)}</strong></p></div>
        </div>
        <details className="sgb2-explanation"><summary>Rechenweg und Modellgrenzen anzeigen <ChevronDown size={16} /></summary><div><ol><li>Persönliche Regel- und Mehrbedarfe je Monat bestimmen.</li><li>Anrechenbares Einkommen und Freibeträge je Person berechnen und innerhalb der BG verteilen.</li><li>Unterkunft und Heizung regional prüfen und anerkannte Beträge ergänzen.</li><li>Monatlichen Zahlungsanspruch je BG bilden und das modellierte Bezugsfenster beachten.</li><li>Monatswerte mit BG-Gewichten aggregieren und nach Leistungsbestandteil sowie Kostenträger zerlegen.</li></ol><p>Es wird keine freie Restgröße zur künstlichen Anpassung an einen Haushaltswert verwendet.</p>{preview.limitations.slice(0, 3).map((item) => <p key={item}>{item}</p>)}</div></details>
      </>}
    </section>
  </div>;
}
