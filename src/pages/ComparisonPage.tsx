import { ChevronLeft, Info } from "lucide-react";
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
  onOpenSource: (sourceId: string, value?: string) => void;
}) {
  const rows = [
    ["Einnahmen", "1.573,9 Mrd. €", fmtBn(1_573.9 + revenue - 358.2), "1.604,7 Mrd. €"],
    ["Ausgaben", "1.612,9 Mrd. €", "1.612,9 Mrd. €", "1.641,2 Mrd. €"],
    ["Saldo", "−39,0 Mrd. €", fmtBn(-39 + revenue - 358.2), "−36,5 Mrd. €"],
    ["Gini-Koeffizient", "0,301", "0,308", "0,289"],
    ["Armutsrisikoquote", "16,7 %", "16,9 %", "16,1 %"],
    ["Median-Wirkung", "±0 €", "+22 € / Monat", "−4 € / Monat"],
  ];
  const policies = [
    ["Grundfreibetrag", "11.784 €", `${settings.allowance.toLocaleString("de-DE")} €`, "12.200 €"],
    ["Eingangssteuersatz", "14,0 %", `${settings.entryRate.toLocaleString("de-DE")} %`, "14,0 %"],
    ["Spitzensteuersatz", "42,0 %", `${settings.topRate.toLocaleString("de-DE")} %`, "45,0 %"],
    ["Schwelle Spitzensteuersatz", "66.761 €", `${settings.topThreshold.toLocaleString("de-DE")} €`, "62.000 €"],
    ["Ehegattensplitting", "aktiviert", settings.spouseSplitting ? "aktiviert" : "deaktiviert", "deaktiviert"],
    ["Vermögensteuer", "nicht erhoben", "nicht erhoben", "1,0 % ab 2 Mio. €"],
  ];
  return (
    <main className="content-width comparison-page">
      <header className="detail-header">
        <div>
          <button className="back-link" onClick={onBack}><ChevronLeft size={14} /> Zurück zum Dashboard</button>
          <h1>Szenariovergleich</h1>
          <p>Neutraler Nebeneinander-Vergleich. Unterschiede werden markiert, aber nicht bewertet.</p>
        </div>
        <button className="source-badge" onClick={() => onOpenSource("source-budget", fmtBn(revenue))}><Info size={10} /> Quelle</button>
      </header>
      <section className="card-flat compare-table">
        <div className="compare-row compare-head"><strong>Kennzahl</strong><ColumnHead title="Status quo" note="Rechtsstand 2026" /><ColumnHead title="Szenario A" note="deine Einstellungen" active /><ColumnHead title="Szenario B" note="höhere Progression" /></div>
        {rows.map((row) => <div className="compare-row" key={row[0]}><strong>{row[0]}</strong><span>{row[1]}</span><span className={row[1] !== row[2] ? "changed" : ""}>{row[2]}</span><span className={row[1] !== row[3] ? "changed-alt" : ""}>{row[3]}</span></div>)}
        <div className="compare-row"><strong>Größte Gewinner</strong><span>—</span><span className="positive">obere Mittelschicht</span><span className="positive">untere Einkommen</span></div>
        <div className="compare-row"><strong>Größte Verlierer</strong><span>—</span><span>keine relevanten Verluste</span><span className="negative">obere Einkommen</span></div>
      </section>
      <section className="comparison-policies">
        <h2>Zentrale Politikeinstellungen</h2><p>Nur wesentliche Parameter, keine Wertung.</p>
        <div className="card-flat compare-table">{policies.map((row) => <div className="compare-row" key={row[0]}><strong>{row[0]}</strong><span>{row[1]}</span><span className={row[1] !== row[2] ? "changed" : ""}>{row[2]}</span><span className={row[1] !== row[3] ? "changed-alt" : ""}>{row[3]}</span></div>)}</div>
      </section>
    </main>
  );
}

function ColumnHead({ title, note, active = false }: { title: string; note: string; active?: boolean }) {
  return <span className={active ? "active-column" : ""}><strong>{title}</strong><small>{note}</small></span>;
}
