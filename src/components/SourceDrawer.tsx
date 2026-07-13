import { ExternalLink, X } from "lucide-react";
import { useEffect } from "react";
import type { SourceRecord } from "../lib/types";

export function SourceDrawer({
  source,
  value,
  onClose,
}: {
  source: SourceRecord | null;
  value?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!source) return;
    const listener = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [source, onClose]);

  if (!source) return null;

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`Quelle: ${source.title}`}>
      <button className="drawer-backdrop" onClick={onClose} aria-label="Quellenansicht schließen" />
      <aside className="source-drawer">
        <header>
          <div>
            <span className="eyebrow">Quelle und Methodik</span>
            <h2>{source.title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Schließen"><X size={15} /></button>
        </header>

        <div className="drawer-scroll">
          {value && (
            <section className="drawer-value">
              <span className="eyebrow">Angezeigter Wert</span>
              <strong>{value}</strong>
            </section>
          )}

          <dl className="meta-grid">
            <Meta label="Institution" value={source.institution} />
            <Meta label="Datenjahr" value={String(source.dataYear)} />
            <Meta label="Rechtsstand" value={String(source.legalYear)} />
            <Meta label="Status" value={source.status === "amtlich" ? "Amtliche Statistik" : source.status === "modell" ? "Modellrechnung" : "Annahme"} />
            <Meta label="Konfidenz" value={source.confidence} />
            <Meta label="Geprüft" value={new Date(source.checkedAt).toLocaleDateString("de-DE")} />
          </dl>

          <section>
            <h3>Einordnung</h3>
            <p>{source.summary}</p>
          </section>
          <section>
            <h3>Rechenlogik</h3>
            <p>{source.method}</p>
          </section>
          <section>
            <h3>Bekannte Grenzen</h3>
            <ul>{source.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <a className="source-link" href={source.url} target="_blank" rel="noreferrer">
            Zur Originalquelle <ExternalLink size={13} />
          </a>
        </div>

        <footer>Datenstand {source.dataYear} · Rechtsstand {source.legalYear} · Demonstrationsumgebung</footer>
      </aside>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
