import { BadgeEuro, ChevronDown, House, Info, RotateCcw, Users, WalletCards } from "lucide-react";
import { useState } from "react";
import type { Sgb2ScenarioReference } from "../lib/sgb2-policy";
import { setSimpleControl, simpleControlState, simpleExampleValue, typicalMonthlyDeltaCents } from "../lib/sgb2-simple-controls";
import {
  getSgb2Parameter,
  resetSgb2Ui,
  resolvedSgb2UiValue,
  setSgb2UiParameter,
  sgb2UiDisplayValue,
  sgb2UiFields,
  sgb2UiGroups,
  sgb2UiHasChanges,
  sgb2UiInputStep,
  sgb2UiInputValue,
  sgb2UiModelValue,
  type Sgb2UiMode,
  type Sgb2UiPreviewResult,
} from "../lib/sgb2-ui";
import "../sgb2-everyday.css";

interface Props {
  reference: Sgb2ScenarioReference;
  preview: Sgb2UiPreviewResult | null;
  loading: boolean;
  error: string;
  populationAvailable: boolean;
  onReference: (reference: Sgb2ScenarioReference) => void;
  onOpenSource: (sourceId: string, value?: string) => void;
}

const formatBn = (cents: number) => `${(cents / 100_000_000_000).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Mrd. €`;
const formatBnDelta = (cents: number) => `${cents > 0 ? "+" : cents < 0 ? "−" : "±"}${formatBn(Math.abs(cents))}`;
const formatCount = (value: number) => value.toLocaleString("de-DE", { maximumFractionDigits: 0 });
const formatEuro = (cents: number) => `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const formatEuroDelta = (cents: number) => `${cents > 0 ? "+" : cents < 0 ? "−" : "±"}${formatEuro(Math.abs(cents))}`;
const formatPercentChange = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toLocaleString("de-DE", { maximumFractionDigits: 0 })} %`;
const formatDuration = (milliseconds: number) => milliseconds < 1_000 ? `${milliseconds.toLocaleString("de-DE")} ms` : `${(milliseconds / 1_000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s`;

function MixedChip({ mixed }: { mixed: boolean }) {
  return mixed ? <span className="sgb2-everyday-mixed">Einzelwerte im Expertenmodus geändert</span> : null;
}

function PercentDecision({ label, value, mixed, onChange }: { label: string; value: number; mixed: boolean; onChange: (value: number) => void }) {
  const rounded = Math.max(-30, Math.min(40, Math.round(value)));
  return <div className="sgb2-everyday-control">
    <div><output>{formatPercentChange(rounded)}</output><MixedChip mixed={mixed} /></div>
    <input aria-label={label} type="range" min="-30" max="40" step="1" value={rounded} onChange={(event) => onChange(Number(event.target.value))} />
    <div className="sgb2-everyday-scale"><span>30 % weniger</span><span>unverändert</span><span>40 % mehr</span></div>
  </div>;
}

