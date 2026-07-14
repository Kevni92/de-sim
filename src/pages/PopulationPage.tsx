import { AlertTriangle, CheckCircle2, Database, Info, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_BASELINE_ID, DEFAULT_POPULATION_SAMPLE_SIZE, DEFAULT_POPULATION_SEED } from "../lib/population-model";
import type { PopulationGenerationOptions, PopulationRun } from "../lib/types";

const distributionTabs = [
  ["ageGroup", "Alter"], ["householdType", "Haushaltsformen"], ["employmentStatus", "Erwerbsstatus"],
  ["incomeDecile", "Einkommensdezile"], ["federalState", "Bundesländer"], ["housingStatus", "Wohnen"],
  ["sgb2BenefitUnitType", "SGB-II-BG-Typen"], ["sgb2PersonStatus", "SGB-II-Personen"],
  ["sgb2IncomeBand", "SGB-II-Einkommen"], ["sgb2Region", "SGB-II-Regionen"], ["sgb2BenefitMonths", "Bezugsmonate"],
] as const;

export function PopulationPage({
  activeRun,
  runs,
  generating,
  error,
  onGenerate,
  onActivate,
  onDelete,
  onOpenSource,
}: {
  activeRun: PopulationRun | null;
  runs: PopulationRun[];
  generating: boolean;
  error: string;
  onGenerate: (options: PopulationGenerationOptions) => void;
  onActivate: (runId: string) => void;
  onDelete: (runId: string) => void;
  onOpenSource: (sourceId: string) => void;
}) {
  const [seed, setSeed] = useState(DEFAULT_POPULATION_SEED);
  const [sampleSize, setSampleSize] = useState(DEFAULT_POPULATION_SAMPLE_SIZE);
  const [distribution, setDistribution] = useState<(typeof distributionTabs)[number][0]>("ageGroup");

  useEffect(() => {
    if (!activeRun) return;
    setSeed(activeRun.metadata.seed);
    setSampleSize(activeRun.metadata.sampleSize);
  }, [activeRun]);

  const summary = activeRun?.summary;
  const sgb2Summary = activeRun?.sgb2Summary;
  const distributionItems = summary?.distributions[distribution] ?? [];

  return (
    <main className="content-width population-page">
      <header className="population-header">
        <div><span>Erweiterte Prüfebene</span><h1>Modellbasis und Bevölkerung</h1><p>Hier lassen sich die automatisch verwendete synthetische Datenbasis, ihre Kalibrierung und gespeicherte Generationsläufe vollständig prüfen und verwalten.</p></div>
        <button className="button secondary" onClick={() => onOpenSource("source-population-model")}><Info size={14} /> Methode und Quellen</button>
      </header>

      <div className="population-boundary"><strong>Hinweis:</strong> Für normale Reformabläufe ist keine manuelle Erzeugung nötig. Eine neue oder aktivierte Modellbasis kann Ergebnisse verändern und wird deshalb im Szenario referenziert.</div>
      {error && <div className="population-error" role="alert"><AlertTriangle size={16} /> {error}</div>}

      <section className="population-overview" aria-label="Aktive Modellbasis">
        <article className="card-flat population-active-card">
          <header><div><span className="population-icon"><Database size={18} /></span><div><h2>Aktive Modellbasis</h2><p>{activeRun?.metadata.id ?? "wird geladen"}</p></div></div>{activeRun && <StatusBadge status={activeRun.metadata.quality.status} />}</header>
          <div className="population-kpi-grid">
            <Metric label="Synthetische Personen" value={formatInteger(summary?.personCount)} note="gespeicherte Stichprobe" />
            <Metric label="Synthetische Haushalte" value={formatInteger(summary?.householdCount)} note="konsistent verknüpft" />
            <Metric label="Gewichtete Bevölkerung" value={formatMillion(summary?.weightedPopulation)} note="Kalibrierungsziel" />
            <Metric label="Gewichtete Haushalte" value={formatMillion(summary?.weightedHouseholds)} note="Kalibrierungsziel" />
            <Metric label="Gewichtete Bedarfsgemeinschaften" value={formatMillion(sgb2Summary?.weightedBenefitUnits)} note="modellierter Jahresbestand" />
            <Metric label="SGB-II-Personen" value={formatMillion(sgb2Summary?.weightedSgb2Persons)} note="gewichtete Mitglieder" />
            <Metric label="Mittlere Bezugsdauer" value={formatMonths(sgb2Summary?.averageBenefitMonths)} note="unterjährige Zu- und Abgänge" />
            <Metric label="Datenstand" value={String(activeRun?.metadata.dataYear ?? "–")} note={activeRun?.metadata.baselineId ?? "Baseline"} />
            <Metric label="Seed" value={activeRun?.metadata.seed ?? "–"} note={activeRun?.metadata.sgb2ModelVersion ?? activeRun?.metadata.modelVersion ?? "Modellversion"} />
          </div>
          {activeRun && <p className="population-boundary"><strong>Modellgrenze:</strong> {activeRun.metadata.limitations.join(" ")}</p>}
        </article>

        <article className="card-flat population-generator">
          <div className="section-title"><div><h2>Eigene Modellbasis erzeugen</h2><p>Gleicher Seed, gleiche Baseline und gleiche Modellversion ergeben dieselben Personen, Haushalte und Bedarfsgemeinschaften.</p></div></div>
          <label><span>Seed</span><input aria-label="Seed der Bevölkerung" value={seed} onChange={(event) => setSeed(event.target.value)} /></label>
          <label><span>Stichprobengröße</span><select aria-label="Stichprobengröße" value={sampleSize} onChange={(event) => setSampleSize(Number(event.target.value))}><option value={2_000}>2.000 Personen</option><option value={5_000}>5.000 Personen</option><option value={10_000}>10.000 Personen · Standard</option><option value={25_000}>25.000 Personen</option><option value={50_000}>50.000 Personen</option></select></label>
          <label><span>Baseline</span><select aria-label="Bevölkerungsbaseline" value={DEFAULT_BASELINE_ID} disabled><option value={DEFAULT_BASELINE_ID}>Deutschland 2024/2025 · Version 1</option></select></label>
          <button className="button primary population-generate" disabled={generating || !seed.trim()} onClick={() => onGenerate({ seed: seed.trim(), sampleSize, baselineId: DEFAULT_BASELINE_ID })}>{generating ? <><RefreshCw className="spin" size={15} /> Generierung läuft im Worker</> : <><RefreshCw size={15} /> Erzeugen und für Szenario verwenden</>}</button>
          <small>Diese Expertenfunktion ersetzt die Modellbasis des aktuellen Szenarios bewusst. Die Standardbasis mit 10.000 Personen wird in normalen Reformansichten automatisch bereitgestellt.</small>
        </article>
      </section>

      <section className="card-flat population-distributions">
        <header><div><h2>Gewichtete Verteilungen</h2><p>Haushalts- und SGB-II-Strukturen bleiben getrennt nachvollziehbar.</p></div><button className="source-badge" onClick={() => onOpenSource(distribution.startsWith("sgb2") ? "source-sgb2-statistics" : "source-population-microcensus")}><Info size={11} /> Nachweis</button></header>
        <div className="population-tabs" role="tablist" aria-label="Verteilungsansichten">{distributionTabs.map(([id, label]) => <button key={id} role="tab" aria-selected={distribution === id} className={distribution === id ? "active" : ""} onClick={() => setDistribution(id)}>{label}</button>)}</div>
        <div className="population-bars">{distributionItems.map((item) => <div className="population-bar-row" key={item.id}><span>{labelFor(item.label)}</span><div><i style={{ width: `${Math.max(1, item.share * 100)}%` }} /></div><strong>{formatPercent(item.share)}</strong></div>)}</div>
      </section>

      <section className="population-lower-grid">
        <article className="card-flat population-calibration">
          <header><div><h2>Kalibrierungsbericht</h2><p>Ziel, synthetischer Istwert, Toleranz und Quelle einschließlich SGB-II-Strukturen.</p></div>{activeRun && <StatusBadge status={activeRun.metadata.quality.status} />}</header>
          <div className="population-table-wrap"><table><thead><tr><th>Dimension</th><th>Kategorie</th><th>Ziel</th><th>Modell</th><th>Abweichung</th><th>Status</th><th>Quelle</th></tr></thead><tbody>{activeRun?.calibration.map((entry) => <tr key={entry.id} className={entry.status === "warnung" ? "warning" : ""}><td>{entry.dimension}</td><td>{labelFor(entry.category)}</td><td>{entry.unit === "anzahl" ? formatInteger(entry.target) : formatPercent(entry.target)}</td><td>{entry.unit === "anzahl" ? formatInteger(entry.actual) : formatPercent(entry.actual)}</td><td>{formatSignedPercent(entry.relativeDeviation)}</td><td><StatusBadge status={entry.status} compact /></td><td><button className="table-source" onClick={() => onOpenSource(entry.sourceId)}>Quelle</button></td></tr>)}</tbody></table></div>
        </article>

        <aside className="card-flat population-runs">
          <div className="section-title"><div><h2>Gespeicherte Modellbasen</h2><p>Eine andere Basis bewusst für das aktuelle Szenario aktivieren oder lokal löschen.</p></div><span>{runs.length}</span></div>
          <div className="population-run-list">{runs.map((run) => <article className={run.metadata.active ? "active" : ""} key={run.metadata.id}><button className="population-run-main" onClick={() => onActivate(run.metadata.id)}><strong>{run.metadata.seed}</strong><span>{formatInteger(run.metadata.sampleSize)} Personen · {new Date(run.metadata.createdAt).toLocaleString("de-DE")}</span><small>{run.metadata.id}</small></button><button className="icon-button" aria-label={`Bevölkerungslauf ${run.metadata.seed} löschen`} disabled={run.metadata.active && runs.length === 1} onClick={() => { if (window.confirm("Diesen synthetischen Bevölkerungslauf lokal löschen? Die Szenarioreferenz wird nicht stillschweigend ersetzt.")) onDelete(run.metadata.id); }}><Trash2 size={14} /></button></article>)}</div>
        </aside>
      </section>

      <section className="card-flat population-transparency">
        <div><h2>Transparenz und Datenschutz</h2><p>Keine Namen, Adressen, Geburtsdaten, Arbeitgeber oder andere identifizierende Merkmale werden erzeugt. Die Daten sind vollständig synthetisch und dienen ausschließlich der Modellrechnung.</p></div>
        <ul><li><strong>Amtlich beobachtet:</strong> ausgewählte Randverteilungen und SGB-II-Aggregate.</li><li><strong>Modelliert:</strong> gemeinsame Verteilungen, Bedarfsgemeinschaften, Einkommen, Wohnkosten, Vermögen und Bezugsdauer.</li><li><strong>Unsicherheit:</strong> Kalibrierung ersetzt keine repräsentative multivariate Mikrodatenbasis und keine Einzelfallprüfung.</li></ul>
        <div className="population-source-actions"><button className="button secondary small" onClick={() => onOpenSource("source-population-destatis")}>Bevölkerung</button><button className="button secondary small" onClick={() => onOpenSource("source-population-microcensus")}>Mikrozensus</button><button className="button secondary small" onClick={() => onOpenSource("source-sgb2-statistics")}>SGB-II-Statistik</button><button className="button secondary small" onClick={() => onOpenSource("source-population-phf")}>PHF Vermögen</button><button className="button secondary small" onClick={() => onOpenSource("source-population-model")}>Modellkern</button></div>
      </section>
    </main>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function StatusBadge({ status, compact = false }: { status: "innerhalb-toleranz" | "warnung"; compact?: boolean }) { return <span className={`population-status ${status} ${compact ? "compact" : ""}`}>{status === "innerhalb-toleranz" ? <CheckCircle2 size={compact ? 11 : 13} /> : <AlertTriangle size={compact ? 11 : 13} />}{status === "innerhalb-toleranz" ? "innerhalb Toleranz" : "Warnung"}</span>; }
function formatInteger(value?: number) { return value == null ? "–" : Math.round(value).toLocaleString("de-DE"); }
function formatMillion(value?: number) { return value == null ? "–" : `${(value / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mio.`; }
function formatMonths(value?: number) { return value == null ? "–" : `${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Monate`; }
function formatPercent(value: number) { return value.toLocaleString("de-DE", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function formatSignedPercent(value: number) { return `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toLocaleString("de-DE", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function labelFor(value: string) { return ({ alleinlebend: "Alleinlebend", "paar-ohne-kinder": "Paar ohne Kinder", "paar-mit-kindern": "Paar mit Kindern", alleinerziehend: "Alleinerziehend", mehrpersonen: "Mehrpersonenhaushalt", rentnerhaushalt: "Rentnerhaushalt", erwerbstaetig: "Erwerbstätig", arbeitslos: "Arbeitslos", rente: "Rente", bildung: "Bildung", "nicht-erwerbstaetig": "Nicht erwerbstätig", grossstadt: "Großstadt", staedtisch: "Städtisch", laendlich: "Ländlich", miete: "Miete", eigentum: "Eigentum", alleinstehend: "Alleinstehend", gemischt: "Gemischte Bedarfsgemeinschaft", erwerbsfaehig: "Erwerbsfähig", "nicht-erwerbsfaehig-kind": "Nicht erwerbsfähig · Kind", "nicht-erwerbsfaehig-erwachsen": "Nicht erwerbsfähig · Erwachsene", "kein-einkommen": "Kein anrechenbares Einkommen", "niedriges-erwerbseinkommen": "Niedriges Erwerbseinkommen", "sonstiges-einkommen": "Sonstiges Einkommen", "vorrangige-leistung": "Vorrangige Leistung", west: "West", ost: "Ost", sued: "Süd", stadtstaat: "Stadtstaat" } as Record<string, string>)[value] ?? (value.match(/^\d+$/) ? `Dezil ${value}` : value); }
