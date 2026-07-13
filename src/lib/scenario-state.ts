import { defaultEffectParameters } from "./long-term-effects";
import {
  cloneSgb2ScenarioReference,
  defaultSgb2ScenarioReference,
  normalizeSgb2ScenarioReference,
  validateSgb2ScenarioReference,
} from "./sgb2-policy";
import type { ScenarioDraft, ScenarioState, TimeHorizon } from "./types";

export const SCENARIO_SCHEMA_VERSION = 4;

export const defaultScenarioDraft: ScenarioDraft = {
  name: "Reformentwurf A",
  description: "Arbeitsstand für eine neutrale Simulation des Staatshaushalts mit Einnahmen-, Steuer-, Beitrags-, Ausgaben- und Wirkungsmodulen.",
  legalYear: 2026,
  dataYear: 2025,
  horizonYears: 5,
  modelLevel: "verhalten",
  revenueChanges: {},
  expenseChanges: {},
  effectParameters: { ...defaultEffectParameters },
  incomeTax: {
    allowance: 13_500,
    entryRate: 12,
    topRate: 42,
    topThreshold: 75_000,
    richRate: 45,
    childAllowance: 9_756,
    spouseSplitting: true,
  },
  assumptions: [
    "Die gesetzliche Einkommensteuer-Baseline folgt dem Tarif 2026 nach § 32a EStG.",
    "Verteilungsrechnungen verwenden einen referenzierten, vollständig synthetischen Bevölkerungslauf.",
    "Weitere Einnahmen und priorisierte Ausgaben werden als getrennte, versionierte Aggregatmodelle berechnet.",
    "Bürgergeld- und Grundsicherungsparameter werden zusätzlich in einem versionierten SGB-II-Policy-Vertrag gespeichert.",
    "Direkte Haushaltswirkung, indirekte Wirkung, Zeitverzögerung, Rückkopplung und Unsicherheit werden getrennt ausgewiesen.",
    "Langfristige Wirkungen sind Szenariorechnungen und keine sicheren Prognosen; nicht ausreichend belegte Bereiche bleiben unberechnet.",
    "Aufkommens- und Ausgabenmodelle sind keine individuelle Steuer-, Beitrags- oder Leistungsberatung.",
  ],
  modelVersion: "long-term-effects-0.8.0",
  sourceIds: [
    "source-budget",
    "source-est",
    "source-population-destatis",
    "source-population-microcensus",
    "source-population-phf",
    "source-population-model",
    "source-revenue-model",
    "source-expense-model",
    "source-effect-engine",
    "source-sgb2-law",
    "source-sgb2-rule-rates-2026",
    "source-sgb2-statistics",
    "source-sgb2-kdu-model",
  ],
  populationRunId: null,
  populationModelVersion: null,
  sgb2: cloneSgb2ScenarioReference(defaultSgb2ScenarioReference),
};

export interface ScenarioHistory { past: ScenarioDraft[]; present: ScenarioDraft; future: ScenarioDraft[]; }
export type ScenarioHistoryAction = { type: "change"; patch: Partial<ScenarioDraft> } | { type: "replace"; scenario: ScenarioDraft } | { type: "undo" } | { type: "redo" };

function cloneScenario(scenario: ScenarioDraft): ScenarioDraft {
  return {
    ...scenario,
    incomeTax: { ...scenario.incomeTax },
    revenueChanges: { ...scenario.revenueChanges },
    expenseChanges: { ...scenario.expenseChanges },
    effectParameters: { ...scenario.effectParameters },
    assumptions: [...scenario.assumptions],
    sourceIds: [...scenario.sourceIds],
    sgb2: cloneSgb2ScenarioReference(scenario.sgb2),
  };
}
function equalScenario(a: ScenarioDraft, b: ScenarioDraft) { return JSON.stringify(a) === JSON.stringify(b); }
export function createScenarioHistory(scenario = defaultScenarioDraft): ScenarioHistory { return { past: [], present: cloneScenario(scenario), future: [] }; }
export function scenarioHistoryReducer(state: ScenarioHistory, action: ScenarioHistoryAction): ScenarioHistory {
  if (action.type === "undo") { const previous = state.past.at(-1); return previous ? { past: state.past.slice(0, -1), present: cloneScenario(previous), future: [cloneScenario(state.present), ...state.future].slice(0, 50) } : state; }
  if (action.type === "redo") { const next = state.future[0]; return next ? { past: [...state.past, cloneScenario(state.present)].slice(-50), present: cloneScenario(next), future: state.future.slice(1) } : state; }
  const next = action.type === "replace" ? normalizeScenarioDraft(action.scenario) : normalizeScenarioDraft({ ...state.present, ...action.patch });
  return equalScenario(next, state.present) ? state : { past: [...state.past, cloneScenario(state.present)].slice(-50), present: cloneScenario(next), future: [] };
}
function numberOr(value: unknown, fallback: number) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
function stringArray(value: unknown, fallback: string[]) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : fallback; }
function nullableString(value: unknown) { return typeof value === "string" && value.trim() ? value : null; }
function numberRecord(value: unknown, fallback: Record<string, number>) {
  if (!value || typeof value !== "object") return { ...fallback };
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])));
}

