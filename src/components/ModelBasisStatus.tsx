import { AlertTriangle, CheckCircle2, Database, RefreshCw, Settings2 } from "lucide-react";

export type ModelBasisStatusKind = "preparing" | "ready" | "warning" | "missing" | "error";

export function ModelBasisStatus({
  status,
  canReconstruct = false,
  message,
  onReconstruct,
  onUseStandard,
  onManage,
  onRetry,
}: {
  status: ModelBasisStatusKind;
  canReconstruct?: boolean;
  message?: string;
  onReconstruct?: () => void;
  onUseStandard?: () => void;
  onManage: () => void;
  onRetry?: () => void;
}) {
  const ready = status === "ready" || status === "warning";
  return (
    <section className={`model-basis-status ${status}`} data-testid="model-basis-status" aria-live="polite">
      <div className="model-basis-status-icon" aria-hidden="true">
        {status === "preparing" && <RefreshCw className="spin" size={18} />}
        {ready && (status === "warning" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />)}
        {(status === "missing" || status === "error") && <AlertTriangle size={18} />}
      </div>
      <div className="model-basis-status-copy">
        <span>Modellbasis</span>
        <strong>{label(status)}</strong>
        <p>{message ?? description(status)}</p>
        {status === "missing" && <small>Die ursprüngliche Referenz wird nicht automatisch ersetzt. Eine andere Modellbasis kann Ergebnisse verändern.</small>}
      </div>
      <div className="model-basis-status-actions">
        {status === "missing" && canReconstruct && onReconstruct && <button className="button primary small" onClick={onReconstruct}><RefreshCw size={13} /> Identische Modellbasis neu erzeugen</button>}
        {status === "missing" && onUseStandard && <button className="button secondary small" onClick={onUseStandard}><Database size={13} /> Standard-Modellbasis verwenden</button>}
        {status === "error" && onRetry && <button className="button primary small" onClick={onRetry}><RefreshCw size={13} /> Erneut versuchen</button>}
        <button className="button secondary small" onClick={onManage}><Settings2 size={13} /> Modellbasis prüfen</button>
      </div>
    </section>
  );
}

function label(status: ModelBasisStatusKind) {
  if (status === "preparing") return "wird vorbereitet";
  if (status === "ready") return "bereit";
  if (status === "warning") return "bereit mit Qualitätswarnung";
  if (status === "missing") return "ursprüngliche Referenz fehlt";
  return "konnte nicht geladen werden";
}

function description(status: ModelBasisStatusKind) {
  if (status === "preparing") return "Die stabile Standardbasis wird lokal geladen oder erstmalig erzeugt.";
  if (status === "ready") return "Steuer- und Leistungsberechnungen verwenden eine reproduzierbare, versionierte Datenbasis.";
  if (status === "warning") return "Die Berechnung ist verfügbar; einzelne Kalibrierungswerte sollten in der erweiterten Ansicht geprüft werden.";
  if (status === "missing") return "Der im Szenario gespeicherte Bevölkerungslauf ist auf diesem Gerät nicht vorhanden.";
  return "Worker oder lokaler Speicher haben die Modellbasis nicht bereitgestellt.";
}
