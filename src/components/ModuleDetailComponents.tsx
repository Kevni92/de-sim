import { ChevronLeft, Info, RotateCcw } from "lucide-react";
import type { ModelLevel } from "../lib/types";

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

export function ModuleModelLevelCard({
  description,
  ariaLabel,
  modelLevel,
  onModelLevel,
  modelLabel,
  modelDescription,
}: {
  description: string;
  ariaLabel: string;
  modelLevel: ModelLevel;
  onModelLevel: (level: ModelLevel) => void;
  modelLabel: (level: ModelLevel) => string;
  modelDescription: (level: ModelLevel) => string;
}) {
  return (
    <article className="card-flat model-level-card">
      <h3>Modellstufe</h3>
      <p>{description}</p>
      <div className="model-level-options" role="radiogroup" aria-label={ariaLabel}>
        {(["statisch", "verhalten", "langfrist"] as const).map((level) => (
          <button key={level} role="radio" aria-checked={modelLevel === level} className={modelLevel === level ? "active" : ""} onClick={() => onModelLevel(level)}>
            <strong>{modelLabel(level)}</strong>
            <small>{modelDescription(level)}</small>
          </button>
        ))}
      </div>
    </article>
  );
}
