import { ChevronRight, Info } from "lucide-react";
import { deciles, fmtBn, households } from "../lib/sim-data";
import type { IncomeTaxSettings, ModelLevel } from "../lib/types";

export function IncomeTaxPage({
  settings,
  modelLevel,
  revenue,
  delta,
  onSettings,
  onModelLevel,
  onBack,
  onApply,
  onOpenSource,
}: {
  settings: IncomeTaxSettings;
  modelLevel: ModelLevel;
  revenue: number;
  delta: number;
  onSettings: (next: IncomeTaxSettings) => void;
  onModelLevel: (level: ModelLevel) => void;
  onBack: () => void;
  onApply: () => void;
  onOpenSource: (metricId: string, value?: string) => void;
}) {
  const update = <K extends keyof IncomeTaxSettings>(key: K, value: IncomeTaxSettings[K]) => onSettings({ ...settings, [key]: value });
  return (
    <main className="content-width detail-page">
      <nav className="breadcrumb"><button onClick={onBack}>Dashboard</button><ChevronRight size={12} /><span>Einkommensteuer</span></nav>
      <header className="detail-header">
        <div><h1>Einkommensteuer</h1><p>Tarif, Freibeträge und Splitting anpassen. Ergebnisse aktualisieren sich live.</p></div>
        <div><button className="button secondary" onClick={() => onOpenSource("metric-income-tax-revenue", fmtBn(revenue))}>Annahmen und Quellen</button><button className="button primary" onClick={onApply}>Übernehmen</button></div>
      </header>

      <div className="detail-layout">
        <section className="card-flat parameter-panel">
          <header><h2>Parameter</h2></header>
          <NumberSlider label="Grundfreibetrag" value={settings.allowance} baseline={11_784} min={0} max={20_000} step={100} unit="€ / Jahr" onChange={(value) => update("allowance", value)} />
          <NumberSlider label="Eingangssteuersatz" value={settings.entryRate} baseline={14} min={0} max={30} step={0.5} unit="%" onChange={(value) => update("entryRate", value)} />
          <NumberSlider label="Spitzensteuersatz" value={settings.topRate} baseline={42} min={30} max={60} step={0.5} unit="%" onChange={(value) => update("topRate", value)} />
          <NumberSlider label="Schwelle Spitzensteuersatz" value={settings.topThreshold} baseline={66_761} min={40_000} max={150_000} step={500} unit="€ / Jahr" onChange={(value) => update("topThreshold", value)} />
          <NumberSlider label="Reichensteuersatz" value={settings.richRate} baseline={45} min={30} max={65} step={0.5} unit="%" onChange={(value) => update("richRate", value)} />
          <NumberSlider label="Kinderfreibetrag" value={settings.childAllowance} baseline={6_384} min={0} max={12_000} step={100} unit="€ / Jahr" onChange={(value) => update("childAllowance", value)} />
          <div className="switch-row"><div><strong>Ehegattensplitting</strong><small>Baseline: aktiviert</small></div><button role="switch" aria-checked={settings.spouseSplitting} className={`switch ${settings.spouseSplitting ? "active" : ""}`} onClick={() => update("spouseSplitting", !settings.spouseSplitting)}><span /></button></div>
        </section>

        <section className="detail-results">
          <div className="card-flat model-card">
            <div className="model-head"><div><h2>Modellstufe</h2><p>bestimmt, wie stark Verhaltensreaktionen berücksichtigt werden</p></div><div className="segment-control">{(["statisch", "verhalten", "langfrist"] as ModelLevel[]).map((level) => <button key={level} className={modelLevel === level ? "active" : ""} onClick={() => onModelLevel(level)}>{level === "statisch" ? "statisch" : level === "verhalten" ? "mit Verhaltenseffekt" : "Langfristszenario"}</button>)}</div></div>
            <div className="detail-kpis">
              <MiniKpi label="Steueraufkommen" value={fmtBn(revenue)} delta={`${delta >= 0 ? "+" : "−"}${Math.abs(delta).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mrd. €`} tone={delta >= 0 ? "positive" : "negative"} hint="Bandbreite ± 25 %" onSource={() => onOpenSource("metric-income-tax-revenue", fmtBn(revenue))} />
              <MiniKpi label="Gewinner" value="24,3 Mio." delta="Haushalte" tone="positive" onSource={() => onOpenSource("metric-income-tax-distribution", "24,3 Mio. Haushalte")} />
              <MiniKpi label="Verlierer" value="3,1 Mio." delta="Haushalte" tone="negative" onSource={() => onOpenSource("metric-income-tax-distribution", "3,1 Mio. Haushalte")} />
              <MiniKpi label="Median-Wirkung" value="+22 € / Monat" delta="Median" tone="neutral" onSource={() => onOpenSource("metric-income-tax-distribution", "+22 € / Monat")} />
            </div>
          </div>

          <section className="card-flat chart-card">
            <header><div><h2>Tarifkurve</h2><p>Grenzsteuersatz nach zu versteuerndem Einkommen</p></div><button className="source-badge" onClick={() => onOpenSource("metric-income-tax-tariff", `${settings.entryRate.toLocaleString("de-DE")}–${settings.richRate.toLocaleString("de-DE")} %`)}><Info size={10} /> Quelle</button></header>
            <TariffChart settings={settings} />
            <div className="chart-legend"><span><i className="baseline" /> Status quo</span><span><i className="reform" /> Reform</span><span><i className="band" /> Unsicherheitsband</span></div>
          </section>

          <section className="card-flat chart-card">
            <header><div><h2>Verteilung nach Einkommensdezilen</h2><p>Monatliche Nettowirkung des Reformszenarios</p></div><button className="source-badge" onClick={() => onOpenSource("metric-income-tax-distribution", "D1 bis D10")}><Info size={10} /> Quelle</button></header>
            <div className="distribution-bars compact">{deciles.map((item) => <div key={item.d}><span>{item.d}</span><i><b className={item.reform >= 0 ? "positive" : "negative"} style={{ left: item.reform >= 0 ? "50%" : `${50 - Math.abs(item.reform) / 120 * 50}%`, width: `${Math.abs(item.reform) / 120 * 50}%` }} /></i><em className={item.reform >= 0 ? "positive" : "negative"}>{item.reform >= 0 ? "+" : "−"}{Math.abs(item.reform)} €</em></div>)}</div>
          </section>

          <section className="card-flat chart-card">
            <header><div><h2>Beispielhaushalte</h2><p>Klare Alltagssprache statt technischer Vorzeichen</p></div><button className="source-badge" onClick={() => onOpenSource("metric-household-examples", "+22 € / Monat (Median)")}><Info size={10} /> Quelle</button></header>
            <div className="household-grid compact">{households.map((household) => <article className="household-card" key={household.name}><div><strong>{household.name}</strong><small>{household.income}</small></div><em className={household.delta >= 0 ? "positive" : "negative"}>{household.delta >= 0 ? "+" : "−"}{Math.abs(household.delta)} € / Monat</em><p>Du hast ungefähr {Math.abs(household.delta)} € {household.delta >= 0 ? "mehr" : "weniger"} im Monat, weil {household.reason}.</p></article>)}</div>
          </section>
        </section>
      </div>
    </main>
  );
}

