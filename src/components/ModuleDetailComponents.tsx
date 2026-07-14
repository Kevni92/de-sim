import { ChevronLeft, Clock3, Info, RotateCcw, Settings2 } from "lucide-react";
import {
  calculationFreshnessLabel,
  modelLevelCaution,
  modelLevelDescription,
  modelLevelLabel,
  timeHorizonLabel,
  type CalculationFreshness,
} from "../lib/scenario-calculation";
import type { ModelLevel, TimeHorizon } from "../lib/types";

export const SCENARIO_CALCULATION_SETTINGS_EVENT = "de-sim:open-scenario-calculation-settings";

export function requestScenarioCalculationSettings() {
  window.dispatchEvent(new Event(SCENARIO_CALCULATION_SETTINGS_EVENT));
}

export function ModulePageHeader({
  eyebrow,
  title,
  description,
  onBack,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onBack: () => void;
}) {
  return (
    <header className="detail-header revenue-header module-page-header">
      <div className="module-page-heading">
        <button className="back-link" onClick={onBack}><ChevronLeft size={14} /> Zurück zum Dashboard</button>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}

export function ModuleSummaryHeader({
  badge,
  badgeTone,
  title,
  description,
  onOpenSource,
  onReset,
}: {
  badge: string;
  badgeTone?: "hoch" | "mittel" | "niedrig";
  title: string;
  description: string;
  onOpenSource: () => void;
  onReset: () => void;
}) {
  return (
    <div className="module-summary-head">
      <div>
        <span className={`evidence-pill ${badgeTone ?? ""}`.trim()}>{badge}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="module-summary-actions">
        <button className="button secondary small" onClick={onOpenSource}><Info size={13} /> Berechnung und Quellen</button>
        <button className="button secondary small" onClick={onReset}><RotateCcw size={13} /> Baseline wiederherstellen</button>
      </div>
    </div>
  );
}

export function ModuleMetric({
  label,
  value,
  note,
  tone = "neutral",
  testId,
  onSource,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "positive" | "negative" | "neutral";
  testId?: string;
  onSource?: () => void;
}) {
  return (
    <article>
      <div className="module-metric-head">
        <span>{label}</span>
        {onSource && <button className="plain-icon" aria-label={`Nachweis für ${label}`} onClick={onSource}><Info size={11} /></button>}
      </div>
      <strong className={tone} data-testid={testId}>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

export function ModuleCalculationContextCard({
  modelLevel,
  horizonYears,
  description = "Diese Einstellung gilt für das gesamte Szenario und wird hier nicht unabhängig verändert.",
  status = "current",
  statusMessage,
}: {
  modelLevel: ModelLevel;
  horizonYears: TimeHorizon;
  description?: string;
  status?: CalculationFreshness;
  statusMessage?: string;
}) {
  return (
    <article className="card-flat scenario-calculation-card" data-testid="scenario-calculation-summary" data-status={status}>
      <div className="scenario-calculation-card-head">
        <div>
          <h3>Berechnungsrahmen</h3>
          <p>{description}</p>
        </div>
        <span className={`scenario-calculation-state ${status}`} role="status" aria-live="polite">
          {calculationFreshnessLabel(status)}
        </span>
      </div>
      <dl className="scenario-calculation-values">
        <div>
          <dt>Berechnet</dt>
          <dd>{modelLevelLabel(modelLevel)}</dd>
          <small>{modelLevelDescription(modelLevel)}</small>
        </div>
        <div>
          <dt><Clock3 size={13} /> Zeitraum</dt>
          <dd>{timeHorizonLabel(horizonYears)}</dd>
          <small>zentral für das Szenario gespeichert</small>
        </div>
      </dl>
      <p className={`scenario-calculation-note ${modelLevel === "langfrist" ? "warning" : ""}`}>{statusMessage ?? modelLevelCaution(modelLevel)}</p>
      <button className="button secondary small scenario-calculation-edit" type="button" onClick={requestScenarioCalculationSettings}>
        <Settings2 size={13} /> Im Szenario ändern
      </button>
    </article>
  );
}
