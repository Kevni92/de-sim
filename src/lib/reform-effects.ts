import { effectRegistry } from "./effect-registry";
import type { ExpenseModuleId, ExpenseModuleResult } from "./expense-modules";
import { expenseModuleDefinitions, expenseParameterKey } from "./expense-modules";
import type { EffectCausality, EffectEvidenceStatus, EffectModuleResult, EffectRun } from "./long-term-effects";
import type { RevenueModuleId, RevenueModuleResult } from "./revenue-modules";
import { revenueModuleDefinitions, revenueParameterKey } from "./revenue-modules";
import type { ScenarioDraft } from "./types";

export type ReformContextKey = `revenue:${RevenueModuleId}` | `expense:${ExpenseModuleId}`;
export type ContextEffectLayer = "short-term" | "long-term" | "feedback" | "non-monetary";
export type ContextEffectStatus = "quantified" | "directional" | "unavailable" | "inactive";

type EngineValueMode = "short-term" | "long-term" | "feedback" | "path" | "none";

type ContextualEffectLink = {
  id: string;
  contextKey: ReformContextKey;
  title?: string;
  effectModuleId?: string;
  chain: string;
  startYear: number;
  layer: ContextEffectLayer;
  valueMode: EngineValueMode;
  quantification: "engine" | "directional" | "unavailable";
  overlapKey: string;
  aggregation: "primary" | "reference-only";
  sourceIds: string[];
  evidenceStatus?: EffectEvidenceStatus;
  causality?: EffectCausality;
  direction?: string;
  noPointReason?: string;
  dependencyNote?: string;
};

export type ContextualEffectView = {
  id: string;
  title: string;
  chain: string;
  timing: string;
  layer: ContextEffectLayer;
  status: ContextEffectStatus;
  evidenceStatus: EffectEvidenceStatus;
  causality: EffectCausality;
  value: number | null;
  lower: number | null;
  upper: number | null;
  affectedPersons: number;
  affectedHouseholds: number;
  nonMonetaryEffects: EffectModuleResult["nonMonetaryEffects"];
  sourceIds: string[];
  explanation: string;
  dependencyNote?: string;
  aggregation: "primary" | "reference-only";
};

export type ScenarioEffectSummary = {
  shortTerm: number;
  longTerm: number;
  feedback: number;
  nonMonetaryEffects: Array<{ id: string; label: string; value: number; unit: string }>;
  directionalCount: number;
  unavailableCount: number;
  activeContextCount: number;
  countedOverlapKeys: string[];
};

