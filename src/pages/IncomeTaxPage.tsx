import { Calculator, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { ModuleMetric, ModuleModelLevelCard, ModulePageHeader, ModuleSummaryHeader } from "../components/ModuleDetailComponents";
import {
  calculateReformIncomeTax,
  calculateStatutoryIncomeTax2026,
  statutoryIncomeTax2026,
  type IncomeTaxResult,
} from "../lib/income-tax";
import { revenueModuleDefinitions, type RevenueModuleId, type RevenueModuleResult } from "../lib/revenue-modules";
import { fmtBn, fmtDiff } from "../lib/sim-data";
import type { IncomeTaxSettings, ModelLevel } from "../lib/types";

export function IncomeTaxPage({
  settings,
  modelLevel,
  result,
  revenueResults,
  onSettings,
  onModelLevel,
  onNavigateRevenue,
  onBack,
  onOpenSource,
}: {
  settings: IncomeTaxSettings;
  modelLevel: ModelLevel;
  result: IncomeTaxResult;
  revenueResults: RevenueModuleResult[];
  onSettings: (next: IncomeTaxSettings) => void;
  onModelLevel: (level: ModelLevel) => void;
  onNavigateRevenue: (id: RevenueModuleId) => void;
  onBack: () => void;
  onOpenSource: (metricId: string, value?: string) => void;
}) {
  const update = <K extends keyof IncomeTaxSettings>(key: K, value: IncomeTaxSettings[K]) => onSettings({ ...settings, [key]: value });

  return (
    <main className="content-width revenue-modules-page income-tax-page">
      <ModulePageHeader
        eyebrow="Milestone 4 · Einkommensteuer"
        title="Steuern und Sozialbeiträge"
        description="Acht getrennte Module mit einheitlichem Aufbau für Baseline, Szenario, Erstwirkung, Modellstufe und Nachweise."
        onBack={onBack}
      />

      <section className="revenue-module-layout">
        <aside className="card-flat revenue-module-list" aria-label="Einnahmemodule">
          <header><h2>Module</h2><span>{revenueResults.length + 1}</span></header>
          <nav>
            <button className="active" aria-current="page">
              <span><strong>Einkommensteuer</strong><small>§ 32a EStG · gesetzlicher Tarif 2026</small></span>
              <span className="module-list-value"><b>{fmtBn(result.value)}</b><em className={result.delta >= 0 ? "positive" : "negative"}>{fmtDiff(result.delta)}</em></span>
            </button>
            {revenueModuleDefinitions.map((module) => {
              const moduleResult = revenueResults.find((item) => item.id === module.id)!;
              return (
                <button key={module.id} onClick={() => onNavigateRevenue(module.id)}>
                  <span><strong>{module.label}</strong><small>{module.id === "verm" ? "Hypothetisches Szenario · Baseline 0" : module.legalBasis}</small></span>
                  <span className="module-list-value"><b>{fmtBn(moduleResult.value)}</b><em className={moduleResult.delta >= 0 ? "positive" : "negative"}>{fmtDiff(moduleResult.delta)}</em></span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="revenue-module-content">
          <section className="card-flat revenue-module-summary income-tax-summary">
            <ModuleSummaryHeader
              badge="Gesetzliche Baseline 2026"
              badgeTone="hoch"
              title="Einkommensteuer"
              description="Gesetzlichen Tarif 2026 mit einem transparenten Reformszenario vergleichen. Die tarifliche Steuer wird auf Basis des zu versteuernden Einkommens berechnet."
              onOpenSource={() => onOpenSource("metric-income-tax-revenue", fmtBn(result.value))}
              onReset={() => onSettings({ ...statutoryIncomeTax2026 })}
            />
            <div className="revenue-kpi-grid">
              <ModuleMetric label="Baseline" value={fmtBn(result.baselineValue)} note="Gesetzlicher Tarif 2026 · § 32a EStG" />
              <ModuleMetric label="Szenariowert" value={fmtBn(result.value)} note={`${fmtDiff(result.delta)} gegenüber Baseline`} tone={result.delta >= 0 ? "positive" : "negative"} />
              <ModuleMetric label="Statische Wirkung" value={fmtDiff(result.staticDelta)} note="ohne Verhaltensreaktion" tone={result.staticDelta >= 0 ? "positive" : "negative"} />
              <ModuleMetric label="Verhaltenskomponente" value={fmtDiff(result.behavioralAdjustment)} note={`Verhaltensanpassung · Modellstufe ${modelLabel(modelLevel)}`} tone={result.behavioralAdjustment >= 0 ? "positive" : "negative"} />
            </div>
          </section>

          <section className="revenue-editor-grid income-tax-editor-grid">
            <article className="card-flat revenue-parameters income-tax-parameters">
              <div className="section-title"><div><h3>Reformparameter</h3><p>Die gesetzliche Baseline bleibt unverändert. Jede Änderung wird im zentralen Szenario gespeichert.</p></div></div>
              <div className="parameter-list">
                <NumberSlider label="Grundfreibetrag" value={settings.allowance} baseline={statutoryIncomeTax2026.allowance} min={0} max={25_000} step={100} unit="€ / Jahr" onChange={(value) => update("allowance", value)} />
                <NumberSlider label="Eingangssteuersatz" value={settings.entryRate} baseline={statutoryIncomeTax2026.entryRate} min={0} max={30} step={0.5} unit="%" onChange={(value) => update("entryRate", value)} />
                <NumberSlider label="Spitzensteuersatz" value={settings.topRate} baseline={statutoryIncomeTax2026.topRate} min={30} max={60} step={0.5} unit="%" onChange={(value) => update("topRate", value)} />
                <NumberSlider label="Schwelle Spitzensteuersatz" value={settings.topThreshold} baseline={statutoryIncomeTax2026.topThreshold} min={40_000} max={150_000} step={500} unit="€ / Jahr" onChange={(value) => update("topThreshold", value)} />
                <NumberSlider label="Reichensteuersatz" value={settings.richRate} baseline={statutoryIncomeTax2026.richRate} min={30} max={65} step={0.5} unit="%" onChange={(value) => update("richRate", value)} />
                <NumberSlider label="Kinderfreibetrag" value={settings.childAllowance} baseline={statutoryIncomeTax2026.childAllowance} min={0} max={15_000} step={100} unit="€ / Kind" onChange={(value) => update("childAllowance", value)} />
                <div className="revenue-parameter income-tax-switch-parameter"><span><strong>Ehegattensplitting</strong><small>Baseline 2026: aktiviert</small></span><button role="switch" aria-label="Ehegattensplitting" aria-checked={settings.spouseSplitting} className={`switch ${settings.spouseSplitting ? "active" : ""}`} onClick={() => update("spouseSplitting", !settings.spouseSplitting)}><span /></button></div>
              </div>
              <p className="parameter-note">Kinderfreibetrag und Splitting werden in den Referenzhaushalten vereinfacht abgebildet. Die Günstigerprüfung mit Kindergeld ist noch nicht Bestandteil dieses Moduls.</p>
            </article>

            <aside className="revenue-side-stack">
              <ModuleModelLevelCard
                description="Statischer Tarifvergleich oder zusätzlich modellierte Reaktion des zu versteuernden Einkommens."
                ariaLabel="Modellstufe Einkommensteuer"
                modelLevel={modelLevel}
                onModelLevel={onModelLevel}
                modelLabel={modelLabel}
                modelDescription={modelDescription}
              />

              <article className="card-flat income-tax-law-card" aria-label="Gesetzliche Eckwerte 2026">
                <div className="section-title"><div><h3>Gesetzliche Eckwerte 2026</h3><p>Unveränderte Referenzwerte für Tarif und Rundung.</p></div></div>
                <div className="income-tax-law-grid">
                  <div><span>Grundfreibetrag</span><strong>12.348 €</strong></div>
                  <div><span>Beginn 42 %</span><strong>69.879 €</strong></div>
                  <div><span>Beginn 45 %</span><strong>277.826 €</strong></div>
                  <div><span>Rundung</span><strong>volle Euro</strong></div>
                </div>
                <button className="button secondary small" onClick={() => onOpenSource("metric-income-tax-tariff", "Rechtsstand 2026")}><Info size={13} /> Nachweis öffnen</button>
              </article>
            </aside>
          </section>

          <section className="card-flat income-tax-impact-card">
            <div className="section-title"><div><h3>Verteilungswirkung</h3><p>Gewichtete Ergebnisse der kalibrierten Referenzpopulation.</p></div></div>
            <div className="revenue-kpi-grid">
              <ModuleMetric label="Gewinner" value={`${formatNumber(result.winnersM)} Mio.`} note="Steuerfälle" tone="positive" onSource={() => onOpenSource("metric-income-tax-distribution", `${formatNumber(result.winnersM)} Mio.`)} />
              <ModuleMetric label="Verlierer" value={`${formatNumber(result.losersM)} Mio.`} note="Steuerfälle" tone="negative" onSource={() => onOpenSource("metric-income-tax-distribution", `${formatNumber(result.losersM)} Mio.`)} />
              <ModuleMetric label="Median-Wirkung" value={formatSignedEuro(result.medianMonthlyChange, " / Monat")} note="gewichteter Median" tone={result.medianMonthlyChange >= 0 ? "positive" : "negative"} onSource={() => onOpenSource("metric-household-examples", formatSignedEuro(result.medianMonthlyChange, " / Monat"))} />
              <ModuleMetric label="Kalibrierte Steuerfälle" value={`${formatNumber(result.taxUnitsM)} Mio.`} note="Referenzpopulation" />
            </div>
          </section>

          <TaxCheckCard settings={settings} onOpenSource={onOpenSource} />

          <section className="card-flat chart-card">
            <header><div><h2>Tarifkurve</h2><p>Grenzsteuersatz nach zu versteuerndem Einkommen</p></div><button className="source-badge" onClick={() => onOpenSource("metric-income-tax-tariff", "Tarifvergleich 2026")}><Info size={10} /> Nachweis</button></header>
            <TariffChart result={result} />
            <div className="chart-legend"><span><i className="baseline" /> gesetzlicher Tarif 2026</span><span><i className="reform" /> Reformszenario</span></div>
          </section>

          <section className="card-flat chart-card">
            <header><div><h2>Verteilung nach Einkommensdezilen</h2><p>Gewichtete monatliche Änderung der tariflichen Einkommensteuer</p></div><button className="source-badge" onClick={() => onOpenSource("metric-income-tax-distribution", "D1 bis D10")}><Info size={10} /> Nachweis</button></header>
            <DistributionRows result={result} />
          </section>

          <section className="card-flat chart-card">
            <header><div><h2>Referenzhaushalte</h2><p>Direkter Vergleich aus gesetzlichem Tarif und Reformszenario</p></div><button className="source-badge" onClick={() => onOpenSource("metric-household-examples", formatSignedEuro(result.medianMonthlyChange, " / Monat"))}><Info size={10} /> Nachweis</button></header>
            <div className="household-grid compact">{result.households.map((household) => <article className="household-card" key={household.id}><div><strong>{household.name}</strong><small>{household.description}</small></div><em className={household.monthlyChange >= 0 ? "positive" : "negative"}>{formatSignedEuro(household.monthlyChange, " / Monat")}</em><p>Baseline: {formatEuro(household.baselineTax)} · Reform: {formatEuro(household.reformTax)} pro Jahr.</p><span>{household.joint ? "Zusammenveranlagung" : "Einzelveranlagung"}</span></article>)}</div>
          </section>
        </div>
      </section>
    </main>
  );
}

function TaxCheckCard({ settings, onOpenSource }: { settings: IncomeTaxSettings; onOpenSource: (metricId: string, value?: string) => void }) {
  const [income, setIncome] = useState(50_000);
  const [joint, setJoint] = useState(false);
  const calculation = useMemo(() => {
    const baselineTax = calculateStatutoryIncomeTax2026(income, joint);
    const reformTax = calculateReformIncomeTax(settings, income, joint);
    return { baselineTax, reformTax, change: baselineTax - reformTax };
  }, [income, joint, settings]);

  return (
    <section className="card-flat tax-check-card" aria-labelledby="tax-check-title">
      <header><div><span className="calculator-icon"><Calculator size={16} /></span><div><h2 id="tax-check-title">Tarifprüfung 2026</h2><p>Tarifliche Einkommensteuer für ein frei wählbares zu versteuerndes Einkommen.</p></div></div><button className="source-badge" onClick={() => onOpenSource("metric-income-tax-tariff", formatEuro(calculation.baselineTax))}><Info size={10} /> Formel</button></header>
      <div className="tax-check-inputs">
        <label><span>Zu versteuerndes Einkommen</span><input aria-label="Zu versteuerndes Einkommen für Tarifprüfung" type="number" min="0" step="100" value={income} onChange={(event) => setIncome(Math.max(0, Number(event.target.value)))} /><small>€ / Jahr</small></label>
        <label><span>Veranlagung</span><select aria-label="Veranlagung für Tarifprüfung" value={joint ? "joint" : "single"} onChange={(event) => setJoint(event.target.value === "joint")}><option value="single">alleinstehend</option><option value="joint">zusammenveranlagt</option></select></label>
      </div>
      <div className="tax-check-results">
        <div><span>Gesetz 2026</span><strong data-testid="baseline-tax-check">{formatEuro(calculation.baselineTax)}</strong><small>{formatRate(calculation.baselineTax, income)} Durchschnitt</small></div>
        <div><span>Reformszenario</span><strong>{formatEuro(calculation.reformTax)}</strong><small>{formatRate(calculation.reformTax, income)} Durchschnitt</small></div>
        <div className={calculation.change >= 0 ? "positive" : "negative"}><span>Verfügbares Einkommen</span><strong>{formatSignedEuro(calculation.change, " / Jahr")}</strong><small>{formatSignedEuro(calculation.change / 12, " / Monat")}</small></div>
      </div>
      <p className="tax-check-disclaimer">Die Prüfung berechnet ausschließlich die tarifliche Einkommensteuer. Solidaritätszuschlag, Kirchensteuer, Sozialabgaben und individuelle Abzüge sind nicht enthalten.</p>
    </section>
  );
}

function NumberSlider({ label, value, baseline, min, max, step, unit, onChange }: { label: string; value: number; baseline: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void }) {
  return <label className="revenue-parameter"><span><strong>{label}</strong><small>Baseline: {baseline.toLocaleString("de-DE")} {unit}</small></span><div className="parameter-controls"><input aria-label={`${label} Regler`} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /><input aria-label={`${label} Wert`} type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /><b>{unit}</b></div></label>;
}

function TariffChart({ result }: { result: IncomeTaxResult }) {
  const x = (income: number) => 30 + income / 300_000 * 650;
  const y = (rate: number) => 235 - rate / 60 * 190;
  const baselinePath = result.curve.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.taxableIncome)} ${y(point.baselineMarginalRate)}`).join(" ");
  const reformPath = result.curve.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.taxableIncome)} ${y(point.reformMarginalRate)}`).join(" ");
  return <svg className="tariff-chart" viewBox="0 0 720 270" role="img" aria-label="Vergleich der Grenzsteuersätze"><line x1="30" x2="680" y1="235" y2="235" /><line x1="30" x2="30" y1="45" y2="235" /><path className="baseline-line" d={baselinePath} /><path className="reform-line" d={reformPath} />{[0, 50, 100, 150, 200, 250, 300].map((value) => <text key={value} x={x(value * 1_000)} y="255" textAnchor="middle">{value}k</text>)}{[0, 15, 30, 45, 60].map((value) => <text key={value} x="22" y={y(value) + 4} textAnchor="end">{value}%</text>)}</svg>;
}

function DistributionRows({ result }: { result: IncomeTaxResult }) {
  const max = Math.max(1, ...result.deciles.map((item) => Math.abs(item.monthlyChange)));
  return <div className="distribution-bars compact">{result.deciles.map((item) => {
    const positive = item.monthlyChange >= 0;
    const width = Math.abs(item.monthlyChange) / max * 50;
    return <div key={item.id} title={`${formatSignedEuro(item.lowerMonthlyChange)} bis ${formatSignedEuro(item.upperMonthlyChange)}`}><span>{item.id}</span><i><b className={positive ? "positive" : "negative"} style={{ left: positive ? "50%" : `${50 - width}%`, width: `${width}%` }} /></i><em className={positive ? "positive" : "negative"}>{formatSignedEuro(item.monthlyChange)}</em></div>;
  })}</div>;
}

function modelLabel(level: ModelLevel) {
  if (level === "statisch") return "statisch";
  if (level === "verhalten") return "mit Verhalten";
  return "langfristig";
}

function modelDescription(level: ModelLevel) {
  if (level === "statisch") return "gesetzlicher Tarifvergleich ohne Reaktion";
  if (level === "verhalten") return "moderate Reaktion des zu versteuernden Einkommens";
  return "stärkere mittelfristige Anpassung";
}

function formatNumber(value: number) {
  return value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatEuro(value: number) {
  return `${Math.round(value).toLocaleString("de-DE")} €`;
}

function formatSignedEuro(value: number, suffix = "") {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  return `${sign}${Math.abs(Math.round(value)).toLocaleString("de-DE")} €${suffix}`;
}

function formatRate(tax: number, income: number) {
  if (income <= 0) return "0,0 %";
  return `${(tax / income * 100).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}
