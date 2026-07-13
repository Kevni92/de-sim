import { AlertTriangle, CheckCircle2, Database, Info, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_BASELINE_ID, DEFAULT_POPULATION_SAMPLE_SIZE, DEFAULT_POPULATION_SEED } from "../lib/population-model";
import type { PopulationGenerationOptions, PopulationRun } from "../lib/types";

const distributionTabs = [
  ["ageGroup", "Alter"], ["householdType", "Haushaltsformen"], ["employmentStatus", "Erwerbsstatus"],
  ["incomeDecile", "Einkommensdezile"], ["federalState", "Bundesländer"], ["housingStatus", "Wohnen"],
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
  const distributionItems = summary?.distributions[distribution] ?? [];

  return (
    <main className="content-width population-page">
      <header className="population-header">
        <div><span>Milestone 7 · vollständig synthetische Datenbasis</span><h1>Bevölkerung</h1><p>Deterministisch erzeugte und gewichtete Personen und Haushalte für gemeinsame Verteilungs-, Reichweiten- und Steuerberechnungen.</p></div>
        <button className="button secondary" onClick={() => onOpenSource("source-population-model")}><Info size={14} /> Methode und Quellen</button>
      </header>

      {error && <div className="population-error" role="alert"><AlertTriangle size={16} /> {error}</div>}

      <section className="population-overview" aria-label="Aktiver Bevölkerungslauf">
        <article className="card-flat population-active-card">
          <header><div><span className="population-icon"><Database size={18} /></span><div><h2>Aktiver Lauf</h2><p>{activeRun?.metadata.id ?? "wird geladen"}</p></div></div>{activeRun && <StatusBadge status={activeRun.metadata.quality.status} />}</header>
          <div className="population-kpi-grid">
            <Metric label="Synthetische Personen" value={formatInteger(summary?.personCount)} note="gespeicherte Stichprobe" />
            <Metric label="Synthetische Haushalte" value={formatInteger(summary?.householdCount)} note="konsistent verknüpft" />
            <Metric label="Gewichtete Bevölkerung" value={formatMillion(summary?.weightedPopulation)} note="Kalibrierungsziel" />
            <Metric label="Gewichtete Haushalte" value={formatMillion(summary?.weightedHouseholds)} note="Kalibrierungsziel" />
            <Metric label="Datenstand" value={String(activeRun?.metadata.dataYear ?? "–")} note={activeRun?.metadata.baselineId ?? "Baseline"} />
            <Metric label="Seed" value={activeRun?.metadata.seed ?? "–"} note={activeRun?.metadata.modelVersion ?? "Modellversion"} />
          </div>
          {activeRun && <p className="population-boundary"><strong>Modellgrenze:</strong> {activeRun.metadata.limitations.join(" ")}</p>}
        </article>

        <article className="card-flat population-generator">
          <div className="section-title"><div><h2>Bevölkerung erzeugen</h2><p>Gleicher Seed, gleiche Baseline und gleiche Modellversion ergeben dieselben synthetischen Datensätze.</p></div></div>
          <label><span>Seed</span><input aria-label="Seed der Bevölkerung" value={seed} onChange={(event) => setSeed(event.target.value)} /></label>
          <label><span>Stichprobengröße</span><select aria-label="Stichprobengröße" value={sampleSize} onChange={(event) => setSampleSize(Number(event.target.value))}><option value={2_000}>2.000 Personen</option><option value={5_000}>5.000 Personen</option><option value={10_000}>10.000 Personen · Standard</option><option value={25_000}>25.000 Personen</option><option value={50_000}>50.000 Personen</option></select></label>
          <label><span>Baseline</span><select aria-label="Bevölkerungsbaseline" value={DEFAULT_BASELINE_ID} disabled><option value={DEFAULT_BASELINE_ID}>Deutschland 2024/2025 · Version 1</option></select></label>
          <button className="button primary population-generate" disabled={generating || !seed.trim()} onClick={() => onGenerate({ seed: seed.trim(), sampleSize, baselineId: DEFAULT_BASELINE_ID })}>{generating ? <><RefreshCw className="spin" size={15} /> Generierung läuft im Worker</> : <><RefreshCw size={15} /> Neu erzeugen</>}</button>
          <small>Standard: 10.000 Personen. Die UI erhält nur Zusammenfassungen; Einzelpersonen verbleiben im lokalen Worker und in IndexedDB.</small>
        </article>
      </section>

      <section className="card-flat population-distributions">
        <header><div><h2>Gewichtete Verteilungen</h2><p>Gemeinsame Aggregationsschicht des aktiven Laufs.</p></div><button className="source-badge" onClick={() => onOpenSource("source-population-microcensus")}><Info size={11} /> Nachweis</button></header>
        <div className="population-tabs" role="tablist" aria-label="Verteilungsansichten">{distributionTabs.map(([id, label]) => <button key={id} role="tab" aria-selected={distribution === id} className={distribution === id ? "active" : ""} onClick={() => setDistribution(id)}>{label}</button>)}</div>
        <div className="population-bars">{distributionItems.map((item) => <div className="population-bar-row" key={item.id}><span>{labelFor(item.label)}</span><div><i style={{ width: `${Math.max(1, item.share * 100)}%` }} /></div><strong>{formatPercent(item.share)}</strong></div>)}</div>
      </section>

      <section className="population-lower-grid">
        <article className="card-flat population-calibration">
          <header><div><h2>Kalibrierungsbericht</h2><p>Ziel, synthetischer Istwert und toleranzbezogene Abweichung.</p></div>{activeRun && <StatusBadge status={activeRun.metadata.quality.status} />}</header>
          <div className="population-table-wrap"><table><thead><tr><th>Dimension</th><th>Kategorie</th><th>Ziel</th><th>Modell</th><th>Abweichung</th><th>Status</th><th>Quelle</th></tr></thead><tbody>{activeRun?.calibration.map((entry) => <tr key={entry.id} className={entry.status === "warnung" ? "warning" : ""}><td>{entry.dimension}</td><td>{labelFor(entry.category)}</td><td>{formatPercent(entry.target)}</td><td>{formatPercent(entry.actual)}</td><td>{formatSignedPercent(entry.relativeDeviation)}</td><td><StatusBadge status={entry.status} compact /></td><td><button className="table-source" onClick={() => onOpenSource(entry.sourceId)}>Quelle</button></td></tr>)}</tbody></table></div>
        </article>

        <aside className="card-flat population-runs">
          <div className="section-title"><div><h2>Gespeicherte Läufe</h2><p>Aktivieren oder lokal löschen.</p></div><span>{runs.length}</span></div>
          <div className="population-run-list">{runs.map((run) => <article className={run.metadata.active ? "active" : ""} key={run.metadata.id}><button className="population-run-main" onClick={() => onActivate(run.metadata.id)}><strong>{run.metadata.seed}</strong><span>{formatInteger(run.metadata.sampleSize)} Personen · {new Date(run.metadata.createdAt).toLocaleString("de-DE")}</span><small>{run.metadata.id}</small></button><button className="icon-button" aria-label={`Bevölkerungslauf ${run.metadata.seed} löschen`} disabled={run.metadata.active && runs.length === 1} onClick={() => { if (window.confirm("Diesen synthetischen Bevölkerungslauf lokal löschen?")) onDelete(run.metadata.id); }}><Trash2 size={14} /></button></article>)}</div>
        </aside>
      </section>

      <section className="card-flat population-transparency">
        <div><h2>Transparenz und Datenschutz</h2><p>Keine Namen, Adressen, Geburtsdaten, Arbeitgeber oder andere identifizierende Merkmale werden erzeugt. Die Daten sind vollständig synthetisch und dienen ausschließlich der Modellrechnung.</p></div>
        <ul><li><strong>Amtlich beobachtet:</strong> ausgewählte Randverteilungen und Aggregate.</li><li><strong>Modelliert:</strong> gemeinsame Verteilungen, Einkommen, Vermögen, Schulden und Abhängigkeiten.</li><li><strong>Unsicherheit:</strong> Kalibrierung ersetzt keine repräsentative multivariate Mikrodatenbasis.</li></ul>
        <div className="population-source-actions"><button className="button secondary small" onClick={() => onOpenSource("source-population-destatis")}>Bevölkerung</button><button className="button secondary small" onClick={() => onOpenSource("source-population-microcensus")}>Mikrozensus</button><button className="button secondary small" onClick={() => onOpenSource("source-population-phf")}>PHF Vermögen</button><button className="button secondary small" onClick={() => onOpenSource("source-population-model")}>Modellkern</button></div>
      </section>
    </main>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function StatusBadge({ status, compact = false }: { status: "innerhalb-toleranz" | "warnung"; compact?: boolean }) { return <span className={`population-status ${status} ${compact ? "compact" : ""}`}>{status === "innerhalb-toleranz" ? <CheckCircle2 size={compact ? 11 : 13} /> : <AlertTriangle size={compact ? 11 : 13} />}{status === "innerhalb-toleranz" ? "innerhalb Toleranz" : "Warnung"}</span>; }
function formatInteger(value?: number) { return value == null ? "–" : Math.round(value).toLocaleString("de-DE"); }
function formatMillion(value?: number) { return value == null ? "–" : `${(value / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mio.`; }
function formatPercent(value: number) { return value.toLocaleString("de-DE", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function formatSignedPercent(value: number) { return `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toLocaleString("de-DE", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function labelFor(value: string) { return ({ alleinlebend: "Alleinlebend", "paar-ohne-kinder": "Paar ohne Kinder", "paar-mit-kindern": "Paar mit Kindern", alleinerziehend: "Alleinerziehend", mehrpersonen: "Mehrpersonenhaushalt", rentnerhaushalt: "Rentnerhaushalt", erwerbstaetig: "Erwerbstätig", arbeitslos: "Arbeitslos", rente: "Rente", bildung: "Bildung", "nicht-erwerbstaetig": "Nicht erwerbstätig", grossstadt: "Großstadt", staedtisch: "Städtisch", laendlich: "Ländlich", miete: "Miete", eigentum: "Eigentum" } as Record<string, string>)[value] ?? (value.match(/^\d+$/) ? `Dezil ${value}` : value); }
