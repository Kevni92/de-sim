import { ExternalLink, X } from "lucide-react";
import { useEffect } from "react";
import type { EvidenceStatus, MetricRecord, ScenarioDraft, SourceRecord } from "../lib/types";

export function SourceDrawer({
  metric,
  sources,
  scenario,
  value,
  onClose,
}: {
  metric: MetricRecord | null;
  sources: SourceRecord[];
  scenario: ScenarioDraft;
  value?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!metric) return;
    const listener = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [metric, onClose]);

  useEffect(() => {
    if (!metric) return;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [metric?.id]);

  if (!metric) return null;

  const linkedSources = metric.sourceIds
    .map((sourceId) => sources.find((source) => source.id === sourceId))
    .filter((source): source is SourceRecord => Boolean(source));

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`Nachweis: ${metric.label}`}>
      <button className="drawer-backdrop" onClick={onClose} aria-label="Nachweis schließen" />
      <aside className="source-drawer transparency-drawer">
        <header>
          <div>
            <span className="eyebrow">Nachweis und Rechenweg</span>
            <h2>{metric.label}</h2>
            <div className="evidence-badges">
              <span className={`evidence-status ${metric.status}`}>{statusLabel(metric.status)}</span>
              <span className={`confidence-pill ${metric.confidence}`}>Konfidenz {metric.confidence}</span>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Schließen"><X size={15} /></button>
        </header>

        <div className="drawer-scroll">
          {value && (
            <section className="drawer-value">
              <span className="eyebrow">Angezeigter Szenariowert</span>
              <strong>{value}</strong>
              <small>{metric.unit}</small>
            </section>
          )}

          <dl className="meta-grid">
            <Meta label="Kategorie" value={metric.category} />
            <Meta label="Datenjahr" value={String(metric.dataYear)} />
            <Meta label="Rechtsstand" value={String(metric.legalYear)} />
            <Meta label="Modellversion" value={scenario.modelVersion} />
            <Meta label="Zeithorizont" value={`${scenario.horizonYears} Jahr${scenario.horizonYears === 1 ? "" : "e"}`} />
            <Meta label="Quellen" value={String(linkedSources.length)} />
          </dl>

          <section>
            <h3>Definition</h3>
            <p>{metric.description}</p>
          </section>

          <section>
            <h3>Berechnung</h3>
            <code className="formula-block">{metric.formula}</code>
            <ol className="calculation-steps">
              {metric.calculation.map((step, index) => (
                <li key={`${step.label}-${index}`}>
                  <span>{index + 1}</span>
                  <div><strong>{step.label}</strong><code>{step.expression}</code>{step.note && <p>{step.note}</p>}</div>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3>Verwendete Parameter</h3>
            <div className="parameter-table">
              {metric.parameters.map((parameter) => {
                const parameterSource = parameter.sourceId ? sources.find((source) => source.id === parameter.sourceId) : undefined;
                return (
                  <div key={`${parameter.name}-${parameter.value}`}>
                    <span>{parameter.name}</span>
                    <strong>{parameter.value}</strong>
                    <small>{parameterSource?.institution ?? "Szenarioeingabe"}</small>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h3>Unsicherheit</h3>
            <div className="uncertainty-card">
              {metric.uncertainty.kind === "not-applicable" ? (
                <strong>Für diese Darstellung nicht anwendbar</strong>
              ) : (
                <div className="uncertainty-range" aria-label={`Unsicherheitsband ${metric.uncertainty.lowerPercent} bis ${metric.uncertainty.upperPercent} Prozent`}>
                  <span>{metric.uncertainty.lowerPercent}%</span><i><b /></i><span>+{metric.uncertainty.upperPercent}%</span>
                </div>
              )}
              <p>{metric.uncertainty.description}</p>
            </div>
          </section>

          <section>
            <h3>Originalquellen</h3>
            <div className="source-list">
              {linkedSources.map((source) => (
                <article key={source.id}>
                  <div><strong>{source.title}</strong><span>{source.institution} · Datenjahr {source.dataYear}</span></div>
                  <a href={source.url} target="_blank" rel="noreferrer" aria-label={`${source.title} öffnen`}><ExternalLink size={13} /></a>
                  <p>{source.summary}</p>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h3>Bekannte Grenzen</h3>
            <ul>{metric.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>

          <section>
            <h3>Änderungsverlauf</h3>
            <div className="change-log">
              {metric.changeLog.map((entry) => (
                <article key={`${entry.version}-${entry.date}`}>
                  <strong>{entry.version}</strong><time dateTime={entry.date}>{new Date(entry.date).toLocaleDateString("de-DE")}</time><p>{entry.note}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <footer>Datenstand {metric.dataYear} · Rechtsstand {metric.legalYear} · {statusLabel(metric.status)}</footer>
      </aside>
    </div>
  );
}

function statusLabel(status: EvidenceStatus) {
  if (status === "amtlich") return "Amtliche Grundlage";
  if (status === "modell") return "Modellrechnung";
  if (status === "annahme") return "Annahme";
  return "Unbekannter Status";
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}