function StandardMode({ reference, onReference, onExpert }: { reference: Sgb2ScenarioReference; onReference: Props["onReference"]; onExpert: () => void }) {
  const needs = simpleControlState(reference, "standard-needs");
  const income = simpleControlState(reference, "income-free-amount");
  const housing = simpleControlState(reference, "housing-recognition");
  const additional = simpleControlState(reference, "additional-needs");
  const singleBaseline = getSgb2Parameter("sgb2.standard-need.single").value as number;
  const singleCurrent = simpleExampleValue(reference, "sgb2.standard-need.single");
  const rentBaseline = getSgb2Parameter("sgb2.housing.berlin-2026.gross-cold-rent.hh1").value as number;
  const rentCurrent = simpleExampleValue(reference, "sgb2.housing.berlin-2026.gross-cold-rent.hh1");

  return <section className="sgb2-everyday-grid" aria-label="Politische Bürgergeld-Stellschrauben">
    <article className="card-flat sgb2-everyday-card" data-testid="sgb2-standard-needs-control">
      <header><BadgeEuro size={20} /><div><h4>Regelbedarfe verändern</h4><p>Alle monatlichen Regelbedarfe für Erwachsene und Kinder werden gemeinsam angehoben oder gesenkt.</p></div></header>
      <PercentDecision label="Regelbedarfe Veränderung in Prozent" value={needs.value} mixed={needs.mixed} onChange={(value) => onReference(setSimpleControl(reference, "standard-needs", value))} />
      <div className="sgb2-everyday-example"><span>Beispiel alleinstehende Person</span><strong>{formatEuro(singleCurrent)} pro Monat</strong><small>{formatEuroDelta(singleCurrent - singleBaseline)} gegenüber dem geltenden Wert von {formatEuro(singleBaseline)}</small></div>
    </article>

    <article className="card-flat sgb2-everyday-card" data-testid="sgb2-income-control">
      <header><WalletCards size={20} /><div><h4>Mehr vom Hinzuverdienst behalten</h4><p>Dieser Betrag aus monatlichem Erwerbseinkommen wird zuerst nicht auf die Leistung angerechnet.</p></div></header>
      <label className="sgb2-everyday-number"><span>Anrechnungsfreier Grundbetrag</span><div><input aria-label="Anrechnungsfreier Grundbetrag aus Erwerbseinkommen" type="number" min="0" max="1000" step="10" value={Math.round(income.value)} onChange={(event) => onReference(setSimpleControl(reference, "income-free-amount", Number(event.target.value)))} /><b>€ / Monat</b></div></label>
      <MixedChip mixed={income.mixed} />
      <p className="sgb2-everyday-note">Weitere Einkommensstufen und prozentuale Freibeträge bleiben im Expertenmodus einzeln bearbeitbar.</p>
    </article>

    <article className="card-flat sgb2-everyday-card" data-testid="sgb2-housing-control">
      <header><House size={20} /><div><h4>Unterkunft und Heizung anerkennen</h4><p>Verändert die modellierten Miet- und Heizkosten-Grenzen. Karenzzeiten und Verfahrensregeln bleiben davon getrennt.</p></div></header>
      <PercentDecision label="Anerkennungsgrenzen für Unterkunft und Heizung verändern" value={housing.value} mixed={housing.mixed} onChange={(value) => onReference(setSimpleControl(reference, "housing-recognition", value))} />
      <div className="sgb2-everyday-example"><span>Beispiel Berlin, eine Person</span><strong>{formatEuro(rentCurrent)} Bruttokaltmiete</strong><small>{formatEuroDelta(rentCurrent - rentBaseline)} gegenüber der integrierten Berliner Modellgrenze</small></div>
      <p className="sgb2-everyday-warning"><Info size={14} /> Außerhalb vollständig integrierter Regionen arbeitet das Modell mit einem Fallback und weist hohe Unsicherheit aus.</p>
    </article>

    <details className="card-flat sgb2-more-rules">
      <summary><span><strong>Weitere Regelungen</strong><small>Mehrbedarfe, Karenzzeiten, Leistungsminderungen und Sonderfälle</small></span><ChevronDown size={18} /></summary>
      <div>
        <h4>Mehrbedarfe gemeinsam verändern</h4>
        <p>Beispielsweise für Schwangerschaft, Alleinerziehende oder Teilhabeleistungen. Konkrete Prozentsätze bleiben im Expertenmodus sichtbar.</p>
        <PercentDecision label="Mehrbedarfe Veränderung in Prozent" value={additional.value} mixed={additional.mixed} onChange={(value) => onReference(setSimpleControl(reference, "additional-needs", value))} />
        <button className="button secondary small" type="button" onClick={onExpert}>Karenzzeiten und Leistungsminderungen im Expertenmodus bearbeiten</button>
      </div>
    </details>
  </section>;
}

