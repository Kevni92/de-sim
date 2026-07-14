import { ChevronLeft, ExternalLink, Info } from "lucide-react";
import { statutoryIncomeTax2026 } from "../lib/income-tax";
import type { ScenarioEffectSummary } from "../lib/reform-effects";
import { calculationFreshnessLabel, type CalculationFreshness } from "../lib/scenario-calculation";
import { fmtBn } from "../lib/sim-data";
import type { IncomeTaxSettings } from "../lib/types";

const fmtEffect = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Mrd. €`;

export function ComparisonPage({
  settings,
  revenue,
  directFiscalDelta,
  effectSummary,
  effectStatus,
  effectError,
  onBack,
  onOpenSource,
  onOpenAdvancedEffects,
}: {
  settings: IncomeTaxSettings;
  revenue: number;
  directFiscalDelta: number;
  effectSummary: ScenarioEffectSummary;
  effectStatus: CalculationFreshness;
  effectError: string;
  onBack: () => void;
  onOpenSource: (metricId: string, value?: string) => void;
  onOpenAdvancedEffects: () => void;
}) {
  const rows = [
    ["Einnahmen", "1.573,9 Mrd. €", fmtBn(1_573.9 + revenue - 358.2), "1.604,7 Mrd. €"],
    ["Ausgaben", "1.612,9 Mrd. €", "1.612,9 Mrd. €", "1.641,2 Mrd. €"],
    ["Saldo", "−39,0 Mrd. €", fmtBn(-39 + revenue - 358.2), "−36,5 Mrd. €"],
    ["Gini-Koeffizient", "noch nicht berechnet", "noch nicht berechnet", "noch nicht berechnet"],
    ["Armutsrisikoquote", "noch nicht berechnet", "noch nicht berechnet", "noch nicht berechnet"],
    ["Einkommensteuer-Aufkommen", "358,2 Mrd. €", fmtBn(revenue), "nicht berechnet"],
  ];
  const policies = [
    ["Grundfreibetrag", `${statutoryIncomeTax2026.allowance.toLocaleString("de-DE")} €`, `${settings.allowance.toLocaleString("de-DE")} €`, "15.000 €"],
    ["Eingangssteuersatz", "14,0 %", `${settings.entryRate.toLocaleString("de-DE")} %`, "14,0 %"],
    ["Spitzensteuersatz", "42,0 %", `${settings.topRate.toLocaleString("de-DE")} %`, "45,0 %"],
    ["Schwelle Spitzensteuersatz", `${statutoryIncomeTax2026.topThreshold.toLocaleString("de-DE")} €`, `${settings.topThreshold.toLocaleString("de-DE")} €`, "62.000 €"],
    ["Reichensteuersatz", "45,0 %", `${settings.richRate.toLocaleString("de-DE")} %`, "48,0 %"],
    ["Kinderfreibetrag", `${statutoryIncomeTax2026.childAllowance.toLocaleString("de-DE")} €`, `${settings.childAllowance.toLocaleString("de-DE")} €`, "10.500 €"],
    ["Ehegattensplitting", "aktiviert", settings.spouseSplitting ? "aktiviert" : "deaktiviert", "deaktiviert"],
  ];
  const currentNote = effectError || calculationFreshnessLabel(effectStatus);
  const naturalUnits = effectSummary.nonMonetaryEffects.length
    ? effectSummary.nonMonetaryEffects.slice(0, 2).map((item) => `${Math.round(item.value).toLocaleString("de-DE")} ${item.unit}`).join(" · ")
    : "keine quantifizierte natürliche Einheit";
  const effectRows = [
    { label: "Direkte fiskalische Wirkung", note: "unmittelbarer Budgeteffekt ohne zusätzliche Wirkungskette", baseline: "±0,0 Mrd. €", current: fmtEffect(directFiscalDelta), alternative: "nicht berechnet" },
    { label: "Kurzfristige mögliche Reaktionen", note: "indirekte Pfade; keine sichere Prognose", baseline: "±0,0 Mrd. €", current: fmtEffect(effectSummary.shortTerm), alternative: "nicht berechnet" },
    { label: "Fiskalische Rückkopplungen", note: "getrennt vom direkten Budgetsaldo", baseline: "±0,0 Mrd. €", current: fmtEffect(effectSummary.feedback), alternative: "nicht berechnet" },
    { label: "Langfristige Szenariopfade", note: "nur innerhalb der zentralen Modellstufe und des Zeithorizonts", baseline: "±0,0 Mrd. €", current: fmtEffect(effectSummary.longTerm), alternative: "nicht berechnet" },
    { label: "Nicht monetäre Wirkungen", note: "natürliche Einheiten werden nicht in Euro umgerechnet", baseline: "keine", current: naturalUnits, alternative: "nicht berechnet" },
    { label: "Nur gerichtete Wirkungen", note: "Richtung sichtbar, aber kein Punktwert", baseline: "0 Pfade", current: `${effectSummary.directionalCount} Pfad${effectSummary.directionalCount === 1 ? "" : "e"}`, alternative: "nicht berechnet" },
    { label: "Nicht ausreichend belegt", note: "bewusst ohne scheinpräzisen Punktwert", baseline: "0 Pfade", current: `${effectSummary.unavailableCount} Pfad${effectSummary.unavailableCount === 1 ? "" : "e"}`, alternative: "nicht berechnet" },
  ];

  return (
    <main className="content-width comparison-page">
      <header className="detail-header">
        <div>
          <button className="back-link" onClick={onBack}><ChevronLeft size={14} /> Zurück zum Dashboard</button>
          <h1>Szenariovergleich</h1>
          <p>Direkte Fiskalwirkung, mögliche Reaktionen, Langfristpfade und natürliche Einheiten werden getrennt verglichen. Eine vermischte „Gesamtwirkung“ wird nicht gebildet.</p>
        </div>
        <button className="source-badge" onClick={() => onOpenSource("metric-income-tax-revenue", fmtBn(revenue))}><Info size={10} /> Nachweis</button>
      </header>
      <section className="card-flat compare-table">
        <div className="compare-row compare-head"><strong>Kennzahl</strong><ColumnHead title="Status quo" note="§ 32a EStG 2026" /><ColumnHead title="Szenario A" note="deine Einstellungen" active /><ColumnHead title="Szenario B" note="Vergleichsannahme" /></div>
        {rows.map((row) => <div className="compare-row" key={row[0]}><strong>{row[0]}</strong><span>{row[1]}</span><span className={row[1] !== row[2] ? "changed" : ""}>{row[2]}</span><span className={row[1] !== row[3] ? "changed-alt" : ""}>{row[3]}</span></div>)}
      </section>

      <section className="effects-context-comparison" data-testid="effect-level-comparison" data-status={effectStatus}>
        <header><h2>Wirkungsebenen getrennt vergleichen</h2><p>{effectSummary.activeContextCount} geänderte Reformmodule mit expliziter Wirkungszuordnung · {currentNote}</p></header>
        <div className="effect-compare-grid">
          <div className="effect-compare-head">Wirkungsebene</div><div className="effect-compare-head">Status quo</div><div className="effect-compare-head active-column">Szenario A</div><div className="effect-compare-head">Szenario B</div>
          {effectRows.flatMap((row) => [
            <div className="effect-compare-label" key={`${row.label}-label`}><strong>{row.label}</strong><small>{row.note}</small></div>,
            <div className="effect-compare-value" key={`${row.label}-baseline`}><strong>{row.baseline}</strong></div>,
            <div className="effect-compare-value active-column" key={`${row.label}-current`}><strong>{row.current}</strong><small>{currentNote}</small></div>,
            <div className="effect-compare-value" key={`${row.label}-alternative`}><strong>{row.alternative}</strong><small>keine passende Wirkungsrechnung hinterlegt</small></div>,
          ])}
        </div>
        <button className="button secondary small" type="button" onClick={onOpenAdvancedEffects}>Vollständige Wirkungsmodelle prüfen <ExternalLink size={13} /></button>
      </section>

      <section className="comparison-policies">
        <h2>Zentrale Politikeinstellungen</h2><p>Gesetzliche Baseline 2026, aktives Szenario und eine alternative Parameterauswahl.</p>
        <div className="card-flat compare-table">{policies.map((row) => <div className="compare-row" key={row[0]}><strong>{row[0]}</strong><span>{row[1]}</span><span className={row[1] !== row[2] ? "changed" : ""}>{row[2]}</span><span className={row[1] !== row[3] ? "changed-alt" : ""}>{row[3]}</span></div>)}</div>
      </section>
    </main>
  );
}

function ColumnHead({ title, note, active = false }: { title: string; note: string; active?: boolean }) {
  return <span className={active ? "active-column" : ""}><strong>{title}</strong><small>{note}</small></span>;
}