const links: readonly ContextualEffectLink[] = [
  {
    id: "vat-price-consumption",
    contextKey: "revenue:ust",
    title: "Preisweitergabe und Konsumreaktion",
    chain: "Steuersatz → Verbraucherpreise → reale Nachfrage → steuerpflichtiger Umsatz",
    startYear: 0,
    layer: "short-term",
    valueMode: "none",
    quantification: "directional",
    overlapKey: "vat-price-consumption",
    aggregation: "primary",
    sourceIds: ["source-vat", "source-revenue-model"],
    evidenceStatus: "nicht-ausreichend-belegt",
    causality: "hypothetisch",
    direction: "Eine Satzerhöhung kann Preise erhöhen und reale Nachfrage dämpfen; bei einer Senkung ist die Richtung umgekehrt.",
    noPointReason: "Ohne warenkorbspezifische Preisweitergabe und Nachfrageelastizitäten wird kein scheinpräziser Punktwert ausgewiesen.",
  },
  {
    id: "family-kita-path",
    contextKey: "expense:family",
    effectModuleId: "kita-betreuung",
    chain: "Finanzierte Plätze und Qualität → verlässlichere Betreuung → Arbeitszeit und Einkommen der Eltern",
    startYear: 0,
    layer: "short-term",
    valueMode: "path",
    quantification: "engine",
    overlapKey: "family-kita-primary",
    aggregation: "primary",
    sourceIds: ["source-effect-kita", "source-effect-labour"],
  },
  {
    id: "family-labour-detail",
    contextKey: "expense:family",
    effectModuleId: "arbeitsvolumen",
    chain: "Betreuungsentlastung → Erwerbseintritt oder zusätzliche Arbeitsstunden → höheres Erwerbseinkommen",
    startYear: 1,
    layer: "long-term",
    valueMode: "long-term",
    quantification: "engine",
    overlapKey: "family-kita-primary",
    aggregation: "reference-only",
    sourceIds: ["source-effect-labour"],
    dependencyNote: "Dieser Teilpfad ist bereits im übergeordneten Kita-Pfad berücksichtigt und wird im Vergleich nicht zusätzlich summiert.",
  },
  {
    id: "family-demography-boundary",
    contextKey: "expense:family",
    effectModuleId: "geburten-demografie",
    chain: "Familienpolitik → mögliche Lebensentscheidungen → langfristige Bevölkerungsstruktur",
    startYear: 5,
    layer: "long-term",
    valueMode: "none",
    quantification: "unavailable",
    overlapKey: "family-demography-unavailable",
    aggregation: "primary",
    sourceIds: ["source-effect-demography"],
    noPointReason: "Eine kausale Geburtenwirkung der konkreten Einzelmaßnahme ist nicht ausreichend belegt und wird nicht monetarisiert.",
  },
  {
    id: "infrastructure-output-path",
    contextKey: "expense:infrastructure",
    effectModuleId: "infrastruktur-investition",
    chain: "Investitionsausgaben → Mittelabfluss und Kapitalstock → mögliche Wertschöpfung und fiskalische Rückflüsse",
    startYear: 1,
    layer: "long-term",
    valueMode: "path",
    quantification: "engine",
    overlapKey: "public-infrastructure-primary",
    aggregation: "primary",
    sourceIds: ["source-effect-infrastructure", "source-effect-fiscal"],
  },
  {
    id: "infrastructure-productivity-detail",
    contextKey: "expense:infrastructure",
    effectModuleId: "produktivitaet",
    chain: "Besserer Kapitalstock und Erreichbarkeit → mögliche Produktivitätsänderung → Einkommen und Wertschöpfung",
    startYear: 2,
    layer: "long-term",
    valueMode: "long-term",
    quantification: "engine",
    overlapKey: "public-infrastructure-primary",
    aggregation: "reference-only",
    sourceIds: ["source-effect-productivity"],
    dependencyNote: "Der Produktivitätspfad ist eine abhängige Vertiefung des Infrastrukturpfads und wird nicht ein zweites Mal aggregiert.",
  },
  {
    id: "education-qualification-path",
    contextKey: "expense:education",
    effectModuleId: "bildung-qualifikation",
    chain: "Bildungsressourcen → mögliche zusätzliche Qualifikation → spätere Erwerbs- und Einkommenspfade",
    startYear: 5,
    layer: "non-monetary",
    valueMode: "none",
    quantification: "engine",
    overlapKey: "education-qualification-primary",
    aggregation: "primary",
    sourceIds: ["source-effect-education"],
  },
  {
    id: "health-sickness-path",
    contextKey: "expense:health",
    effectModuleId: "krankheitstage",
    chain: "Prävention und Versorgung → mögliche vermiedene Ausfalltage → wiedergewonnene Arbeitszeit",
    startYear: 1,
    layer: "short-term",
    valueMode: "path",
    quantification: "engine",
    overlapKey: "health-sickness-primary",
    aggregation: "primary",
    sourceIds: ["source-effect-health"],
  },
  {
    id: "migration-integration-boundary",
    contextKey: "expense:migration",
    effectModuleId: "migration-integration",
    chain: "Integrationsangebote → mögliche Erwerbs- und Bildungswege → spätere Einnahmen und Ausgaben",
    startYear: 2,
    layer: "long-term",
    valueMode: "none",
    quantification: "unavailable",
    overlapKey: "migration-integration-unavailable",
    aggregation: "primary",
    sourceIds: ["source-effect-migration"],
    noPointReason: "Die synthetische Bevölkerung enthält kein ausreichend belastbares Migrationsmerkmal; ein Punktwert wäre fachlich nicht vertretbar.",
  },
  {
    id: "pension-demography-boundary",
    contextKey: "expense:pension",
    effectModuleId: "altersausgaben",
    chain: "Leistungs- und Zugangsregeln → Alters- und Erwerbsverläufe → langfristige Renten-, Gesundheits- und Pflegeausgaben",
    startYear: 5,
    layer: "long-term",
    valueMode: "none",
    quantification: "unavailable",
    overlapKey: "pension-demography-unavailable",
    aggregation: "primary",
    sourceIds: ["source-effect-demography"],
    noPointReason: "Ohne Kohortenfortschreibung werden langfristige Altersausgaben nicht als einzelne Eurozahl ausgegeben.",
  },
] as const;