function FieldEditor({ field, reference, onReference, onOpenSource }: { field: (typeof sgb2UiFields)[number]; reference: Sgb2ScenarioReference; onReference: Props["onReference"]; onOpenSource: Props["onOpenSource"] }) {
  const parameter = getSgb2Parameter(field.id);
  const value = resolvedSgb2UiValue(reference, field.id);
  if (typeof value !== "number" || typeof parameter.value !== "number") return null;
  const inputValue = sgb2UiInputValue(parameter, value);
  const min = parameter.constraints?.min == null ? undefined : sgb2UiInputValue(parameter, parameter.constraints.min);
  const max = parameter.constraints?.max == null ? undefined : sgb2UiInputValue(parameter, parameter.constraints.max);
  const step = parameter.unit === "cent-pro-monat" ? 0.01 : parameter.unit === "anteil" ? 0.1 : sgb2UiInputStep(parameter);
  const changed = Math.abs(value - parameter.value) > 1e-9;
  return <article className={`sgb2-field ${changed ? "changed" : ""}`} data-parameter-id={field.id}>
    <div className="sgb2-field-copy"><div><strong>{field.label}</strong>{changed && <span className="sgb2-change-chip">geändert</span>}</div><p>{field.description}</p><small>Baseline: {sgb2UiDisplayValue(parameter, parameter.value)}</small></div>
    <div className="sgb2-field-input"><input aria-label={`${field.label} Wert`} type="number" value={inputValue} min={min} max={max} step={step} onChange={(event) => onReference(setSgb2UiParameter(reference, field.id, sgb2UiModelValue(parameter, Number(event.target.value))))} /><span>{parameter.unit === "cent-pro-monat" ? "€ / Monat" : parameter.unit === "anteil" ? "%" : parameter.unit === "monate" ? "Monate" : parameter.unit === "quadratmeter" ? "m²" : parameter.unit}</span></div>
    <details className="sgb2-field-evidence"><summary><Info size={14} /> Quelle und Unsicherheit <ChevronDown size={14} /></summary><div><dl><div><dt>Quelle</dt><dd>{parameter.sourceId}</dd></div><div><dt>Rechtsstand</dt><dd>{parameter.legalStatusDate}</dd></div><div><dt>Datenstand</dt><dd>{parameter.dataStatusDate ?? "nicht getrennt ausgewiesen"}</dd></div><div><dt>Evidenz</dt><dd>{parameter.evidenceClass}</dd></div><div><dt>Unsicherheit</dt><dd>{parameter.uncertaintyClass}</dd></div></dl><button type="button" onClick={() => onOpenSource(parameter.sourceId, sgb2UiDisplayValue(parameter, value))}>Vollständigen Nachweis öffnen</button></div></details>
  </article>;
}

function ExpertMode({ reference, onReference, onOpenSource }: Pick<Props, "reference" | "onReference" | "onOpenSource">) {
  return <section className="sgb2-expert-sections" aria-label="Expertenmodus konkrete Parameter">{sgb2UiGroups.map((group) => <article className="card-flat sgb2-expert-section" key={group.id}><header><div><h4>{group.label}</h4><p>{group.description}</p></div><span>{group.parameterIds.length} Felder</span></header><div className="sgb2-field-list">{sgb2UiFields.filter((field) => field.section === group.id).map((field) => <FieldEditor key={field.id} field={field} reference={reference} onReference={onReference} onOpenSource={onOpenSource} />)}</div></article>)}</section>;
}

