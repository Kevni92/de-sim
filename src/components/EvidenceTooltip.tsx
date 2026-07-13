import { Info } from "lucide-react";
import type { Confidence, MetricRecord, SourceRecord } from "../lib/types";
import { Tooltip } from "./Tooltip";

const statusLabels: Record<MetricRecord["status"], string> = {
  amtlich: "Amtliche Grundlage",
  modell: "Modellrechnung",
  annahme: "Annahme",
  unbekannt: "Status offen",
};

const confidencePoints: Record<Confidence, number> = {
  hoch: 3,
  mittel: 2,
  niedrig: 1,
};

function sourceInstitutions(metric: MetricRecord, sources: SourceRecord[]) {
  const institutions = Array.from(new Set(
    metric.sourceIds
      .map((sourceId) => sources.find((source) => source.id === sourceId)?.institution)
      .filter((institution): institution is string => Boolean(institution)),
  ));
  if (institutions.length === 0) return "Keine Primärquelle hinterlegt";
  if (institutions.length <= 2) return institutions.join(" · ");
  return `${institutions.slice(0, 2).join(" · ")} · +${institutions.length - 2} weitere`;
}

function EvidencePreview({ metric, sources }: { metric?: MetricRecord; sources: SourceRecord[] }) {
  if (!metric) return <div className="evidence-tooltip-copy"><strong>Quellennachweis</strong><p>Nachweisdaten werden geladen.</p></div>;

  return <div className="evidence-preview">
    <div className="evidence-tooltip-head">
      <strong>{metric.label}</strong>
      <span className={`evidence-status ${metric.status}`}>{statusLabels[metric.status]}</span>
    </div>
    <div className="evidence-tooltip-badges">
      <span>Konfidenz {metric.confidence}</span>
      <span>Daten {metric.dataYear}</span>
      <span>Recht {metric.legalYear}</span>
    </div>
    <dl>
      <div><dt>Grundlage</dt><dd>{sourceInstitutions(metric, sources)}</dd></div>
      <div><dt>Unsicherheit</dt><dd>{metric.uncertainty.description}</dd></div>
      {metric.limitations[0] && <div><dt>Wichtige Grenze</dt><dd>{metric.limitations[0]}</dd></div>}
    </dl>
    <small>Klicken öffnet den vollständigen Nachweis.</small>
  </div>;
}

export function EvidenceSourceButton({ metric, sources, contextLabel, onClick, iconOnly = false }: {
  metric?: MetricRecord;
  sources: SourceRecord[];
  contextLabel: string;
  onClick: () => void;
  iconOnly?: boolean;
}) {
  return <Tooltip content={<EvidencePreview metric={metric} sources={sources} />}>
    <button
      aria-label={`Quelle für ${contextLabel}`}
      className={iconOnly ? "plain-icon source-icon-button" : "source-badge"}
      onClick={onClick}
      type="button"
    >
      <Info size={iconOnly ? 12 : 10} />
      {!iconOnly && "Quelle"}
    </button>
  </Tooltip>;
}

export function ConfidenceIndicator({ confidence }: { confidence: Confidence }) {
  const points = confidencePoints[confidence];
  const title = `Belastbarkeit: ${confidence[0].toUpperCase()}${confidence.slice(1)}`;
  return <Tooltip content={<div className="confidence-explanation">
    <strong>{title}</strong>
    <p>{points} von 3 Punkten. Der Indikator fasst Datenbasis, Methode und bekannte Unsicherheit zusammen.</p>
    <small>3 = hoch · 2 = mittel · 1 = niedrig</small>
  </div>}>
    <span
      aria-label={`${title}, ${points} von 3 Punkten`}
      className={`confidence confidence-trigger ${confidence}`}
      role="img"
      tabIndex={0}
    >
      <i /><i /><i />
    </span>
  </Tooltip>;
}
