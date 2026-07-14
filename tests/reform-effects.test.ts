import assert from "node:assert/strict";
import test from "node:test";
import { calculateExpenseModules, expenseParameterKey } from "../src/lib/expense-modules";
import type { EffectModuleResult, EffectRun } from "../src/lib/long-term-effects";
import { activeReformContextKeys, contextualEffectsFor, deriveReformEffectParameters, effectInputSignature, effectLinksForContext, summarizeScenarioEffects } from "../src/lib/reform-effects";
import { revenueParameterKey } from "../src/lib/revenue-modules";
import { defaultScenarioDraft } from "../src/lib/scenario-state";

const result = (moduleId: string, patch: Partial<EffectModuleResult> = {}): EffectModuleResult => ({
  moduleId, title: moduleId, period: { fromYear: 2025, toYear: 2045 }, baselineValue: 0, directEffect: 0,
  indirectEffect: 0, longTermEffect: 0, feedbackEffect: 0, totalEffect: 0, lower: 0, central: 0, upper: 0,
  affectedPersons: 0, affectedHouseholds: 0, monetaryEffect: 0, nonMonetaryEffects: [], relevantGroups: [],
  evidenceStatus: "modellrechnung", causality: "modelliert", warnings: [], assumptions: [], modelVersion: "0.8.0",
  populationRunId: "population-test", scenarioId: "scenario-test", timeSeries: [], ...patch,
});
const run = (moduleResults: EffectModuleResult[]): EffectRun => ({ id: "effect-test", scenarioId: "scenario-test", populationRunId: "population-test", modelVersion: "0.8.0", modelLevel: "langfrist", horizonYears: 20, dataYear: 2025, legalYear: 2026, createdAt: "2026-07-14T12:00:00.000Z", inputSignature: "signature-test", parameters: {}, moduleResults, warnings: [] });

test("ordnet Umsatzsteuer und Familienausgaben explizit zu", () => {
  assert.equal(effectLinksForContext("revenue:ust")[0].id, "vat-price-consumption");
  const family = effectLinksForContext("expense:family");
  assert.deepEqual(family.map((item) => item.effectModuleId ?? item.id), ["kita-betreuung", "arbeitsvolumen", "geburten-demografie"]);
  assert.equal(family[0].aggregation, "primary");
  assert.equal(family[1].aggregation, "reference-only");
});

test("zeigt die Umsatzsteuerwirkung ohne Punktwert", () => {
  const [view] = contextualEffectsFor("revenue:ust", null);
  assert.equal(view.status, "directional");
  assert.equal(view.value, null);
  assert.match(view.explanation, /kein scheinpräziser Punktwert/i);
});

test("zählt abhängige Kita- und Arbeitsvolumenpfade nicht doppelt", () => {
  const summary = summarizeScenarioEffects(["expense:family"], run([
    result("kita-betreuung", { indirectEffect: 2, longTermEffect: 1, feedbackEffect: 0.5, central: 3.5, lower: 2, upper: 5, nonMonetaryEffects: [{ label: "Plätze", value: 25000, unit: "Plätze" }] }),
    result("arbeitsvolumen", { indirectEffect: 5, longTermEffect: 2, feedbackEffect: 1, central: 8, lower: 4, upper: 12 }),
    result("geburten-demografie", { evidenceStatus: "nicht-berechnet", causality: "hypothetisch" }),
  ]));
  assert.equal(summary.shortTerm, 2);
  assert.equal(summary.longTerm, 1);
  assert.equal(summary.feedback, 0.5);
  assert.equal(summary.nonMonetaryEffects.length, 1);
  assert.equal(summary.unavailableCount, 1);
});

test("leitet Parameter und Signatur reproduzierbar aus Reformen ab", () => {
  const scenario = { ...defaultScenarioDraft, revenueChanges: { [revenueParameterKey("ust", "standardRate")]: 20 }, expenseChanges: { [expenseParameterKey("family", "placesIndex")]: 112, [expenseParameterKey("family", "qualityIndex")]: 120, [expenseParameterKey("health", "preventionSavings")]: 10 } };
  assert.deepEqual(activeReformContextKeys(scenario), ["revenue:ust", "expense:family", "expense:health"]);
  const parameters = deriveReformEffectParameters(scenario, calculateExpenseModules(scenario.expenseChanges, scenario.modelLevel));
  assert.equal(parameters["kita.capacityChangePct"], 12);
  assert.equal(parameters["kita.openingHoursChange"], 2);
  assert.equal(parameters["sickness.daysReduction"], 1.5);
  const first = effectInputSignature({ scenario, populationRunId: "population-a", parameters });
  assert.equal(first, effectInputSignature({ scenario, populationRunId: "population-a", parameters: { ...parameters } }));
  assert.notEqual(first, effectInputSignature({ scenario, populationRunId: "population-b", parameters }));
});
