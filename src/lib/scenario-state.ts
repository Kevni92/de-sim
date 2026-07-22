import { defaultEffectParameters } from "./long-term-effects";
import { defaultLongTermScenarioSettings } from "./long-term-scenario";
import type { PopulationBasisReference } from "./population-basis";
import {
  cloneSgb2ScenarioReference,
  defaultSgb2ScenarioReference,
  normalizeSgb2ScenarioReference,
  validateSgb2ScenarioReference,
} from "./sgb2-policy";
import type { ModelLevel, ScenarioDraft, ScenarioState, TimeHorizon } from "./types";

export const SCENARIO_SCHEMA_VERSION = 7;
export interface EffectRunReference {
  runId: string;
  modelVersion: string;
  populationRunId: string;
  modelLevel: ModelLevel;
  horizonYears: TimeHorizon;
  inputSignature: string;
  calculatedAt: string;
}
export type ScenarioDraftWithPopulationBasis = ScenarioDraft & {
  populationBasis: PopulationBasisReference | null;
  effectRunReference: EffectRunReference | null;
};
type ScenarioInput = Partial<ScenarioDraft> & { populationBasis?: unknown; effectRunReference?: unknown };

export const defaultScenarioDraft: ScenarioDraftWithPopulationBasis = {
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
  longTerm: { ...defaultLongTermScenarioSettings },
  populationBasis: null,
  effectRunReference: null,
  sgb2: cloneSgb2ScenarioReference(defaultSgb2ScenarioReference),
};

export interface ScenarioHistory { past: ScenarioDraftWithPopulationBasis[]; present: ScenarioDraftWithPopulationBasis; future: ScenarioDraftWithPopulationBasis[]; }
export type ScenarioHistoryAction =
  | { type: "change"; patch: Partial<ScenarioDraftWithPopulationBasis> }
  | { type: "sync"; patch: Partial<ScenarioDraftWithPopulationBasis> }
  | { type: "replace"; scenario: ScenarioInput }
  | { type: "undo" }
  | { type: "redo" };

function cloneScenario(scenario: ScenarioDraftWithPopulationBasis): ScenarioDraftWithPopulationBasis {
  return {
    ...scenario,
    incomeTax: { ...scenario.incomeTax },
    revenueChanges: { ...scenario.revenueChanges },
    expenseChanges: { ...scenario.expenseChanges },
    effectParameters: { ...scenario.effectParameters },
    assumptions: [...scenario.assumptions],
    sourceIds: [...scenario.sourceIds],
    populationBasis: scenario.populationBasis ? { ...scenario.populationBasis } : null,
    effectRunReference: scenario.effectRunReference ? { ...scenario.effectRunReference } : null,
    longTerm: { ...scenario.longTerm },
    sgb2: cloneSgb2ScenarioReference(scenario.sgb2),
  };
}
function equalScenario(a: ScenarioDraftWithPopulationBasis, b: ScenarioDraftWithPopulationBasis) { return JSON.stringify(a) === JSON.stringify(b); }
export function createScenarioHistory(scenario: ScenarioInput = defaultScenarioDraft): ScenarioHistory { return { past: [], present: cloneScenario(normalizeScenarioDraft(scenario)), future: [] }; }
export function scenarioHistoryReducer(state: ScenarioHistory, action: ScenarioHistoryAction): ScenarioHistory {
  if (action.type === "undo") { const previous = state.past.at(-1); return previous ? { past: state.past.slice(0, -1), present: cloneScenario(previous), future: [cloneScenario(state.present), ...state.future].slice(0, 50) } : state; }
  if (action.type === "redo") { const next = state.future[0]; return next ? { past: [...state.past, cloneScenario(state.present)].slice(-50), present: cloneScenario(next), future: state.future.slice(1) } : state; }
  const next = action.type === "replace" ? normalizeScenarioDraft(action.scenario) : normalizeScenarioDraft({ ...state.present, ...action.patch });
  if (equalScenario(next, state.present)) return state;
  if (action.type === "sync") return { ...state, present: cloneScenario(next) };
  return { past: [...state.past, cloneScenario(state.present)].slice(-50), present: cloneScenario(next), future: [] };
}
function numberOr(value: unknown, fallback: number) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
function stringArray(value: unknown, fallback: string[]) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : fallback; }
function nullableString(value: unknown) { return typeof value === "string" && value.trim() ? value : null; }
function nullablePositiveInteger(value: unknown) { return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null; }
function numberRecord(value: unknown, fallback: Record<string, number>) {
  if (!value || typeof value !== "object") return { ...fallback };
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])));
}
function normalizePopulationBasis(value: unknown, legacyRunId: string | null, legacyModelVersion: string | null): PopulationBasisReference | null {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : null;
  const runId = nullableString(record?.runId) ?? legacyRunId;
  if (!runId) return null;
  return {
    runId,
    modelVersion: nullableString(record?.modelVersion) ?? legacyModelVersion,
    seed: nullableString(record?.seed),
    sampleSize: nullablePositiveInteger(record?.sampleSize),
    baselineId: nullableString(record?.baselineId),
  };
}
function normalizeEffectRunReference(value: unknown): EffectRunReference | null {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : null;
  const runId = nullableString(record?.runId);
  const modelVersion = nullableString(record?.modelVersion);
  const populationRunId = nullableString(record?.populationRunId);
  const inputSignature = nullableString(record?.inputSignature);
  const calculatedAt = nullableString(record?.calculatedAt);
  const modelLevel = record?.modelLevel;
  const horizon = record?.horizonYears;
  if (!runId || !modelVersion || !populationRunId || !inputSignature || !calculatedAt) return null;
  if (modelLevel !== "statisch" && modelLevel !== "verhalten" && modelLevel !== "langfrist") return null;
  if (horizon !== 1 && horizon !== 5 && horizon !== 10 && horizon !== 20) return null;
  return { runId, modelVersion, populationRunId, inputSignature, calculatedAt, modelLevel, horizonYears: horizon };
}

