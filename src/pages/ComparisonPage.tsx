import { ChevronLeft, ExternalLink, Info } from "lucide-react";
import { useMemo, useState } from "react";
import type { BudgetSummary } from "../lib/budget-summary";
import { BASELINE_INCOME_TAX_REVENUE_BN, type IncomeTaxResult } from "../lib/income-tax";
import { calculationFreshnessLabel, modelLevelLabel, type CalculationFreshness } from "../lib/scenario-calculation";
import { formatScenarioChangeValue } from "../lib/scenario-changes";
import { sameScenarioChangeValue, type ScenarioChangeComparisonRow, type ScenarioFoundationDifference } from "../lib/scenario-comparison";
import { fmtBn, fmtDiff } from "../lib/sim-data";
import type { ScenarioDraftWithPopulationBasis } from "../lib/scenario-state";
import type { ScenarioState } from "../lib/types";
import type { ScenarioEffectSummary } from "../lib/reform-effects";

interface SavedComparisonSnapshot {
  scenarioId: string;
  status: "loading" | "ready" | "error";
  budgetSummary?: BudgetSummary;
  incomeTaxResult?: IncomeTaxResult;
  directFiscalDelta?: number;
  effectSummary?: ScenarioEffectSummary;
  effectStatus?: CalculationFreshness;
  effectError?: string;
  warnings: string[];
  error?: string;
}

const unavailableEffects: ScenarioEffectSummary = {
  shortTerm: 0,
  longTerm: 0,
  feedback: 0,
  nonMonetaryEffects: [],
  directionalCount: 0,
  unavailableCount: 0,
  activeContextCount: 0,
  countedOverlapKeys: [],
};

