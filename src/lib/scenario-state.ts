import type { ScenarioDraft, ScenarioState, TimeHorizon } from "./types";

export const SCENARIO_SCHEMA_VERSION = 1;

export const defaultScenarioDraft: ScenarioDraft = {
  name: "Reformentwurf A",
  description: "Arbeitsstand für eine neutrale Simulation des Staatshaushalts mit Einkommensteuer und weiteren Einnahmemodulen.",
  legalYear: 2026,
  dataYear: 2025,
  horizonYears: 5,
  modelLevel: "verhalten",
  revenueChanges: {},
  expenseChanges: {},
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
    "Weitere Einnahmen werden als getrennte Aggregatmodelle mit amtlichen Tarif- und Beitragsparametern berechnet.",
    "Statische Erstwirkung, Verhaltensreaktion, Inzidenz und Unsicherheit werden getrennt ausgewiesen.",
    "Aufkommens- und Verteilungsmodelle sind keine individuelle Steuer- oder Beitragsberatung.",
  ],
  modelVersion: "revenue-modules-0.5.0",
  sourceIds: ["source-budget", "source-est", "source-income-reference", "source-revenue-model"],
};

export interface ScenarioHistory {
  past: ScenarioDraft[];
  present: ScenarioDraft;
  future: ScenarioDraft[];
}

export type ScenarioHistoryAction =
  | { type: "change"; patch: Partial<ScenarioDraft> }
  | { type: "replace"; scenario: ScenarioDraft }
  | { type: "undo" }
  | { type: "redo" };

function cloneScenario(scenario: ScenarioDraft): ScenarioDraft {
  return {
    ...scenario,
    incomeTax: { ...scenario.incomeTax },
    revenueChanges: { ...scenario.revenueChanges },
    expenseChanges: { ...scenario.expenseChanges },
    assumptions: [...scenario.assumptions],
    sourceIds: [...scenario.sourceIds],
  };
}

function equalScenario(a: ScenarioDraft, b: ScenarioDraft) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function createScenarioHistory(scenario = defaultScenarioDraft): ScenarioHistory {
  return { past: [], present: cloneScenario(scenario), future: [] };
}

export function scenarioHistoryReducer(state: ScenarioHistory, action: ScenarioHistoryAction): ScenarioHistory {
  if (action.type === "undo") {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return {
      past: state.past.slice(0, -1),
      present: cloneScenario(previous),
      future: [cloneScenario(state.present), ...state.future].slice(0, 50),
    };
  }

  if (action.type === "redo") {
    const next = state.future[0];
    if (!next) return state;
    return {
      past: [...state.past, cloneScenario(state.present)].slice(-50),
      present: cloneScenario(next),
      future: state.future.slice(1),
    };
  }

  const next = action.type === "replace"
    ? normalizeScenarioDraft(action.scenario)
    : normalizeScenarioDraft({ ...state.present, ...action.patch });

  if (equalScenario(next, state.present)) return state;

  return {
    past: [...state.past, cloneScenario(state.present)].slice(-50),
    present: cloneScenario(next),
    future: [],
  };
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : fallback;
}

export function normalizeScenarioDraft(value: Partial<ScenarioDraft> | ScenarioState | null | undefined): ScenarioDraft {
  const fallback = defaultScenarioDraft;
  const horizon = numberOr(value?.horizonYears, fallback.horizonYears);
  const allowedHorizons: TimeHorizon[] = [1, 5, 10, 20];

  return {
    name: typeof value?.name === "string" && value.name.trim() ? value.name : fallback.name,
    description: typeof value?.description === "string" ? value.description : fallback.description,
    legalYear: numberOr(value?.legalYear, fallback.legalYear),
    dataYear: numberOr(value?.dataYear, fallback.dataYear),
    horizonYears: allowedHorizons.includes(horizon as TimeHorizon) ? horizon as TimeHorizon : fallback.horizonYears,
    modelLevel: value?.modelLevel === "statisch" || value?.modelLevel === "langfrist" || value?.modelLevel === "verhalten" ? value.modelLevel : fallback.modelLevel,
    revenueChanges: value?.revenueChanges && typeof value.revenueChanges === "object" ? { ...value.revenueChanges } : {},
    expenseChanges: value?.expenseChanges && typeof value.expenseChanges === "object" ? { ...value.expenseChanges } : {},
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
  };
}

export function scenarioToJson(scenario: ScenarioDraft) {
  return JSON.stringify({ schemaVersion: SCENARIO_SCHEMA_VERSION, scenario }, null, 2);
}

export function scenarioFromJson(text: string): ScenarioDraft {
  const parsed = JSON.parse(text) as { schemaVersion?: unknown; scenario?: unknown };
  if (parsed.schemaVersion !== SCENARIO_SCHEMA_VERSION || !parsed.scenario || typeof parsed.scenario !== "object") {
    throw new Error("Die Datei ist kein unterstütztes Deutschland-Simulator-Szenario.");
  }
  return normalizeScenarioDraft(parsed.scenario as Partial<ScenarioDraft>);
}
