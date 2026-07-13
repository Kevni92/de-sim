import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_BASELINE_ID, generatePopulation } from "../src/lib/population-model";
import {
  SGB2_POPULATION_MODEL_VERSION,
  TARGET_SGB2_BENEFIT_UNITS,
  augmentPopulationRunWithSgb2,
  deriveSgb2Population,
} from "../src/lib/sgb2-population";

const options = { seed: "sgb2-population-test", sampleSize: 2_000, baselineId: DEFAULT_BASELINE_ID };

function generated() {
  return generatePopulation(options);
}

test("gleiche Bevölkerung erzeugt deterministische Bedarfsgemeinschaften", () => {
  const firstBase = generated();
  const secondBase = generated();
  const first = deriveSgb2Population(firstBase.run.metadata, firstBase.households, firstBase.persons);
  const second = deriveSgb2Population(secondBase.run.metadata, secondBase.households, secondBase.persons);
  assert.deepEqual(first.benefitUnits, second.benefitUnits);
  assert.deepEqual(first.personProfiles, second.personProfiles);
  assert.deepEqual(first.summary, second.summary);
});

test("Haushalte und Bedarfsgemeinschaften bleiben getrennt und stabil verknüpft", () => {
  const base = generated();
  const derived = deriveSgb2Population(base.run.metadata, base.households, base.persons);
  const householdIds = new Set(base.households.map((household) => household.id));
  const personIds = new Set(base.persons.map((person) => person.id));
  assert.equal(new Set(derived.benefitUnits.map((unit) => unit.id)).size, derived.benefitUnits.length);
  assert.ok(derived.benefitUnits.every((unit) => householdIds.has(unit.householdId)));
  assert.ok(derived.benefitUnits.every((unit) => unit.memberIds.every((id) => personIds.has(id))));
  const unitsByHousehold = new Map<string, number>();
  derived.benefitUnits.forEach((unit) => unitsByHousehold.set(unit.householdId, (unitsByHousehold.get(unit.householdId) ?? 0) + 1));
  assert.ok([...unitsByHousehold.values()].some((count) => count > 1));
  assert.equal(derived.validation.filter((issue) => issue.severity === "error").length, 0);
});

test("Einkommen und Wohnkosten werden aus Haushaltsmerkmalen abgeleitet", () => {
  const base = generated();
  const derived = deriveSgb2Population(base.run.metadata, base.households, base.persons);
  const receiving = derived.benefitUnits.filter((unit) => unit.receiptStatus === "bezug");
  assert.ok(receiving.every((unit) => unit.monthlyNeedProxyCents >= unit.housing.grossColdRentCents + unit.housing.heatingCostsCents));
  assert.ok(receiving.every((unit) => unit.housing.grossColdRentCents === unit.housing.baseRentCents + unit.housing.coldOperatingCostsCents));
  assert.ok(derived.personProfiles.every((profile) => profile.income.countableIncomeProxyCents >= 0));
  const singles = receiving.filter((unit) => unit.memberIds.length === 1);
  const larger = receiving.filter((unit) => unit.memberIds.length >= 3);
  const averageHousing = (items: typeof receiving) => items.reduce((sum, unit) => sum + unit.housing.grossColdRentCents + unit.housing.heatingCostsCents, 0) / Math.max(items.length, 1);
  assert.ok(singles.length > 0 && larger.length > 0);
  assert.ok(averageHousing(larger) > averageHousing(singles));
});

test("Bezugsmonate ermöglichen unterjährige Hochrechnung", () => {
  const base = generated();
  const derived = deriveSgb2Population(base.run.metadata, base.households, base.persons);
  const receiving = derived.benefitUnits.filter((unit) => unit.receiptStatus === "bezug");
  assert.ok(receiving.every((unit) => unit.benefitMonths >= 1 && unit.benefitMonths <= 12));
  assert.ok(receiving.every((unit) => unit.entryMonth !== null && unit.exitMonth !== null && unit.entryMonth >= 1 && unit.exitMonth <= 12));
  assert.ok(receiving.some((unit) => unit.benefitMonths < 12));
  assert.ok(derived.summary.averageBenefitMonths > 1 && derived.summary.averageBenefitMonths <= 12);
});

test("SGB-II-Randziele und Quellen erscheinen im Kalibrierungsbericht", () => {
  const base = generated();
  const derived = deriveSgb2Population(base.run.metadata, base.households, base.persons);
  assert.ok(Math.abs(derived.summary.weightedBenefitUnits - TARGET_SGB2_BENEFIT_UNITS) < 1);
  assert.ok(derived.calibration.some((entry) => entry.dimension === "SGB II · BG-Typ"));
  assert.ok(derived.calibration.some((entry) => entry.dimension === "SGB II · Personenstatus"));
  assert.ok(derived.calibration.every((entry) => entry.sourceId === "source-sgb2-statistics"));
  assert.ok(derived.calibration.some((entry) => entry.note?.includes("Gemeinsame Verteilungen")));
});

test("Worker-Persistenzobjekt enthält SGB-II-Schema, Aggregate und Qualitätsbericht", () => {
  const augmented = augmentPopulationRunWithSgb2(generated());
  assert.equal(augmented.run.metadata.sgb2ModelVersion, SGB2_POPULATION_MODEL_VERSION);
  assert.equal(augmented.run.sgb2Summary?.modelVersion, SGB2_POPULATION_MODEL_VERSION);
  assert.ok(augmented.run.summary.distributions.sgb2BenefitUnitType.length > 0);
  assert.ok(augmented.benefitUnits.length > 0);
  assert.equal(augmented.sgb2Persons.length, augmented.persons.length);
  assert.equal(augmented.run.validation.filter((issue) => issue.severity === "error").length, 0);
});