export function normalizeScenarioDraft(value: ScenarioInput | ScenarioState | null | undefined): ScenarioDraftWithPopulationBasis {
  const fallback = defaultScenarioDraft;
  const horizon = numberOr(value?.horizonYears, fallback.horizonYears);
  const allowedHorizons: TimeHorizon[] = [1, 5, 10, 20];
  const expenseChanges = numberRecord(value?.expenseChanges, {});
  const legacyRunId = nullableString(value?.populationRunId);
  const legacyModelVersion = nullableString(value?.populationModelVersion);
  const populationBasis = normalizePopulationBasis((value as ScenarioInput | undefined)?.populationBasis, legacyRunId, legacyModelVersion);
  const populationRunId = populationBasis?.runId ?? legacyRunId;
  const populationModelVersion = populationBasis?.modelVersion ?? legacyModelVersion;
  const hasExplicitSgb2Reference = Boolean(value?.sgb2 && typeof value.sgb2 === "object");
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
    populationModelVersion,
    populationBasis,
    effectRunReference: normalizeEffectRunReference((value as ScenarioInput | undefined)?.effectRunReference),
    longTerm: {
      ...fallback.longTerm,
      ...(value?.longTerm && typeof value.longTerm === "object" ? value.longTerm : {}),
      targetYear: numberOr((value?.longTerm as { targetYear?: unknown } | undefined)?.targetYear, fallback.longTerm.targetYear),
      workingAgeStart: numberOr((value?.longTerm as { workingAgeStart?: unknown } | undefined)?.workingAgeStart, fallback.longTerm.workingAgeStart),
      retirementAge: numberOr((value?.longTerm as { retirementAge?: unknown } | undefined)?.retirementAge, fallback.longTerm.retirementAge),
      fertilityEffectPct: numberOr((value?.longTerm as { fertilityEffectPct?: unknown } | undefined)?.fertilityEffectPct, fallback.longTerm.fertilityEffectPct),
      migrationNetAnnual: numberOr((value?.longTerm as { migrationNetAnnual?: unknown } | undefined)?.migrationNetAnnual, fallback.longTerm.migrationNetAnnual),
      protectionSharePct: numberOr((value?.longTerm as { protectionSharePct?: unknown } | undefined)?.protectionSharePct, fallback.longTerm.protectionSharePct),
      accessDelayYears: numberOr((value?.longTerm as { accessDelayYears?: unknown } | undefined)?.accessDelayYears, fallback.longTerm.accessDelayYears),
      participationRatePct: numberOr((value?.longTerm as { participationRatePct?: unknown } | undefined)?.participationRatePct, fallback.longTerm.participationRatePct),
      employmentRatePct: numberOr((value?.longTerm as { employmentRatePct?: unknown } | undefined)?.employmentRatePct, fallback.longTerm.employmentRatePct),
      workTimeFactorPct: numberOr((value?.longTerm as { workTimeFactorPct?: unknown } | undefined)?.workTimeFactorPct, fallback.longTerm.workTimeFactorPct),
      contributionRatePct: numberOr((value?.longTerm as { contributionRatePct?: unknown } | undefined)?.contributionRatePct, fallback.longTerm.contributionRatePct),
      averageAnnualWage: numberOr((value?.longTerm as { averageAnnualWage?: unknown } | undefined)?.averageAnnualWage, fallback.longTerm.averageAnnualWage),
      pensionBenefitRatePct: numberOr((value?.longTerm as { pensionBenefitRatePct?: unknown } | undefined)?.pensionBenefitRatePct, fallback.longTerm.pensionBenefitRatePct),
      federalGrantBn: numberOr((value?.longTerm as { federalGrantBn?: unknown } | undefined)?.federalGrantBn, fallback.longTerm.federalGrantBn),
      preset: (value?.longTerm as { preset?: unknown } | undefined)?.preset === "niedrigere-nettozuwanderung" || (value?.longTerm as { preset?: unknown } | undefined)?.preset === "hoehere-nettozuwanderung" || (value?.longTerm as { preset?: unknown } | undefined)?.preset === "frueherer-arbeitsmarktzugang" || (value?.longTerm as { preset?: unknown } | undefined)?.preset === "spaeteres-rentenalter" || (value?.longTerm as { preset?: unknown } | undefined)?.preset === "familienpolitischer-wirkungspfad" || (value?.longTerm as { preset?: unknown } | undefined)?.preset === "amtliche-referenz" ? (value?.longTerm as { preset: typeof fallback.longTerm.preset }).preset : fallback.longTerm.preset,
      fertilityEffectStatus: (value?.longTerm as { fertilityEffectStatus?: unknown } | undefined)?.fertilityEffectStatus === "gerichteter-zusammenhang" || (value?.longTerm as { fertilityEffectStatus?: unknown } | undefined)?.fertilityEffectStatus === "szenarioband-berechenbar" ? (value?.longTerm as { fertilityEffectStatus: typeof fallback.longTerm.fertilityEffectStatus }).fertilityEffectStatus : fallback.longTerm.fertilityEffectStatus,
    },
    sgb2: normalizeSgb2ScenarioReference(value?.sgb2, hasExplicitSgb2Reference ? undefined : expenseChanges, populationRunId),
  };
}
export function scenarioToJson(scenario: ScenarioDraftWithPopulationBasis) { return JSON.stringify({ schemaVersion: SCENARIO_SCHEMA_VERSION, scenario }, null, 2); }
export function scenarioFromJson(text: string): ScenarioDraftWithPopulationBasis {
  const parsed = JSON.parse(text) as { schemaVersion?: unknown; scenario?: unknown };
  const supportedVersions = [1, 2, 3, 4, 5, 6, SCENARIO_SCHEMA_VERSION];
  if (!supportedVersions.includes(parsed.schemaVersion as number) || !parsed.scenario || typeof parsed.scenario !== "object") throw new Error("Die Datei ist kein unterstütztes Deutschland-Simulator-Szenario.");
  const scenario = normalizeScenarioDraft(parsed.scenario as ScenarioInput);
  const sgb2Error = validateSgb2ScenarioReference(scenario.sgb2).find((issue) => issue.severity === "error");
  if (sgb2Error) throw new Error(`Bürgergeld-Szenario ungültig (${sgb2Error.code}): ${sgb2Error.message}`);
  return scenario;
}