const unavailableEvidence = new Set<EffectEvidenceStatus>(["nicht-berechnet", "nicht-ausreichend-belegt"]);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const changed = (value: number, baseline: number) => Number.isFinite(value) && Math.abs(value - baseline) > 1e-9;

export function contextKeyForRevenue(id: RevenueModuleId): ReformContextKey { return `revenue:${id}`; }
export function contextKeyForExpense(id: ExpenseModuleId): ReformContextKey { return `expense:${id}`; }

export function effectLinksForContext(contextKey: ReformContextKey): readonly ContextualEffectLink[] {
  return links.filter((link) => link.contextKey === contextKey);
}

export function activeReformContextKeys(scenario: ScenarioDraft): ReformContextKey[] {
  const active: ReformContextKey[] = [];
  for (const definition of revenueModuleDefinitions) {
    if (definition.parameters.some((parameter) => changed(scenario.revenueChanges[revenueParameterKey(definition.id, parameter.key)] ?? parameter.baseline, parameter.baseline))) active.push(contextKeyForRevenue(definition.id));
  }
  for (const definition of expenseModuleDefinitions) {
    if (definition.parameters.some((parameter) => changed(scenario.expenseChanges[expenseParameterKey(definition.id, parameter.key)] ?? parameter.baseline, parameter.baseline))) active.push(contextKeyForExpense(definition.id));
  }
  return active;
}

export function deriveReformEffectParameters(scenario: ScenarioDraft, expenseResults: ExpenseModuleResult[]): Record<string, number> {
  const next = { ...scenario.effectParameters };
  const expenseValue = (moduleId: ExpenseModuleId, key: string, baseline: number) => scenario.expenseChanges[expenseParameterKey(moduleId, key)] ?? baseline;

  const familyPlaces = expenseValue("family", "placesIndex", 100);
  const familyQuality = expenseValue("family", "qualityIndex", 100);
  next["kita.capacityChangePct"] = clamp(familyPlaces - 100, -10, 25);
  next["kita.openingHoursChange"] = clamp((familyQuality - 100) * 0.1, -5, 10);
  next["kita.outageDaysReduction"] = clamp(Math.max(0, familyQuality - 100) * 0.08, 0, 15);

  const infrastructure = expenseResults.find((result) => result.id === "infrastructure");
  next["infrastructure.investmentChangeBn"] = clamp(infrastructure?.staticDelta ?? 0, -20, 50);

  const educationResources = expenseValue("education", "perStudentIndex", 100);
  const educationDigital = expenseValue("education", "digitalIndex", 100);
  next["education.qualificationGainPct"] = clamp(Math.max(0, educationResources - 100) * 0.015 + Math.max(0, educationDigital - 100) * 0.005, 0, 5);

  const prevention = expenseValue("health", "preventionSavings", 0);
  next["sickness.daysReduction"] = clamp(prevention * 0.15, 0, 5);

  const integration = expenseValue("migration", "integrationIndex", 100);
  next["migration.employmentGapReductionPct"] = clamp(Math.max(0, integration - 100) * 0.05, 0, 10);
  return next;
}

