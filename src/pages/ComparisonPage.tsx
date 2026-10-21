import { ChevronLeft, ExternalLink, Info } from "lucide-react";
import { statutoryIncomeTax2026 } from "../lib/income-tax";
import type { BudgetSummary } from "../lib/budget-summary";
import type { ScenarioEffectSummary } from "../lib/reform-effects";
import { calculationFreshnessLabel, modelLevelLabel, type CalculationFreshness } from "../lib/scenario-calculation";
import { fmtBn } from "../lib/sim-data";
import type { IncomeTaxSettings, ModelLevel } from "../lib/types";

const fmtEffect = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Mrd. €`;

export function ComparisonPage({
  settings,
  modelLevel,
  budgetSummary,
  revenue,
  directFiscalDelta,
  effectSummary,
  effectStatus,
  effectError,
  onBack,
  onOpenSource,
  onOpenAdvancedEffects,
  onOpenLongTerm,
}: {
  settings: IncomeTaxSettings;
  modelLevel: ModelLevel;
  budgetSummary: BudgetSummary;
  revenue: number;
  directFiscalDelta: number;
  effectSummary: ScenarioEffectSummary;
  effectStatus: CalculationFreshness;
  effectError: string;
  onBack: () => void;
  onOpenSource: (metricId: string, value?: string) => void;
  onOpenAdvancedEffects: () => void;
  onOpenLongTerm: () => void;
}) {
  const showEffect = (value: number) => effectStatus === "current" ? fmtEffect(value) : effectStatus === "updating" ? "Wird aktualisiert" : "Nicht aktuell";
  const compareValue = (value: number | null) => value === null ? "Nicht vollständig" : fmtBn(value);
  const unavailableModules = [...budgetSummary.missingRevenueModules, ...budgetSummary.missingExpenseModules];
  const rows = [
    { id: "revenue", label: "Einnahmen · ausgewiesene Posten", baseline: fmtBn(budgetSummary.revenueBaseline), current: compareValue(budgetSummary.revenueTotal), alternative: "Nicht vergleichbar" },
    { id: "expense", label: "Ausgaben · ausgewiesene Posten", baseline: fmtBn(budgetSummary.expenseBaseline), current: compareValue(budgetSummary.expenseTotal), alternative: "Nicht vergleichbar" },
    { id: "balance", label: "Saldo · ausgewiesene Posten", baseline: fmtBn(budgetSummary.balanceBaseline), current: compareValue(budgetSummary.balance), alternative: "Nicht vergleichbar" },
    { id: "gini", label: "Gini-Koeffizient", baseline: "noch nicht berechnet", current: "noch nicht berechnet", alternative: "noch nicht berechnet" },
    { id: "poverty", label: "Armutsrisikoquote", baseline: "noch nicht berechnet", current: "noch nicht berechnet", alternative: "noch nicht berechnet" },
    { id: "income-tax", label: "Einkommensteuer-Aufkommen", baseline: "358,2 Mrd. €", current: fmtBn(revenue), alternative: "nicht berechnet" },
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
  const effectRows: Array<{ label: string; note: string; baseline: string; current: string; alternative: string; currentNote?: string }> = [
    { label: "Direkte fiskalische Wirkung", note: "unmittelbarer Budgeteffekt ohne zusätzliche Wirkungskette", currentNote: "aus den aktuellen Modulwerten", baseline: "±0,0 Mrd. €", current: fmtEffect(directFiscalDelta), alternative: "nicht berechnet" },
    { label: "Kurzfristige mögliche Reaktionen", note: "indirekte Pfade; keine sichere Prognose", baseline: "±0,0 Mrd. €", current: showEffect(effectSummary.shortTerm), alternative: "nicht berechnet" },
    { label: "Fiskalische Rückkopplungen", note: "getrennt vom direkten Budgetsaldo", baseline: "±0,0 Mrd. €", current: showEffect(effectSummary.feedback), alternative: "nicht berechnet" },
    { label: "Langfristige Szenariopfade", note: "nur innerhalb der zentralen Modellstufe und des Zeithorizonts", baseline: "±0,0 Mrd. €", current: showEffect(effectSummary.longTerm), alternative: "nicht berechnet" },
    { label: "Nicht monetäre Wirkungen", note: "natürliche Einheiten werden nicht in Euro umgerechnet", baseline: "keine", current: effectStatus === "current" ? naturalUnits : showEffect(0), alternative: "nicht berechnet" },
    { label: "Nur gerichtete Wirkungen", note: "Richtung sichtbar, aber kein Punktwert", baseline: "0 Pfade", current: effectStatus === "current" ? `${effectSummary.directionalCount} Pfad${effectSummary.directionalCount === 1 ? "" : "e"}` : showEffect(0), alternative: "nicht berechnet" },
    { label: "Nicht ausreichend belegt", note: "bewusst ohne scheinpräzisen Punktwert", baseline: "0 Pfade", current: effectStatus === "current" ? `${effectSummary.unavailableCount} Pfad${effectSummary.unavailableCount === 1 ? "" : "e"}` : showEffect(0), alternative: "nicht berechnet" },
  ];

  return (
    <main className="content-width comparison-page">
      <header className="detail-header">
        <div>
          <button className="back-link" onClick={onBack}><ChevronLeft size={14} /> Zurück zum Dashboard</button>
          <h1>Szenariovergleich</h1>
          <p>Die Summen übernehmen die in der Übersicht ausgewiesenen Posten. Direkte Wirkung und modellierte Reaktionen bleiben darunter getrennt.</p>
        </div>
        <button className="source-badge" onClick={() => onOpenSource("metric-income-tax-revenue", fmtBn(revenue))}><Info size={10} /> Nachweis</button>
      </header>
      <p className="notice-box comparison-status-note" role="note">
        Szenario A verbindet die ausgewiesenen Budgetposten mit den aktiven Einstellungen; je nach Kennzahl gelten Regelberechnungen oder Modellannahmen. Szenario B ist eine feste Einkommensteuer-Annahme ohne vollständigen Modullauf. Gini, Armutsrisiko und regionale Wirkungen sind noch nicht berechnet. Eine amtliche Tarifgrundlage bestätigt keine abgeleiteten Modellwirkungen.
      </p>
      <section className="card-flat compare-table" role="region" aria-label="Haushaltskennzahlen im Vergleich" tabIndex={0}>
        <div className="compare-row compare-head"><strong>Kennzahl</strong><ColumnHead title="Status quo" note="wie in der Übersicht" /><ColumnHead title="Szenario A" note={`Übersicht · ${modelLevelLabel(modelLevel)}`} active /><ColumnHead title="Szenario B" note="feste ESt-Annahme · kein Modullauf" /></div>
        {rows.map((row) => <div className="compare-row" data-testid={`comparison-${row.id}`} key={row.id}><strong>{row.label}</strong><span>{row.baseline}</span><span data-testid="scenario-a-value" className={row.baseline !== row.current ? "changed" : ""}>{budgetSummary.isComplete || !["revenue", "expense", "balance"].includes(row.id) ? row.current : "Nicht vollständig"}</span><span className="not-comparable">{row.alternative}</span></div>)}
      </section>
      <p className="comparison-scope-note" role="note">
        {budgetSummary.isComplete
          ? `Szenario A entspricht den Summen der Übersicht bei der Modellstufe „${modelLevelLabel(modelLevel)}“. Gezählt werden die dort ausgewiesenen Posten; das ist keine vollständige Haushaltsrechnung. Die feste Vergleichsannahme Szenario B hat keinen vollständigen Modullauf und wird deshalb bei Gesamtsummen nicht als vergleichbar dargestellt.`
          : `Die Gesamtsummen sind unvollständig${unavailableModules.length ? ` · fehlend: ${unavailableModules.join(", ")}` : ""}. Fehlende Teilwerte werden nicht als null gerechnet. Die feste Vergleichsannahme Szenario B hat keinen vollständigen Modullauf.`}
      </p>

      <section className="effects-context-comparison" data-testid="effect-level-comparison" data-status={effectStatus}>
        <header><h2>Wirkungsebenen getrennt vergleichen</h2><p>{effectSummary.activeContextCount} geänderte Reformmodule mit expliziter Wirkungszuordnung · {currentNote}</p></header>
        <div className="effect-compare-grid">
          <div className="effect-compare-head">Wirkungsebene</div><div className="effect-compare-head">Status quo</div><div className="effect-compare-head active-column">Szenario A</div><div className="effect-compare-head">Szenario B</div>
          {effectRows.flatMap((row) => [
            <div className="effect-compare-label" key={`${row.label}-label`}><strong>{row.label}</strong><small>{row.note}</small></div>,
            <div className="effect-compare-value" key={`${row.label}-baseline`}><strong>{row.baseline}</strong></div>,
            <div className="effect-compare-value active-column" key={`${row.label}-current`}><strong>{row.current}</strong><small>{row.currentNote ?? currentNote}</small></div>,
            <div className="effect-compare-value" key={`${row.label}-alternative`}><strong>{row.alternative}</strong><small>keine passende Wirkungsrechnung hinterlegt</small></div>,
          ])}
        </div>
        <button className="button secondary small" type="button" onClick={onOpenAdvancedEffects}>Vollständige Wirkungsmodelle prüfen <ExternalLink size={13} /></button>
      </section>

      <section className="long-term-entry card-flat" aria-labelledby="long-term-entry-title">
        <div>
          <span className="eyebrow">Szenariovergleich</span>
          <h2 id="long-term-entry-title">Langfristige Entwicklung</h2>
          <p>Bevölkerung, Erwerbspotenzial und Alterssicherung bis 2030, 2040, 2050 oder 2070 in einer gemeinsamen, vereinfachten Szenarioansicht vergleichen.</p>
        </div>
        <button className="button primary" type="button" onClick={onOpenLongTerm}>Langfristansicht öffnen <ExternalLink size={13} /></button>
      </section>

      <section className="comparison-policies">
        <h2>Zentrale Politikeinstellungen</h2><p>Gesetzliche Baseline 2026, aktives Szenario und eine alternative Parameterauswahl.</p>
        <div className="card-flat compare-table" role="region" aria-label="Zentrale Politikeinstellungen im Vergleich" tabIndex={0}>{policies.map((row) => <div className="compare-row" key={row[0]}><strong>{row[0]}</strong><span>{row[1]}</span><span className={row[1] !== row[2] ? "changed" : ""}>{row[2]}</span><span className={row[1] !== row[3] ? "changed-alt" : ""}>{row[3]}</span></div>)}</div>
      </section>
    </main>
  );
}

function ColumnHead({ title, note, active = false }: { title: string; note: string; active?: boolean }) {
  return <span className={active ? "active-column" : ""}><strong>{title}</strong><small>{note}</small></span>;
}