function ResultSummary({ preview, loading, error, populationAvailable, onOpenSource }: Pick<Props, "preview" | "loading" | "error" | "populationAvailable" | "onOpenSource">) {
  return <section className="card-flat sgb2-live-result" aria-live="polite">
    <header><div><span className="eyebrow">Ergebnis der Änderung</span><h3>Was bedeutet das?</h3><p className="sgb2-result-intro">Direkte Staatsausgaben, betroffene Menschen und Monatswirkung werden zuerst gezeigt. Fachliche Prüfdetails bleiben darunter erreichbar.</p></div></header>
    {!populationAvailable && <div className="sgb2-result-message">Die Modellbasis wird automatisch vorbereitet. Die politische Einstellung bleibt bereits gespeichert.</div>}
    {populationAvailable && loading && <div className="sgb2-result-message">Ansprüche, Unterkunftskosten und Kostenträger werden neu berechnet …</div>}
    {populationAvailable && error && <div className="sgb2-result-message error">{error}</div>}
    {preview && <>
      <div className="sgb2-kpi-grid" data-testid="sgb2-standard-result-kpis">
        <article><span>Staatliche Wirkung pro Jahr</span><strong>{formatBnDelta(preview.deltaPaymentCents)}</strong><small>Mehr- oder Minderausgaben gegenüber der geltenden Baseline</small></article>
        <article><span>Betroffene Menschen</span><strong>{formatCount(preview.affectedPersons)} Personen</strong><small>{formatCount(preview.affectedBenefitUnits)} Bedarfsgemeinschaften – Haushalte, die Leistungen gemeinsam erhalten</small></article>
        <article><span>Durchschnitt pro Bezugsmonat</span><strong>{formatEuroDelta(typicalMonthlyDeltaCents(preview))}</strong><small>je gewichteter Bedarfsgemeinschaft und Monat; kein individueller Bescheid</small></article>
        <article><span>Belastbarkeit</span><strong>{preview.uncertaintyClass === "hoch" ? "Hohe Unsicherheit" : "Mittlere Unsicherheit"}</strong><small>{preview.uncertaintyClass === "hoch" ? "regionale oder modellbedingte Grenzen besonders beachten" : "Bandbreiten und Modellgrenzen in der Vertiefung"}</small></article>
      </div>

      <details className="sgb2-result-detail"><summary><span><strong>Leistungsbestandteile und Ausgangswerte</strong><small>Baseline, Szenario und getrennte Zahlungsbestandteile</small></span><ChevronDown size={17} /></summary><div><div className="sgb2-baseline-pair"><article><span>Baseline</span><strong>{formatBn(preview.baselinePaymentCents)}</strong><small>{preview.periodFrom} bis {preview.periodTo}</small></article><article><span>Szenario</span><strong>{formatBn(preview.scenarioPaymentCents)}</strong><small>{formatBnDelta(preview.deltaPaymentCents)}</small></article></div><div className="sgb2-result-table"><div><span>Bestandteil</span><span>Baseline</span><span>Szenario</span><span>Änderung</span></div>{preview.components.map((item) => <div key={item.id}><strong>{item.label}</strong><span>{formatBn(item.baselineCents)}</span><span>{formatBn(item.scenarioCents)}</span><span>{formatBnDelta(item.deltaCents)}</span></div>)}</div></div></details>

      <details className="sgb2-result-detail"><summary><span><strong>Finanzierung und Kostenträger</strong><small>Wer den modellierten Zahlungsbetrag trägt</small></span><ChevronDown size={17} /></summary><div><ul className="sgb2-payer-list">{preview.payers.map((payer) => <li key={payer.payer}><span>{payer.label}</span><strong>{formatBn(payer.scenarioCents)}</strong></li>)}</ul><p className="sgb2-calibration">Freie Kalibriergröße: <strong>{formatBn(preview.calibrationAdjustmentCents)}</strong>. Das Modell passt Ergebnisse nicht künstlich an einen gewünschten Haushaltswert an.</p></div></details>

      <details className="sgb2-result-detail"><summary><span><strong>Fachliche Prüfung und amtlicher Abgleich</strong><small>Reproduzierbarkeit, Unsicherheitsband, Quellen und Modelllücken</small></span><ChevronDown size={17} /></summary><div><section className="sgb2-release-validation" aria-label="Release-Abnahme"><header><div><span className="eyebrow">Fachliche Prüfebene</span><h3>Reproduzierbarkeit und amtlicher Abgleich</h3><p>{preview.releaseValidation.qualityLabel}</p></div><span className={`sgb2-quality ${preview.releaseValidation.qualityStatus === "prüfbar" ? "ok" : "limited"}`}>{preview.releaseValidation.qualityStatus}</span></header><div className="sgb2-validation-kpis"><article><span>Reproduzierbarkeitsschlüssel</span><strong data-testid="sgb2-reproducibility-key">{preview.releaseValidation.reproducibilityKey}</strong><small>gleicher Lauf und gleiche Baseline ergeben denselben Schlüssel</small></article><article><span>Unsicherheitsband Baseline</span><strong>{formatBn(preview.releaseValidation.uncertaintyBand.lowerCents)} bis {formatBn(preview.releaseValidation.uncertaintyBand.upperCents)}</strong><small>kein Konfidenzintervall</small></article><article><span>Performance</span><strong>{formatDuration(preview.releaseValidation.performance.durationMs)}</strong><small>{formatCount(preview.releaseValidation.performance.simulatedBenefitUnitMonths)} Bedarfsgemeinschafts-Monate</small></article></div><h4>Amtlicher Abgleich</h4><div className="sgb2-reference-table"><div><span>Vergleich</span><span>Amtlich</span><span>Modell annualisiert</span><span>Abweichung</span></div>{preview.releaseValidation.comparisons.map((item) => <article key={item.id}><div><strong>{item.scopeLabel}</strong><small>{item.label} · {item.period} · Vergleichbarkeit {item.comparability}</small><button type="button" onClick={() => onOpenSource(item.sourceId, formatBn(item.referenceValueCents))}>Quelle und Abgrenzung</button></div><span>{formatBn(item.referenceValueCents)}</span><span>{formatBn(item.modelValueCents)}</span><span>{formatBnDelta(item.absoluteDeviationCents)}</span></article>)}</div><details className="sgb2-validation-details"><summary>Abgrenzungsgründe und Modelllücken <ChevronDown size={16} /></summary><div>{preview.releaseValidation.comparisons.flatMap((item) => item.boundaryDifferences).map((item) => <p key={item}>{item}</p>)}{preview.releaseValidation.modelLimitations.map((item) => <p key={item}>{item}</p>)}</div></details></section></div></details>

      <details className="sgb2-result-detail"><summary><span><strong>Rechenweg und Modellgrenzen</strong><small>Wie aus Personen- und Haushaltsdaten das Ergebnis entsteht</small></span><ChevronDown size={17} /></summary><div className="sgb2-explanation-body"><ol><li>Persönliche Regel- und Mehrbedarfe je Monat bestimmen.</li><li>Anrechenbares Einkommen und Freibeträge je Person berechnen und innerhalb der Bedarfsgemeinschaft verteilen.</li><li>Unterkunft und Heizung regional prüfen und anerkannte Beträge ergänzen.</li><li>Monatlichen Zahlungsanspruch bilden und das modellierte Bezugsfenster beachten.</li><li>Monatswerte gewichtet aggregieren und nach Leistungsbestandteil sowie Kostenträger zerlegen.</li></ol>{preview.limitations.slice(0, 4).map((item) => <p key={item}>{item}</p>)}</div></details>
    </>}
  </section>;
}

