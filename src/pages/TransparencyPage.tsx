import { BookOpenCheck, Calculator, Database, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import type { EvidenceStatus, MetricRecord, SourceRecord } from "../lib/types";

type Filter = "alle" | EvidenceStatus;

export function TransparencyPage({
  metrics,
  sources,
  values,
  onOpenMetric,
}: {
  metrics: MetricRecord[];
  sources: SourceRecord[];
  values: Record<string, string>;
  onOpenMetric: (metricId: string, value?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("alle");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de");
    return metrics.filter((metric) => {
      const matchesStatus = filter === "alle" || metric.status === filter;
      const haystack = `${metric.label} ${metric.category} ${metric.description} ${metric.formula}`.toLocaleLowerCase("de");
      return matchesStatus && (!normalized || haystack.includes(normalized));
    });
  }, [filter, metrics, query]);

  const counts = useMemo(() => ({
    amtlich: metrics.filter((metric) => metric.status === "amtlich").length,
    modell: metrics.filter((metric) => metric.status === "modell").length,
    annahme: metrics.filter((metric) => metric.status === "annahme").length,
    quellen: sources.length,
  }), [metrics, sources]);

  return (
    <main className="content-width transparency-page">
      <header className="transparency-hero">
        <div>
          <span className="eyebrow">Milestone 3 · Nachvollziehbarkeit</span>
          <h1>Transparenzregister</h1>
          <p>Jede zentrale Kennzahl ist mit Definition, Rechenweg, Parametern, Originalquellen, Unsicherheit und Änderungsverlauf verknüpft.</p>
        </div>
        <div className="transparency-principle">
          <ShieldCheck size={22} />
          <div><strong>Keine Zahl ohne Status</strong><span>Amtliche Grundlage, Modellrechnung und Annahme bleiben sichtbar getrennt.</span></div>
        </div>
      </header>

      <section className="transparency-stats" aria-label="Übersicht der Nachweise">
        <Stat icon={<Database size={17} />} label="Amtliche Grundlagen" value={counts.amtlich} />
        <Stat icon={<Calculator size={17} />} label="Modellrechnungen" value={counts.modell} />
        <Stat icon={<BookOpenCheck size={17} />} label="Explizite Annahmen" value={counts.annahme} />
        <Stat icon={<Search size={17} />} label="Originalquellen" value={counts.quellen} />
      </section>

      <section className="card-flat transparency-catalogue" aria-labelledby="catalogue-title">
        <header>
          <div><h2 id="catalogue-title">Kennzahlen und Rechenwege</h2><p>{filtered.length} von {metrics.length} Nachweisen sichtbar</p></div>
          <div className="transparency-filters">
            <label className="search-field"><Search size={14} /><input aria-label="Nachweise durchsuchen" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kennzahl oder Formel suchen" /></label>
            <label><span>Status</span><select aria-label="Nachweise nach Status filtern" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}><option value="alle">Alle</option><option value="amtlich">Amtlich</option><option value="modell">Modell</option><option value="annahme">Annahme</option><option value="unbekannt">Unbekannt</option></select></label>
          </div>
        </header>

        <div className="metric-grid">
          {filtered.map((metric) => {
            const linkedSources = metric.sourceIds.filter((sourceId) => sources.some((source) => source.id === sourceId)).length;
            return (
              <article className="metric-card" key={metric.id}>
                <div className="metric-card-head"><span className={`evidence-status ${metric.status}`}>{statusLabel(metric.status)}</span><span className={`confidence-pill ${metric.confidence}`}>{metric.confidence}</span></div>
                <span className="eyebrow">{metric.category}</span>
                <h3>{metric.label}</h3>
                <p>{metric.description}</p>
                <div className="metric-current-value"><span>Aktueller Wert</span><strong>{values[metric.id] ?? "szenarioabhängig"}</strong><small>{metric.unit}</small></div>
                <dl><div><dt>Datenjahr</dt><dd>{metric.dataYear}</dd></div><div><dt>Rechtsstand</dt><dd>{metric.legalYear}</dd></div><div><dt>Quellen</dt><dd>{linkedSources}</dd></div></dl>
                <code>{metric.formula}</code>
                <button className="button secondary" onClick={() => onOpenMetric(metric.id, values[metric.id])}>Nachweis öffnen</button>
              </article>
            );
          })}
        </div>

        {filtered.length === 0 && <div className="transparency-empty"><Search size={24} /><strong>Keine passenden Nachweise</strong><p>Suchbegriff oder Statusfilter anpassen.</p></div>}
      </section>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <article className="card-flat transparency-stat"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></article>;
}

function statusLabel(status: EvidenceStatus) {
  if (status === "amtlich") return "Amtlich";
  if (status === "modell") return "Modell";
  if (status === "annahme") return "Annahme";
  return "Unbekannt";
}