export function effectInputSignature({
  scenario,
  populationRunId,
  parameters,
}: {
  scenario: ScenarioDraft;
  populationRunId: string;
  parameters: Record<string, number>;
}): string {
  const sortedParameters = Object.fromEntries(Object.entries(parameters).sort(([left], [right]) => left.localeCompare(right)));
  return JSON.stringify({
    populationRunId,
    modelLevel: scenario.modelLevel,
    horizonYears: scenario.horizonYears,
    dataYear: scenario.dataYear,
    legalYear: scenario.legalYear,
    contexts: activeReformContextKeys(scenario).sort(),
    parameters: sortedParameters,
  });
}

function selectedValue(result: EffectModuleResult, mode: EngineValueMode): number {
  if (mode === "short-term") return result.indirectEffect;
  if (mode === "long-term") return result.longTermEffect;
  if (mode === "feedback") return result.feedbackEffect;
  if (mode === "path") return result.indirectEffect + result.longTermEffect + result.feedbackEffect;
  return 0;
}

function contextualBand(result: EffectModuleResult, value: number): { lower: number; upper: number } | null {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-9 || Math.abs(result.central) < 1e-9) return null;
  const relative = Math.min(1, Math.max(Math.abs(result.upper - result.central), Math.abs(result.central - result.lower)) / Math.abs(result.central));
  return value >= 0 ? { lower: value * (1 - relative), upper: value * (1 + relative) } : { lower: value * (1 + relative), upper: value * (1 - relative) };
}

function timingLabel(startYear: number, run: EffectRun | null): string {
  if (!run) return startYear === 0 ? "ab dem ersten Jahr" : `frühestens ab Jahr ${startYear}`;
  const start = run.dataYear + startYear;
  return startYear === 0 ? `ab ${run.dataYear}` : `frühestens ab ${start}`;
}

export function contextualEffectsFor(contextKey: ReformContextKey, run: EffectRun | null): ContextualEffectView[] {
  return effectLinksForContext(contextKey).map((link) => {
    const definition = link.effectModuleId ? effectRegistry.find((item) => item.id === link.effectModuleId) : undefined;
    const result = link.effectModuleId ? run?.moduleResults.find((item) => item.moduleId === link.effectModuleId) : undefined;
    const evidenceStatus = link.evidenceStatus ?? result?.evidenceStatus ?? definition?.evidenceStatus ?? "nicht-ausreichend-belegt";
    const causality = link.causality ?? result?.causality ?? definition?.causality ?? "hypothetisch";
    const title = link.title ?? result?.title ?? definition?.title ?? "Mögliche Folgewirkung";

    if (link.quantification === "directional") {
      return {
        id: link.id, title, chain: link.chain, timing: timingLabel(link.startYear, run), layer: link.layer, status: "directional", evidenceStatus, causality,
        value: null, lower: null, upper: null, affectedPersons: 0, affectedHouseholds: 0, nonMonetaryEffects: [], sourceIds: link.sourceIds,
        explanation: [link.direction, link.noPointReason].filter(Boolean).join(" "), dependencyNote: link.dependencyNote, aggregation: link.aggregation,
      };
    }

    if (link.quantification === "unavailable" || unavailableEvidence.has(evidenceStatus)) {
      return {
        id: link.id, title, chain: link.chain, timing: timingLabel(link.startYear, run), layer: link.layer, status: "unavailable", evidenceStatus, causality,
        value: null, lower: null, upper: null, affectedPersons: result?.affectedPersons ?? 0, affectedHouseholds: result?.affectedHouseholds ?? 0,
        nonMonetaryEffects: result?.nonMonetaryEffects ?? [], sourceIds: Array.from(new Set([...link.sourceIds, ...(definition?.sourceIds ?? [])])),
        explanation: link.noPointReason ?? result?.warnings.at(-1) ?? "Für diesen Pfad liegt keine ausreichend belastbare Quantifizierung vor.", dependencyNote: link.dependencyNote, aggregation: link.aggregation,
      };
    }

    if (!run || !result || (definition && !definition.supportedLevels.includes(run.modelLevel))) {
      return {
        id: link.id, title, chain: link.chain, timing: timingLabel(link.startYear, run), layer: link.layer, status: "inactive", evidenceStatus, causality,
        value: null, lower: null, upper: null, affectedPersons: result?.affectedPersons ?? 0, affectedHouseholds: result?.affectedHouseholds ?? 0,
        nonMonetaryEffects: result?.nonMonetaryEffects ?? [], sourceIds: Array.from(new Set([...link.sourceIds, ...(definition?.sourceIds ?? [])])),
        explanation: run ? "Die gewählte Modellstufe berechnet diesen Pfad nicht." : "Die Wirkungsrechnung wird vorbereitet.", dependencyNote: link.dependencyNote, aggregation: link.aggregation,
      };
    }

    const value = selectedValue(result, link.valueMode);
    const band = contextualBand(result, value);
    const hasNumericPath = link.valueMode !== "none" && Math.abs(value) >= 1e-9;
    const hasNaturalUnit = result.nonMonetaryEffects.some((measure) => Math.abs(measure.value) >= 1e-9);
    return {
      id: link.id, title, chain: link.chain, timing: timingLabel(link.startYear, run), layer: link.layer,
      status: hasNumericPath || hasNaturalUnit ? "quantified" : "inactive", evidenceStatus, causality,
      value: hasNumericPath ? value : null, lower: band?.lower ?? null, upper: band?.upper ?? null,
      affectedPersons: result.affectedPersons, affectedHouseholds: result.affectedHouseholds, nonMonetaryEffects: result.nonMonetaryEffects,
      sourceIds: Array.from(new Set([...link.sourceIds, ...(definition?.sourceIds ?? [])])),
      explanation: hasNumericPath || hasNaturalUnit ? definition?.uncertaintyModel ?? "Modellpfad mit dokumentierter Unsicherheit." : "Für die gewählte Maßnahme und Modellstufe entsteht kein quantifizierter Zusatzpfad.",
      dependencyNote: link.dependencyNote, aggregation: link.aggregation,
    };
  });
}