export function normalizeScenarioDraft(value: Partial<ScenarioDraft> | ScenarioState | null | undefined): ScenarioDraft {
  const fallback = defaultScenarioDraft;
  const horizon = numberOr(value?.horizonYears, fallback.horizonYears);
  const allowedHorizons: TimeHorizon[] = [1, 5, 10, 20];
  const expenseChanges = numberRecord(value?.expenseChanges, {});
  const populationRunId = nullableString(value?.populationRunId);
  return {
    name: typeof value?.name === "string" && value.name.trim() ? value.name : fallback.name,
    description: typeof value?.description === "string" ? value.description : fallback.description,
    legalYear: numberOr(value?.legalYear, fallback.legalYear),
    dataYear: numberOr(value?.dataYear, fallback.dataYear),
    horizonYears: allowedHorizons.includes(horizon as TimeHorizon) ? horizon as TimeHorizon : fallback.horizonYears,
    modelLevel: value?.modelLevel === "statisch" || value?.modelLevel === "langfrist" || value?.modelLevel === "verhalten" ? value.modelLevel : fallback.modelLevel,
    revenueChanges: numberRecord(value?.revenueChanges, {}),
    expenseChanges,
    effectParameters: { ...fallback.effectParameters, ...numberRecord(value?.effectParameters, {}) },
    incomeTax: {
      allowance: numberOr(value?.incomeTax?.allowance, fallback.incomeTax.allowance),
      entryRate: numberOr(value?.incomeTax?.entryRate, fallback.incomeTax.entryRate),
      topRate: numberOr(value?.incomeTax?.topRate, fallback.incomeTax.topRate),
      topThreshold: numberOr(value?.incomeTax?.topThreshold, fallback.incomeTax.topThreshold),
      richRate: numberOr(value?.incomeTax?.richRate, fallback.incomeTax.richRate),
      childAllowance: numberOr(value?.incomeTax?.childAllowance, fallback.incomeTax.childAllowance),
      spouseSplitting: typeof value?.incomeTax?.spouseSplitting === "boolean" ? value.incomeTax.spouseSplitting : fallback.incomeTax.spouseSplitting,
    },
    assumptions: stringArray(value?.assumptions, fallback.assumptions),
    modelVersion: typeof value?.modelVersion === "string" ? value.modelVersion : fallback.modelVersion,
    sourceIds: stringArray(value?.sourceIds, fallback.sourceIds),
    populationRunId,
    populationModelVersion: nullableString(value?.populationModelVersion),
    sgb2: normalizeSgb2ScenarioReference(value?.sgb2, expenseChanges, populationRunId),
  };
}
export function scenarioToJson(scenario: ScenarioDraft) { return JSON.stringify({ schemaVersion: SCENARIO_SCHEMA_VERSION, scenario }, null, 2); }
export function scenarioFromJson(text: string): ScenarioDraft {
  const parsed = JSON.parse(text) as { schemaVersion?: unknown; scenario?: unknown };
  const supportedVersions = [1, 2, 3, SCENARIO_SCHEMA_VERSION];
  if (!supportedVersions.includes(parsed.schemaVersion as number) || !parsed.scenario || typeof parsed.scenario !== "object") throw new Error("Die Datei ist kein unterstütztes Deutschland-Simulator-Szenario.");
  const scenario = normalizeScenarioDraft(parsed.scenario as Partial<ScenarioDraft>);
  const sgb2Error = validateSgb2ScenarioReference(scenario.sgb2).find((issue) => issue.severity === "error");
  if (sgb2Error) throw new Error(`Bürgergeld-Szenario ungültig (${sgb2Error.code}): ${sgb2Error.message}`);
  return scenario;
}