const displaySummaryValue = (value: number | null) => value === null ? "Nicht vollständig" : fmtBn(value);
const effectValue = (value: number, status: CalculationFreshness) => status === "current" ? fmtEffect(value) : status === "updating" ? "Wird aktualisiert" : "Nicht aktuell";
const fmtEffect = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Mrd. €`;

export function ComparisonPage({
  currentScenario,
  savedScenarios,
  selectedScenarioId,
  snapshot,
  budgetSummary,
  incomeTaxResult,
  directFiscalDelta,
  effectSummary,
  effectStatus,
  effectError,
  foundationDifferences,
  changeRows,
  onSelectScenario,
  onOpenScenario,
  onOpenChanges,
  onBack,
  onOpenSource,
  onOpenAdvancedEffects,
  onOpenLongTerm,
}: {
  currentScenario: ScenarioDraftWithPopulationBasis;
  savedScenarios: ScenarioState[];
  selectedScenarioId: string | null;
  snapshot: SavedComparisonSnapshot | null;
  budgetSummary: BudgetSummary;
  incomeTaxResult: IncomeTaxResult;
  directFiscalDelta: number;
  effectSummary: ScenarioEffectSummary;
  effectStatus: CalculationFreshness;
  effectError: string;
  foundationDifferences: ScenarioFoundationDifference[];
  changeRows: ScenarioChangeComparisonRow[];
  onSelectScenario: (scenarioId: string | null) => void;
  onOpenScenario: () => void;
  onOpenChanges: () => void;
  onBack: () => void;
  onOpenSource: (metricId: string, value?: string) => void;
  onOpenAdvancedEffects: () => void;
  onOpenLongTerm: () => void;
}) {
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const selectedScenario = savedScenarios.find((item) => item.id === selectedScenarioId);
  const activeSnapshot = selectedScenario && snapshot?.scenarioId === selectedScenario.id ? snapshot : null;
  const alternativeSummary = activeSnapshot?.status === "ready" ? activeSnapshot.budgetSummary : undefined;
  const alternativeTax = activeSnapshot?.status === "ready" ? activeSnapshot.incomeTaxResult : undefined;
  const hasFoundationMismatch = Boolean(selectedScenario && foundationDifferences.length > 0);
  const comparableTotals = Boolean(
    selectedScenario
    && activeSnapshot?.status === "ready"
    && !hasFoundationMismatch
    && budgetSummary.isComplete
    && alternativeSummary?.isComplete,
  );
  const shownChanges = useMemo(
    () => changeRows.filter((row) => !selectedScenario || !onlyDifferences || !sameScenarioChangeValue(row.current, row.alternative)),
    [changeRows, onlyDifferences, selectedScenario],
  );
  const currentEffectNote = effectError || calculationFreshnessLabel(effectStatus);
  const alternativeEffectStatus = activeSnapshot?.effectStatus ?? "stale";
  const alternativeEffect = activeSnapshot?.status === "ready" ? activeSnapshot.effectSummary ?? unavailableEffects : unavailableEffects;
  const naturalUnits = effectSummary.nonMonetaryEffects.length
    ? effectSummary.nonMonetaryEffects.slice(0, 2).map((item) => `${Math.round(item.value).toLocaleString("de-DE")} ${item.unit}`).join(" · ")
    : "keine quantifizierte natürliche Einheit";
  const alternativeNaturalUnits = alternativeEffect.nonMonetaryEffects.length
    ? alternativeEffect.nonMonetaryEffects.slice(0, 2).map((item) => `${Math.round(item.value).toLocaleString("de-DE")} ${item.unit}`).join(" · ")
    : "keine quantifizierte natürliche Einheit";

  const rows = [
    { id: "revenue", label: "Einnahmen · ausgewiesene Posten", baseline: fmtBn(budgetSummary.revenueBaseline), current: displaySummaryValue(budgetSummary.revenueTotal), alternative: alternativeSummary ? displaySummaryValue(alternativeSummary.revenueTotal) : alternativeStatusLabel(activeSnapshot) },
    { id: "expense", label: "Ausgaben · ausgewiesene Posten", baseline: fmtBn(budgetSummary.expenseBaseline), current: displaySummaryValue(budgetSummary.expenseTotal), alternative: alternativeSummary ? displaySummaryValue(alternativeSummary.expenseTotal) : alternativeStatusLabel(activeSnapshot) },
    { id: "balance", label: "Saldo · ausgewiesene Posten", baseline: fmtBn(budgetSummary.balanceBaseline), current: displaySummaryValue(budgetSummary.balance), alternative: alternativeSummary ? displaySummaryValue(alternativeSummary.balance) : alternativeStatusLabel(activeSnapshot) },
    { id: "income-tax", label: "Einkommensteuer-Aufkommen", baseline: fmtBn(BASELINE_INCOME_TAX_REVENUE_BN), current: fmtBn(incomeTaxResult.value), alternative: alternativeTax ? fmtBn(alternativeTax.value) : alternativeStatusLabel(activeSnapshot) },
    { id: "gini", label: "Gini-Koeffizient", baseline: "noch nicht berechnet", current: "noch nicht berechnet", alternative: selectedScenario ? "noch nicht berechnet" : "Keine Alternative ausgewählt" },
    { id: "poverty", label: "Armutsrisikoquote", baseline: "noch nicht berechnet", current: "noch nicht berechnet", alternative: selectedScenario ? "noch nicht berechnet" : "Keine Alternative ausgewählt" },
  ];
  const directDifference = comparableTotals && budgetSummary.balance !== null && alternativeSummary && alternativeSummary.balance !== null
    ? fmtDiff(budgetSummary.balance - alternativeSummary.balance)
    : !selectedScenario
      ? "Wähle eine gespeicherte Alternative"
      : activeSnapshot?.status === "loading"
        ? "Wird berechnet"
        : activeSnapshot?.status === "error"
          ? "Nicht berechenbar"
          : hasFoundationMismatch
            ? "Nicht direkt vergleichbar"
            : "Nicht vollständig";

  const effectRows: Array<{ id: string; label: string; note: string; current: string; alternative: string; currentNote?: string; alternativeNote?: string }> = [
    { id: "direct", label: "Direkte fiskalische Wirkung", note: "unmittelbarer Budgeteffekt ohne zusätzliche Wirkungskette", current: fmtEffect(directFiscalDelta), alternative: selectedScenario && !hasFoundationMismatch && activeSnapshot?.status === "ready" && typeof activeSnapshot.directFiscalDelta === "number" ? fmtEffect(activeSnapshot.directFiscalDelta) : alternativeStatusLabel(activeSnapshot), currentNote: "aus den aktuellen Modulwerten", alternativeNote: selectedScenario ? activeSnapshot?.effectError || (hasFoundationMismatch ? "Grundlagen weichen ab" : "aus den gespeicherten Modulwerten") : undefined },
    { id: "short-term", label: "Kurzfristige mögliche Reaktionen", note: "indirekte Pfade; keine sichere Prognose", current: effectValue(effectSummary.shortTerm, effectStatus), alternative: selectedScenario ? effectValue(alternativeEffect.shortTerm, alternativeEffectStatus) : "Keine Alternative ausgewählt" },
    { id: "feedback", label: "Fiskalische Rückkopplungen", note: "getrennt vom direkten Budgetsaldo", current: effectValue(effectSummary.feedback, effectStatus), alternative: selectedScenario ? effectValue(alternativeEffect.feedback, alternativeEffectStatus) : "Keine Alternative ausgewählt" },
    { id: "long-term", label: "Langfristige Szenariopfade", note: "nur innerhalb der gewählten Modellstufe und des Zeithorizonts", current: effectValue(effectSummary.longTerm, effectStatus), alternative: selectedScenario ? effectValue(alternativeEffect.longTerm, alternativeEffectStatus) : "Keine Alternative ausgewählt" },
    { id: "non-monetary", label: "Nicht monetäre Wirkungen", note: "natürliche Einheiten werden nicht in Euro umgerechnet", current: effectStatus === "current" ? naturalUnits : effectValue(0, effectStatus), alternative: selectedScenario ? (alternativeEffectStatus === "current" ? alternativeNaturalUnits : effectValue(0, alternativeEffectStatus)) : "Keine Alternative ausgewählt" },
    { id: "directional", label: "Nur gerichtete Wirkungen", note: "Richtung sichtbar, aber kein Punktwert", current: effectStatus === "current" ? `${effectSummary.directionalCount} Pfad${effectSummary.directionalCount === 1 ? "" : "e"}` : effectValue(0, effectStatus), alternative: selectedScenario ? (alternativeEffectStatus === "current" ? `${alternativeEffect.directionalCount} Pfad${alternativeEffect.directionalCount === 1 ? "" : "e"}` : effectValue(0, alternativeEffectStatus)) : "Keine Alternative ausgewählt" },
    { id: "unavailable", label: "Nicht ausreichend belegt", note: "bewusst ohne scheinpräzisen Punktwert", current: effectStatus === "current" ? `${effectSummary.unavailableCount} Pfad${effectSummary.unavailableCount === 1 ? "" : "e"}` : effectValue(0, effectStatus), alternative: selectedScenario ? (alternativeEffectStatus === "current" ? `${alternativeEffect.unavailableCount} Pfad${alternativeEffect.unavailableCount === 1 ? "" : "e"}` : effectValue(0, alternativeEffectStatus)) : "Keine Alternative ausgewählt" },
  ];

  return (
    <main className="content-width comparison-page">
      <header className="detail-header">
        <div>
          <button className="back-link" onClick={onBack}><ChevronLeft size={14} /> Zurück zum Dashboard</button>
          <h1>Szenariovergleich</h1>
          <p>Vergleiche deinen aktuellen Entwurf mit einem gespeicherten Szenario. Jede Spalte nutzt die eigenen Einstellungen und die eigene Modellgrundlage.</p>
        </div>
        <button className="source-badge" onClick={() => onOpenSource("metric-income-tax-revenue", fmtBn(incomeTaxResult.value))}><Info size={10} /> Nachweis</button>
      </header>

      <section className="comparison-alternative-picker card-flat" aria-labelledby="comparison-alternative-title">
        <div className="comparison-alternative-copy">
          <span className="eyebrow">Gespeicherte Alternative</span>
          <h2 id="comparison-alternative-title">Wähle ein Szenario zum Vergleichen</h2>
          <p>Die Auswahl ändert weder den Entwurf noch die gespeicherte Variante.</p>
        </div>
        <label className="comparison-select-label">
          <span>Gespeicherte Szenarien</span>
          <select data-testid="comparison-scenario-select" aria-label="Gespeicherte Alternative auswählen" value={selectedScenarioId ?? ""} onChange={(event) => onSelectScenario(event.target.value || null)}>
            <option value="">Alternative auswählen</option>
            {savedScenarios.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <button className="button secondary small" type="button" onClick={onOpenScenario}>Szenarien verwalten</button>
      </section>

      {savedScenarios.length === 0 ? (
        <section className="comparison-empty-state" data-testid="comparison-empty-state" aria-live="polite">
          <strong>Noch keine gespeicherten Szenarien</strong>
          <p>Speichere deinen Entwurf unter einem eigenen Namen. Danach kannst du hier eine Alternative auswählen und ihre Ergebnisse mit dem aktuellen Entwurf vergleichen.</p>
          <button className="button primary" type="button" onClick={onOpenScenario}>Szenario speichern <ExternalLink size={13} /></button>
        </section>
      ) : !selectedScenario ? (
        <p className="notice-box comparison-empty-selection" role="status">Wähle oben eine gespeicherte Alternative. Deine vorhandenen Szenarien bleiben dabei unverändert.</p>
      ) : null}

      {selectedScenario && activeSnapshot?.status === "loading" && <p className="notice-box comparison-calculating" role="status">„{selectedScenario.name}“ wird mit den gespeicherten Parametern und der referenzierten Modellbasis berechnet.</p>}
      {selectedScenario && activeSnapshot?.status === "error" && <p className="notice-box comparison-error" role="alert"><strong>Alternative nicht berechnet.</strong> {activeSnapshot.error} Die gespeicherte Variante wurde nicht geändert.</p>}
      {selectedScenario && activeSnapshot?.status === "ready" && activeSnapshot.warnings.length > 0 && <div className="notice-box comparison-warning-list" role="note"><strong>Hinweise zur gespeicherten Alternative</strong><ul>{activeSnapshot.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}

      {selectedScenario && foundationDifferences.length > 0 && <section className="comparison-foundation-warning" data-testid="comparison-foundation-warning" role="note" aria-labelledby="comparison-foundation-title">
        <div><strong id="comparison-foundation-title">Die Szenariogrundlagen unterscheiden sich</strong><p>Die Spalten zeigen jeweils die eigenen Ergebnisse. Eine direkte Differenz zwischen Entwurf und Alternative wird nicht ausgewiesen.</p></div>
        <ul>{foundationDifferences.map((item) => <li key={item.id}><strong>{item.label}</strong><span>{currentScenario.name}: {item.current}</span><span>{selectedScenario.name}: {item.alternative}</span></li>)}</ul>
      </section>}

      <section className="card-flat comparison-change-summary" aria-label="Zusammenfassung der Szenarioänderungen" data-testid="comparison-change-summary">
        <div><strong>{changeRows.filter((row) => row.category === "policy" && row.current !== row.baselineCurrent).length} politische Änderungen · {changeRows.filter((row) => row.category !== "policy" && row.current !== row.baselineCurrent).length} getrennte Annahmen und Einstellungen</strong><p>Alle geänderten Stellschrauben bleiben einzeln sichtbar; eine Wirkung wird nicht aus Einzelwerten naiv addiert.</p></div>
        <button className="button secondary small" type="button" onClick={onOpenChanges}>Deine Änderungen ansehen <ExternalLink size={13} /></button>
      </section>

      <p className="notice-box comparison-status-note" role="note">
        Ergebnisse beruhen je Spalte auf den dort angezeigten Modellannahmen. Gini, Armutsrisiko und regionale Wirkungen sind noch nicht berechnet. Eine amtliche Tarifgrundlage bestätigt keine abgeleiteten Modellwirkungen.
      </p>

      <section className="card-flat compare-table" role="region" aria-label="Haushaltskennzahlen im Vergleich" tabIndex={0}>
        <div className="compare-row compare-head"><strong>Kennzahl</strong><ColumnHead title="Status quo" note="wie in der Übersicht" /><ColumnHead title={currentScenario.name || "Aktueller Entwurf"} note={`Entwurf · ${modelLevelLabel(currentScenario.modelLevel)}`} active /><ColumnHead title={selectedScenario?.name ?? "Gespeicherte Alternative"} note={selectedScenario ? `Gespeichert · ${modelLevelLabel(selectedScenario.modelLevel)}` : "noch nicht ausgewählt"} /></div>
        {rows.map((row) => <div className="compare-row" data-testid={`comparison-${row.id}`} key={row.id}>
          <strong>{row.label}</strong><span>{row.baseline}</span>
          <span data-testid="scenario-current-value" className={row.baseline !== row.current ? "changed" : ""}>{budgetSummary.isComplete || !["revenue", "expense", "balance"].includes(row.id) ? row.current : "Nicht vollständig"}</span>
          <span data-testid="scenario-alternative-value" className={alternativeSummary && row.baseline !== row.alternative ? "changed-alt" : "not-comparable"}>{row.alternative}</span>
        </div>)}
        <div className="compare-row comparison-difference-row" data-testid="comparison-balance-difference"><strong>Saldo-Differenz · Entwurf minus Alternative</strong><span>—</span><span className="active-column">{comparableTotals ? "Direkt vergleichbar" : ""}</span><span className={comparableTotals ? "changed-alt" : "not-comparable"}>{directDifference}</span></div>
      </section>
      <p className="comparison-scope-note" role="note">
        {budgetSummary.isComplete
          ? `Der Entwurf zeigt die in der Übersicht ausgewiesenen Posten bei Modellstufe „${modelLevelLabel(currentScenario.modelLevel)}“. Das ist keine vollständige Haushaltsrechnung.${alternativeSummary && !alternativeSummary.isComplete ? ` Die Alternative ist unvollständig; fehlend: ${[...alternativeSummary.missingRevenueModules, ...alternativeSummary.missingExpenseModules].join(", ")}.` : ""}`
          : `Die Gesamtsummen des Entwurfs sind unvollständig${[...budgetSummary.missingRevenueModules, ...budgetSummary.missingExpenseModules].length ? ` · fehlend: ${[...budgetSummary.missingRevenueModules, ...budgetSummary.missingExpenseModules].join(", ")}` : ""}. Fehlende Teilwerte werden nicht als null gerechnet.`}
      </p>

      <section className="effects-context-comparison" data-testid="effect-level-comparison" data-status={effectStatus}>
        <header><h2>Wirkungsebenen getrennt vergleichen</h2><p>{effectSummary.activeContextCount} geänderte Reformmodule mit expliziter Wirkungszuordnung · {currentEffectNote}</p></header>
        {selectedScenario && activeSnapshot?.effectError && <p className="comparison-scope-note" role="note">Wirkungen von „{selectedScenario.name}“: {activeSnapshot.effectError}</p>}
        <div className="effect-compare-grid">
          <div className="effect-compare-head">Wirkungsebene</div><div className="effect-compare-head">Status quo</div><div className="effect-compare-head active-column">{currentScenario.name || "Aktueller Entwurf"}</div><div className="effect-compare-head">{selectedScenario?.name ?? "Gespeicherte Alternative"}</div>
          {effectRows.flatMap((row) => [
            <div className="effect-compare-label" key={`${row.id}-label`}><strong>{row.label}</strong><small>{row.note}</small></div>,
            <div className="effect-compare-value" key={`${row.id}-baseline`}><strong>{row.id === "direct" ? "±0,0 Mrd. €" : "Nicht berechnet"}</strong></div>,
            <div className="effect-compare-value active-column" key={`${row.id}-current`}><strong>{row.current}</strong><small>{row.currentNote ?? currentEffectNote}</small></div>,
            <div className="effect-compare-value" key={`${row.id}-alternative`}><strong>{row.alternative}</strong><small>{row.alternativeNote ?? activeSnapshot?.effectError ?? (selectedScenario ? calculationFreshnessLabel(alternativeEffectStatus) : "keine Alternative ausgewählt")}</small></div>,
          ])}
        </div>
        <button className="button secondary small" type="button" onClick={onOpenAdvancedEffects}>Vollständige Wirkungsmodelle prüfen <ExternalLink size={13} /></button>
      </section>

      <section className="long-term-entry card-flat" aria-labelledby="long-term-entry-title">
        <div><span className="eyebrow">Szenariovergleich</span><h2 id="long-term-entry-title">Langfristige Entwicklung</h2><p>Bevölkerung, Erwerbspotenzial und Alterssicherung bis 2030, 2040, 2050 oder 2070 in einer gemeinsamen, vereinfachten Szenarioansicht vergleichen.</p></div>
        <button className="button primary" type="button" onClick={onOpenLongTerm}>Langfristansicht öffnen <ExternalLink size={13} /></button>
      </section>

      <section className="comparison-policies">
        <div className="comparison-parameters-heading"><div><h2>Geänderte Maßnahmen und Annahmen</h2><p>Vorher- und gespeicherte Werte bleiben je Szenario getrennt sichtbar.</p></div>
          <label className="comparison-difference-toggle"><input type="checkbox" checked={onlyDifferences} disabled={!selectedScenario} onChange={(event) => setOnlyDifferences(event.target.checked)} /> Nur Unterschiede anzeigen</label>
        </div>
        {(selectedScenario || changeRows.length > 0) && <div className="card-flat compare-table comparison-parameter-table" role="region" aria-label="Geänderte Maßnahmen und Einstellungen im Vergleich" tabIndex={0}>
          <div className="comparison-parameter-row comparison-parameter-head"><strong>Maßnahme / Annahme</strong><span>{currentScenario.name} · vorher</span><span>{currentScenario.name} · aktuell</span><span>{selectedScenario?.name ?? "Alternative auswählen"} · vorher</span><span>{selectedScenario?.name ?? "Alternative auswählen"} · gespeichert</span></div>
          {shownChanges.map((row) => <div className="comparison-parameter-row" data-testid={`comparison-parameter-${row.id}`} key={row.id}>
            <strong><span>{row.label}</span><small>{row.group}</small></strong>
            <span>{formatScenarioChangeValue(row.baselineCurrent, row.unit, row.id)}</span>
            <span className={!sameScenarioChangeValue(row.current, row.baselineCurrent) ? "changed" : ""}>{formatScenarioChangeValue(row.current, row.unit, row.id)}</span>
            <span>{selectedScenario ? formatScenarioChangeValue(row.baselineAlternative, row.unit, row.id) : "—"}</span>
            <span className={selectedScenario && !sameScenarioChangeValue(row.alternative, row.baselineAlternative) ? "changed-alt" : ""}>{selectedScenario ? formatScenarioChangeValue(row.alternative, row.unit, row.id) : "—"}</span>
          </div>)}
          {shownChanges.length === 0 && <p className="comparison-no-changes">{selectedScenario ? onlyDifferences ? "Diese Szenarien haben bei den geänderten Maßnahmen und Annahmen dieselben Werte." : "In diesen Szenarien sind keine Stellschrauben gegenüber der Baseline geändert." : "Im aktuellen Entwurf sind keine Stellschrauben gegenüber der Baseline geändert."}</p>}
        </div>}
        {!selectedScenario && <p className="comparison-scope-note">Wähle eine gespeicherte Alternative, um ihre Maßnahmen und Annahmen neben dem aktuellen Entwurf zu sehen.</p>}
      </section>
    </main>
  );
}

function alternativeStatusLabel(snapshot: SavedComparisonSnapshot | null) {
  if (!snapshot) return "Keine Alternative ausgewählt";
  if (snapshot.status === "loading") return "Wird berechnet";
  if (snapshot.status === "error") return "Nicht berechnet";
  return "Nicht vollständig";
}

function ColumnHead({ title, note, active = false }: { title: string; note: string; active?: boolean }) {
  return <span className={active ? "active-column" : ""}><strong>{title}</strong><small>{note}</small></span>;
}
