import { ChevronLeft, Info } from "lucide-react";
import { useMemo } from "react";
import {
  applyPreset,
  calculateLabourPath,
  calculatePensionPath,
  defaultProjectionInput,
  projectDemography,
  type PensionPath,
  type ProjectionYear,
} from "../lib/long-term-scenario";
import type { LongTermScenarioSettings } from "../lib/types";

const targetYears = [2030, 2040, 2050, 2070];
const number = (value: number) => Math.round(value).toLocaleString("de-DE");
const million = (value: number) => `${(value / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mio.`;
const billion = (value: number) => `${value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mrd. €`;
const signed = (value: number, unit = "") => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toLocaleString("de-DE", { maximumFractionDigits: 1 })}${unit}`;

function pathFor(population: ProjectionYear[], settings: LongTermScenarioSettings) {
  const labour = calculateLabourPath({
    population,
    retirementAge: settings.retirementAge,
    participationRatePct: settings.participationRatePct,
    employmentRatePct: settings.employmentRatePct,
    workTimeFactorPct: settings.workTimeFactorPct,
    contributionRatePct: settings.contributionRatePct,
    averageAnnualWage: settings.averageAnnualWage,
    populationIncludesMigration: false,
    sourceIds: ["source-population-model"],
  });
  const pension = calculatePensionPath({
    population,
    labour,
    retirementAge: settings.retirementAge,
    pensionerRatePct: 82,
    contributionRatePct: settings.contributionRatePct,
    pensionBenefitRatePct: settings.pensionBenefitRatePct,
    averageAnnualWage: settings.averageAnnualWage,
    pensionIndexationPct: 1.5,
    otherContributionBn: 28,
    federalGrantBn: settings.federalGrantBn,
    otherRevenueBn: 4,
    administrationExpensesBn: 8,
    sourceIds: ["source-population-model"],
  });
  return { labour, pension };
}

function findYear<T extends { year: number }>(path: T[], year: number) {
  return path.find((point) => point.year === year) ?? path.at(-1)!;
}

export function LongTermPage({ settings, onTargetYear, onBack, onOpenSource }: {
  settings: LongTermScenarioSettings;
  onTargetYear: (targetYear: number) => void;
  onBack: () => void;
  onOpenSource: (metricId: string, value?: string) => void;
}) {
  const model = useMemo(() => {
    const input = defaultProjectionInput("langfristansicht", settings.targetYear);
    input.workingAgeStart = settings.workingAgeStart;
    input.retirementAge = settings.retirementAge;
    const scenarioInput = applyPreset(input, settings);
    scenarioInput.workingAgeStart = settings.workingAgeStart;
    scenarioInput.retirementAge = settings.retirementAge;
    const projection = projectDemography(scenarioInput);
    return {
      projection,
      baseline: pathFor(projection.baseline, settings),
      scenario: pathFor(projection.scenario, settings),
    };
  }, [settings]);

  const basePopulation = findYear(model.projection.baseline, settings.targetYear);
  const scenarioPopulation = findYear(model.projection.scenario, settings.targetYear);
  const baseLabour = findYear(model.baseline.labour.points, settings.targetYear);
  const scenarioLabour = findYear(model.scenario.labour.points, settings.targetYear);
  const basePension = findYear(model.baseline.pension.points, settings.targetYear);
  const scenarioPension = findYear(model.scenario.pension.points, settings.targetYear);
  const lowerPension = findYear(model.scenario.pension.lower, settings.targetYear);
  const upperPension = findYear(model.scenario.pension.upper, settings.targetYear);
  const populationDifference = scenarioPopulation.population - basePopulation.population;
  const workforceDifference = scenarioLabour.availableWorkers - baseLabour.availableWorkers;
  const causeNote = settings.preset === "niedrigere-nettozuwanderung" || settings.preset === "hoehere-nettozuwanderung"
    ? "Die ausgewählte Nettozuwanderung verändert den Bevölkerungspfad; Berechtigung und Beschäftigung werden in dieser Standardansicht nicht gleichgesetzt."
    : "Die Zeitreihe verbindet Kohorten, Erwerbsbeteiligung und Alterssicherung. Alle Werte sind vereinfachte Wenn-Dann-Szenarien, keine sichere Vorhersage.";

  const rows = [
    ["Bevölkerung", million(basePopulation.population), million(scenarioPopulation.population), signed(populationDifference / 1_000_000, " Mio.")],
    ["Erwerbspersonen", million(baseLabour.availableWorkers), million(scenarioLabour.availableWorkers), signed(workforceDifference / 1_000_000, " Mio.")],
    ["Beitragszahlende je 100 Rentenbeziehende", scenarioPension.contributorsPer100Pensioners.toLocaleString("de-DE", { maximumFractionDigits: 1 }), lowerPension.contributorsPer100Pensioners.toLocaleString("de-DE", { maximumFractionDigits: 1 }), upperPension.contributorsPer100Pensioners.toLocaleString("de-DE", { maximumFractionDigits: 1 })],
    ["Finanzierungssaldo", billion(basePension.balanceBn), billion(scenarioPension.balanceBn), `${billion(lowerPension.balanceBn)} bis ${billion(upperPension.balanceBn)}`],
  ];

  return (
    <main className="content-width long-term-page" data-testid="long-term-page">
      <header className="detail-header long-term-header">
        <div>
          <button className="back-link" onClick={onBack}><ChevronLeft size={14} /> Zurück zum Szenariovergleich</button>
          <span className="eyebrow">Langfristige Entwicklung</span>
          <h1>Warum verändern sich Bevölkerung, Arbeitskräfte und Alterssicherung?</h1>
          <p>Eine gemeinsame Standardansicht für Demografie, Erwerbspotenzial und vereinfachte Rentenindikatoren. Direkte Haushaltswirkungen und spätere Szenariopfadwerte bleiben getrennt.</p>
        </div>
        <div className="long-term-controls">
          <label htmlFor="long-term-target-year">Zieljahr</label>
          <select id="long-term-target-year" value={settings.targetYear} onChange={(event) => onTargetYear(Number(event.target.value))}>
            {targetYears.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <button className="source-badge" type="button" onClick={() => onOpenSource("source-population-destatis")}><Info size={10} /> Daten- und Modellstand</button>
        </div>
      </header>

      <section className="long-term-kpis" aria-label="Vier Kernkennzahlen">
        <Metric label="Bevölkerung" value={million(scenarioPopulation.population)} note={`Baseline ${million(basePopulation.population)}`} delta={signed(populationDifference / 1_000_000, " Mio.")} />
        <Metric label="Erwartete Erwerbspersonen" value={million(scenarioLabour.availableWorkers)} note="Erwerbsbeteiligung, nicht nur Altersgruppe" delta={signed(workforceDifference / 1_000_000, " Mio.")} />
        <Metric label="Beitragszahlende je 100 Rentenbeziehende" value={scenarioPension.contributorsPer100Pensioners.toLocaleString("de-DE", { maximumFractionDigits: 1 })} note="Strukturindikator, keine Finanzrechnung" delta={signed(scenarioPension.contributorsPer100Pensioners - basePension.contributorsPer100Pensioners)} />
        <Metric label="Vereinfachter Finanzierungssaldo" value={billion(scenarioPension.balanceBn)} note={`Baseline ${billion(basePension.balanceBn)}`} delta={signed(scenarioPension.balanceBn - basePension.balanceBn, " Mrd. €")} />
      </section>

      <p className="long-term-summary"><strong>Einordnung für {settings.targetYear}:</strong> {causeNote} Der Unterschied zur Baseline beträgt {signed(populationDifference / 1_000_000, " Mio. Menschen")} bei der Bevölkerung und {signed(workforceDifference / 1_000_000, " Mio. Erwerbspersonen")} bei den Erwerbspersonen.</p>

      <section className="long-term-section" aria-labelledby="long-term-comparison-title">
        <div className="section-heading"><div><span className="eyebrow">Ebene 1 · Was verändert sich?</span><h2 id="long-term-comparison-title">Baseline und Szenario im Zieljahr</h2></div><span className="status-chip">Zentralpfad · Datenjahr 2026 · Rechtsstand 2026</span></div>
        <div className="long-term-table-wrap"><table className="long-term-table"><caption className="sr-only">Vergleich der zentralen Langfristkennzahlen im Jahr {settings.targetYear}</caption><thead><tr><th scope="col">Kennzahl</th><th scope="col">Baseline</th><th scope="col">Szenario</th><th scope="col">Unsicherheitsband / Abweichung</th></tr></thead><tbody>{rows.map((row) => <tr key={row[0]}><th scope="row">{row[0]}</th><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td></tr>)}</tbody></table></div>
      </section>

      <div className="long-term-detail-grid">
        <section className="long-term-section" aria-labelledby="long-term-causes-title"><div className="section-heading"><div><span className="eyebrow">Ebene 2 · Warum verändert es sich?</span><h2 id="long-term-causes-title">Ursachen getrennt lesen</h2></div></div><ul className="long-term-cause-list"><li><strong>Geburten und Sterbefälle</strong><span>{number(scenarioPopulation.births)} Geburten und {number(scenarioPopulation.deaths)} Sterbefälle im Zieljahr.</span></li><li><strong>Zu- und Fortzüge</strong><span>Saldo {number(scenarioPopulation.migrationBalance)} Personen; Schutzstatus und Zugang sind keine Beschäftigungsgarantie.</span></li><li><strong>Arbeitsmarktzugang und Beteiligung</strong><span>{number(scenarioLabour.availableWorkers)} verfügbare Erwerbspersonen, davon {number(scenarioLabour.employed)} Beschäftigte und {number(scenarioLabour.contributors)} Beitragszahlende.</span></li><li><strong>Rentenalter und Leistungsniveau</strong><span>Rentenalter {settings.retirementAge}, geschätzte Rentenbeziehende {number(scenarioPension.pensioners)}; ältere Bevölkerung wird nicht gleichgesetzt.</span></li></ul></section>
        <section className="long-term-section" aria-labelledby="long-term-finance-title"><div className="section-heading"><div><span className="eyebrow">Ebene 2 · Finanzierung</span><h2 id="long-term-finance-title">Alterssicherung getrennt ausweisen</h2></div></div><dl className="long-term-finance-list"><div><dt>Beitragspflichtige Lohnsumme</dt><dd>{billion(scenarioPension.taxableWageBill / 1_000_000_000)}</dd></div><div><dt>Beitragseinnahmen</dt><dd>{billion(scenarioPension.contributionRevenueBn)}</dd></div><div><dt>Bundeszuschuss</dt><dd>{billion(scenarioPension.federalGrantBn)}</dd></div><div><dt>Renten- und Verwaltungsausgaben</dt><dd>{billion(scenarioPension.pensionExpensesBn + scenarioPension.administrationExpensesBn)}</dd></div></dl></section>
      </div>

      <details className="long-term-section long-term-method"><summary><span><span className="eyebrow">Ebene 4 · Berechnung und Quellen</span><strong>Modellgrenzen und Rechenweg anzeigen</strong></span><span>+</span></summary><div className="long-term-method-grid"><div><h3>Rechenweg</h3><p>Kohorten werden jährlich fortgeschrieben. Erwerbspersonen entstehen aus Erwerbsalter, Beteiligung und Beschäftigung; Rentenbeziehende aus der Bevölkerung ab Rentenalter multipliziert mit einer Bezugsquote. Beiträge, Bundeszuschuss und Ausgaben werden separat aggregiert.</p></div><div><h3>Bewusste Modellgrenze</h3><p>Keine individuellen Entgeltpunkte, vollständige Rentenarten oder exakte Rentenanpassungsformel. Ein negativer Saldo ist ein Szenarioindikator und keine Aussage über einen Zahlungsausfall.</p></div></div><ul className="long-term-warning-list">{model.projection.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>

      <section className="long-term-section long-term-data-table" aria-labelledby="long-term-series-title"><div className="section-heading"><div><span className="eyebrow">Ebene 3 · Zeitpfad</span><h2 id="long-term-series-title">Zeitreihe bis zum Zieljahr</h2></div></div><div className="long-term-table-wrap"><table className="long-term-table"><caption className="sr-only">Zeitreihe der zentralen Szenariowerte</caption><thead><tr><th scope="col">Jahr</th><th scope="col">Bevölkerung</th><th scope="col">Erwerbspersonen</th><th scope="col">Beitragszahlende / Rentner</th><th scope="col">Saldo</th></tr></thead><tbody>{model.projection.scenario.filter((_, index) => index === 0 || index === model.projection.scenario.length - 1 || [2030, 2040, 2050].includes(model.projection.scenario[index].year)).map((point) => { const labour = findYear(model.scenario.labour.points, point.year); const pension = findYear(model.scenario.pension.points, point.year); return <tr key={point.year}><th scope="row">{point.year}</th><td>{million(point.population)}</td><td>{million(labour.availableWorkers)}</td><td>{pension.contributorsPer100Pensioners.toLocaleString("de-DE", { maximumFractionDigits: 1 })}</td><td>{billion(pension.balanceBn)}</td></tr>; })}</tbody></table></div><p className="table-note">Die Tabelle ergänzt jede Grafik durch konkrete Werte und bleibt auch bei schmalen Ansichten horizontal lesbar.</p></section>
    </main>
  );
}

function Metric({ label, value, note, delta }: { label: string; value: string; note: string; delta: string }) {
  return <article className="long-term-metric card-flat"><span>{label}</span><strong>{value}</strong><small>{note}</small><em>{delta} zur Baseline</em></article>;
}