export function summarizeScenarioEffects(contextKeys: readonly ReformContextKey[], run: EffectRun | null): ScenarioEffectSummary {
  const summary: ScenarioEffectSummary = { shortTerm: 0, longTerm: 0, feedback: 0, nonMonetaryEffects: [], directionalCount: 0, unavailableCount: 0, activeContextCount: contextKeys.length, countedOverlapKeys: [] };
  if (!run) return summary;
  const counted = new Set<string>();
  const nonMonetary = new Set<string>();
  for (const contextKey of contextKeys) {
    for (const link of effectLinksForContext(contextKey)) {
      const view = contextualEffectsFor(contextKey, run).find((item) => item.id === link.id)!;
      if (view.status === "directional") summary.directionalCount += 1;
      if (view.status === "unavailable") summary.unavailableCount += 1;
      if (link.aggregation !== "primary" || counted.has(link.overlapKey)) continue;
      counted.add(link.overlapKey);
      const result = link.effectModuleId ? run.moduleResults.find((item) => item.moduleId === link.effectModuleId) : undefined;
      if (result && !unavailableEvidence.has(result.evidenceStatus)) {
        summary.shortTerm += result.indirectEffect;
        summary.longTerm += result.longTermEffect;
        summary.feedback += result.feedbackEffect;
        for (const measure of result.nonMonetaryEffects) {
          const id = `${link.overlapKey}:${measure.label}:${measure.unit}`;
          if (nonMonetary.has(id) || Math.abs(measure.value) < 1e-9) continue;
          nonMonetary.add(id);
          summary.nonMonetaryEffects.push({ id, ...measure });
        }
      }
    }
  }
  summary.countedOverlapKeys = [...counted];
  return summary;
}

export function contextualSources(contextKey: ReformContextKey): string[] {
  return Array.from(new Set(effectLinksForContext(contextKey).flatMap((link) => link.sourceIds)));
}

export function hasContextualEffects(contextKey: ReformContextKey): boolean {
  return effectLinksForContext(contextKey).length > 0;
}

export function revenueResultByContext(contextKey: ReformContextKey, results: RevenueModuleResult[]): RevenueModuleResult | undefined {
  return contextKey.startsWith("revenue:") ? results.find((result) => contextKey === `revenue:${result.id}`) : undefined;
}