function NumberSlider({ label, value, baseline, min, max, step, unit, onChange }: { label: string; value: number; baseline: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void }) {
  return <div className="slider-row"><div className="slider-label"><strong>{label}</strong><small>Baseline: {baseline.toLocaleString("de-DE")} {unit}</small></div><div className="slider-inputs"><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /><label><input aria-label={`${label} Wert`} type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /><span>{unit}</span></label></div></div>;
}

function MiniKpi({ label, value, delta, tone, hint, onSource }: { label: string; value: string; delta: string; tone: string; hint?: string; onSource: () => void }) {
  return <article className="mini-kpi"><div className="mini-kpi-head"><span>{label}</span><button className="plain-icon" aria-label={`Quelle für ${label}`} onClick={onSource}><Info size={11} /></button></div><strong>{value}</strong><em className={tone}>{delta}</em>{hint && <small>{hint}</small>}</article>;
}

function TariffChart({ settings }: { settings: IncomeTaxSettings }) {
  const points = Array.from({ length: 21 }, (_, index) => {
    const income = index * 10_000;
    let rate = 0;
    if (income > settings.allowance) rate = settings.entryRate + (Math.min(income, settings.topThreshold) - settings.allowance) / Math.max(1, settings.topThreshold - settings.allowance) * (settings.topRate - settings.entryRate);
    if (income > settings.topThreshold) rate = settings.topRate;
    if (income > 180_000) rate = settings.richRate;
    return { income, rate: Math.max(0, Math.min(65, rate)) };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${30 + point.income / 200_000 * 650} ${235 - point.rate / 65 * 190}`).join(" ");
  return <svg className="tariff-chart" viewBox="0 0 720 270" role="img" aria-label="Tarifkurve der Einkommensteuer"><rect x="30" y="35" width="650" height="200" className="uncertainty-band" /><line x1="30" x2="680" y1="235" y2="235" /><line x1="30" x2="30" y1="35" y2="235" /><path className="baseline-line" d="M 30 235 L 68 235 L 140 188 L 250 135 L 410 112 L 620 102 L 680 102" /><path className="reform-line" d={path} />{[0, 50, 100, 150, 200].map((value) => <text key={value} x={30 + value / 200 * 650} y="255" textAnchor="middle">{value}k</text>)}{[0, 20, 40, 60].map((value) => <text key={value} x="22" y={235 - value / 65 * 190 + 4} textAnchor="end">{value}%</text>)}</svg>;
}
