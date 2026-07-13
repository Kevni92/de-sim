import { ChevronLeft, Info } from "lucide-react";
import { statutoryIncomeTax2026 } from "../lib/income-tax";
import { fmtBn } from "../lib/sim-data";
import type { IncomeTaxSettings } from "../lib/types";

export function ComparisonPage({
  settings,
  revenue,
  onBack,
  onOpenSource,
}: {
  settings: IncomeTaxSettings;
  revenue: number;
  onBack: () => void;
  onOpenSource: (metricId: string, value?: string) => void;
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
  return (
    <main className="content-width comparison-page">
      <header className="detail-header">
        <div>
          <button className="back-link" onClick={onBack}><ChevronLeft size={14} /> Zurück zum Dashboard</button>
          <h1>Szenariovergleich</h1>
          <p>Neutraler Nebeneinander-Vergleich. Nicht berechnete Wirkungen werden nicht durch Demonstrationswerte ersetzt.</p>
        </div>
        <button className="source-badge" onClick={() => onOpenSource("metric-income-tax-revenue", fmtBn(revenue))}><Info size={10} /> Nachweis</button>
      </header>
      <section className="card-flat compare-table">
        <div className="compare-row compare-head"><strong>Kennzahl</strong><ColumnHead title="Status quo" note="§ 32a EStG 2026" /><ColumnHead title="Szenario A" note="deine Einstellungen" active /><ColumnHead title="Szenario B" note="Vergleichsannahme" /></div>
        {rows.map((row) => <div className="compare-row" key={row[0]}><strong>{row[0]}</strong><span>{row[1]}</span><span className={row[1] !== row[2] ? "changed" : ""}>{row[2]}</span><span className={row[1] !== row[3] ? "changed-alt" : ""}>{row[3]}</span></div>)}
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
