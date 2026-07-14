import assert from "node:assert/strict";
import test from "node:test";
import { statutoryIncomeTax2026 } from "../src/lib/income-tax";
import {
  populationBasisFromRun,
  populationBasisOptions,
  populationRunIdForOptions,
  STANDARD_POPULATION_OPTIONS,
} from "../src/lib/population-basis";
import {
  DEFAULT_BASELINE_ID,
  POPULATION_MODEL_VERSION,
  TARGET_HOUSEHOLDS,
  TARGET_POPULATION,
  createDeterministicRandom,
  estimatePopulationIncomeTax,
  generatePopulation,
  queryPopulation,
} from "../src/lib/population-model";
import { SCENARIO_SCHEMA_VERSION, defaultScenarioDraft, scenarioFromJson, scenarioToJson } from "../src/lib/scenario-state";

const options = { seed: "test-seed-7", sampleSize: 500, baselineId: DEFAULT_BASELINE_ID };

test("deterministischer Zufallsgenerator reproduziert Sequenzen", () => {
  const first = createDeterministicRandom("identisch");
  const second = createDeterministicRandom("identisch");
  assert.deepEqual(Array.from({ length: 12 }, () => first()), Array.from({ length: 12 }, () => second()));
});

test("gleicher Seed erzeugt dieselbe synthetische Bevölkerung", () => {
  const first = generatePopulation(options);
  const second = generatePopulation(options);
  assert.equal(first.run.metadata.id, second.run.metadata.id);
  assert.equal(first.run.metadata.modelVersion, POPULATION_MODEL_VERSION);
  assert.deepEqual(first.persons, second.persons);
  assert.deepEqual(first.households, second.households);
  assert.deepEqual(first.run.summary.distributions, second.run.summary.distributions);
});

test("anderer Seed verändert Mikrodaten bei stabilen Zielaggregaten", () => {
  const first = generatePopulation(options);
  const second = generatePopulation({ ...options, seed: "anderer-seed" });
  assert.notDeepEqual(first.persons.slice(0, 12), second.persons.slice(0, 12));
  assert.ok(Math.abs(first.run.summary.weightedPopulation - TARGET_POPULATION) < 1);
  assert.ok(Math.abs(second.run.summary.weightedPopulation - TARGET_POPULATION) < 1);
  assert.ok(Math.abs(first.run.summary.weightedHouseholds - TARGET_HOUSEHOLDS) < 1);
  assert.ok(Math.abs(second.run.summary.weightedHouseholds - TARGET_HOUSEHOLDS) < 1);
  assert.ok(first.run.calibration.every((entry) => Number.isFinite(entry.relativeDeviation)));
  assert.ok(second.run.calibration.every((entry) => Number.isFinite(entry.relativeDeviation)));
});

test("Haushalte, Personen und Gewichte bestehen die Konsistenzprüfung", () => {
  const generated = generatePopulation(options);
  assert.equal(generated.run.summary.validationErrors, 0);
  assert.ok(generated.persons.every((person) => person.weight > 0 && Number.isFinite(person.weight)));
  assert.ok(generated.households.every((household) => household.weight > 0 && Number.isFinite(household.weight)));
  const householdIds = new Set(generated.households.map((household) => household.id));
  assert.ok(generated.persons.every((person) => householdIds.has(person.householdId)));
});

test("Aggregation liefert gewichtete Gruppen und Medianwerte", () => {
  const generated = generatePopulation(options);
  const count = queryPopulation(generated.run.metadata.id, generated.persons, generated.households, {
    entity: "households", groupBy: "householdType", measure: "count",
  });
  const median = queryPopulation(generated.run.metadata.id, generated.persons, generated.households, {
    entity: "households", groupBy: "housingStatus", measure: "median", field: "disposableIncome",
  });
  assert.ok(Math.abs(count.items.reduce((sum, item) => sum + item.value, 0) - TARGET_HOUSEHOLDS) < 1);
  assert.ok(median.items.every((item) => item.value >= 0 && Number.isFinite(item.value)));
});

test("Einkommensteuer nutzt den Bevölkerungslauf und reagiert auf Tarifänderungen", () => {
  const generated = generatePopulation(options);
  const baseline = estimatePopulationIncomeTax(generated.run.metadata, generated.persons, generated.households, statutoryIncomeTax2026, "statisch");
  const reform = estimatePopulationIncomeTax(generated.run.metadata, generated.persons, generated.households, { ...statutoryIncomeTax2026, allowance: 15_000 }, "statisch");
  assert.equal(baseline.populationRunId, generated.run.metadata.id);
  assert.equal(baseline.populationSampleSize, generated.run.metadata.sampleSize);
  assert.notEqual(reform.staticValue, baseline.staticValue);
  assert.equal(reform.deciles.length, 10);
  assert.ok(Number.isFinite(reform.medianMonthlyChange));
});

test("Standard-Modellbasis besitzt eine stabile ID und eine rekonstruierbare Referenz", () => {
  const generated = generatePopulation(STANDARD_POPULATION_OPTIONS);
  assert.equal(generated.run.metadata.id, populationRunIdForOptions(STANDARD_POPULATION_OPTIONS));
  const reference = populationBasisFromRun(generated.run);
  assert.deepEqual(populationBasisOptions(reference), STANDARD_POPULATION_OPTIONS);
  assert.equal(populationBasisOptions({ ...reference, modelVersion: "veraltet" }), null);
});

test("Szenarioexport erhält Referenz und Rekonstruktionsmetadaten", () => {
  const generated = generatePopulation(options);
  const reference = populationBasisFromRun(generated.run);
  const json = scenarioToJson({
    ...defaultScenarioDraft,
    populationRunId: reference.runId,
    populationModelVersion: reference.modelVersion,
    populationBasis: reference,
    sgb2: { ...defaultScenarioDraft.sgb2, populationRunId: reference.runId },
  });
  const parsed = JSON.parse(json) as { schemaVersion: number };
  assert.equal(parsed.schemaVersion, SCENARIO_SCHEMA_VERSION);
  const restored = scenarioFromJson(json);
  assert.deepEqual(restored.populationBasis, reference);
  assert.equal(restored.populationRunId, reference.runId);
});

test("ältere Szenarien behalten fehlende Laufreferenzen ohne erfundene Rekonstruktionsdaten", () => {
  const restored = scenarioFromJson(JSON.stringify({
    schemaVersion: 4,
    scenario: { ...defaultScenarioDraft, populationBasis: undefined, populationRunId: "population-fehlt", populationModelVersion: POPULATION_MODEL_VERSION },
  }));
  assert.deepEqual(restored.populationBasis, {
    runId: "population-fehlt",
    modelVersion: POPULATION_MODEL_VERSION,
    seed: null,
    sampleSize: null,
    baselineId: null,
  });
  assert.equal(populationBasisOptions(restored.populationBasis), null);
});
