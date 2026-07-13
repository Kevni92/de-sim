import { X } from "lucide-react";
import type { SourceRecord } from "../lib/types";

export function SourceDrawer({ source, onClose }: { source: SourceRecord | null; onClose: () => void }) {
  if (!source) return null;
  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`Quelle: ${source.title}`}>
      <button className="drawer-backdrop" aria-label="Quellenansicht schließen" onClick={onClose} />
      <aside className="drawer">
        <header className="drawer-header">
          <div>
            <span className="eyebrow">Quelle und Methodik</span>
            <h2>{source.title}</h2>
          </div>
          <button className="icon-button" aria-label="Schließen" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="drawer-content">
          <dl className="meta-grid">
            <div><dt>Institution</dt><dd>{source.institution}</dd></div>
            <div><dt>Datenjahr</dt><dd>{source.dataYear}</dd></div>
            <div><dt>Rechtsstand</dt><dd>{source.legalYear}</dd></div>
            <div><dt>Status</dt><dd>{source.status}</dd></div>
            <div><dt>Konfidenz</dt><dd>{source.confidence}</dd></div>
            <div><dt>Geprüft</dt><dd>{source.checkedAt}</dd></div>
          </dl>
          <section><h3>Verwendung</h3><p>{source.summary}</p></section>
          <section><h3>Rechenlogik</h3><p>{source.method}</p></section>
          <section><h3>Bekannte Grenzen</h3><ul>{source.limitations.map((item) => <li key={item}>{item}</li>)}</ul></section>
          <a className="text-link" href={source.url} target="_blank" rel="noreferrer">Originalquelle öffnen</a>
        </div>
      </aside>
    </div>
  );
}