export function Sgb2EverydayExpenseEditor({ reference, preview, loading, error, populationAvailable, onReference, onOpenSource }: Props) {
  const [mode, setMode] = useState<Sgb2UiMode>("simple");
  const hasChanges = sgb2UiHasChanges(reference);
  return <div className="sgb2-editor" data-testid="sgb2-editor">
    <section className="card-flat sgb2-editor-head"><div><span className="eyebrow">Bürgergeld und Unterkunft · Rechtsstand Juli 2026</span><h3>Politische Stellschrauben</h3><p>Im Standardmodus verändern Sie verständliche Regeln. Der Expertenmodus zeigt jeden Euro-, Prozent-, Monats- und Regionalwert desselben Parametersatzes.</p></div><div className="sgb2-editor-actions"><div className="sgb2-mode-switch" role="group" aria-label="Bürgergeld Bearbeitungsmodus"><button type="button" className={mode === "simple" ? "active" : ""} aria-pressed={mode === "simple"} onClick={() => setMode("simple")}>Standard</button><button type="button" className={mode === "expert" ? "active" : ""} aria-pressed={mode === "expert"} onClick={() => setMode("expert")}>Experte</button></div><button className="sgb2-reset" type="button" disabled={!hasChanges} onClick={() => onReference(resetSgb2Ui(reference))}><RotateCcw size={15} /> Alle Änderungen zurücksetzen</button></div></section>
    {mode === "simple" ? <StandardMode reference={reference} onReference={onReference} onExpert={() => setMode("expert")} /> : <ExpertMode reference={reference} onReference={onReference} onOpenSource={onOpenSource} />}
    <ResultSummary preview={preview} loading={loading} error={error} populationAvailable={populationAvailable} onOpenSource={onOpenSource} />
  </div>;
}
