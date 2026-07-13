import assert from "node:assert/strict";
import test from "node:test";
import { calculateEffectRun, defaultEffectParameters, mergeEffectParameters, readEffectParameters } from "../src/lib/long-term-effects";
import type { SyntheticHousehold, SyntheticPerson } from "../src/lib/types";

const households: SyntheticHousehold[] = [
  { id: "h1", runId: "run", householdType: "paar-mit-kindern", adultCount: 2, childCount: 1, childAges: [3], employmentConstellation: "zwei-erwerbspersonen", grossIncome: 70000, disposableIncome: 50000, transferComponents: {}, housingStatus: "miete", grossColdRent: 12000, housingCosts: 15000, wealth: 20000, debt: 0, federalState: "BE", communityType: "grossstadt", weight: 1000 },
  { id: "h2", runId: "run", householdType: "alleinerziehend", adultCount: 1, childCount: 1, childAges: [2], employmentConstellation: "teilzeit", grossIncome: 30000, disposableIncome: 26000, transferComponents: {}, housingStatus: "miete", grossColdRent: 9000, housingCosts: 11000, wealth: 2000, debt: 0, federalState: "NW", communityType: "staedtisch", weight: 500 },
  { id: "h3", runId: "run", householdType: "rentnerhaushalt", adultCount: 1, childCount: 0, childAges: [], employmentConstellation: "rente", grossIncome: 24000, disposableIncome: 22000, transferComponents: {}, housingStatus: "eigentum", grossColdRent: 0, housingCosts: 5000, wealth: 150000, debt: 0, federalState: "BY", communityType: "laendlich", weight: 800 },
];
const person = (overrides: Partial<SyntheticPerson>): SyntheticPerson => ({ id: "p", runId: "run", householdId: "h1", age: 35, ageGroup: "30-44", householdRole: "elternteil", employmentStatus: "erwerbstaetig", workTimeStatus: "vollzeit", grossEmploymentIncome: 40000, otherTaxableIncome: 0, pensionIncome: 0, transferIncome: 0, socialInsuranceIncome: 40000, taxableIncome: 35000, weight: 1000, federalState: "BE", communityType: "grossstadt", incomeDecile: 6, ...overrides });
const persons: SyntheticPerson[] = [
  person({ id: "p1" }),
  person({ id: "p2", age: 34, workTimeStatus: "teilzeit", grossEmploymentIncome: 25000 }),
  person({ id: "c1", age: 3, ageGroup: "0-17", householdRole: "kind", employmentStatus: "bildung", workTimeStatus: "nicht-zutreffend", grossEmploymentIncome: 0, socialInsuranceIncome: 0, taxableIncome: 0 }),
  person({ id: "p3", householdId: "h2", weight: 500, workTimeStatus: "teilzeit", grossEmploymentIncome: 28000 }),
  person({ id: "c2", householdId: "h2", weight: 500, age: 2, ageGroup: "0-17", householdRole: "kind", employmentStatus: "bildung", workTimeStatus: "nicht-zutreffend", grossEmploymentIncome: 0, socialInsuranceIncome: 0, taxableIncome: 0 }),
  person({ id: "p4", householdId: "h3", weight: 800, age: 72, ageGroup: "65-79", householdRole: "alleinlebend", employmentStatus: "rente", workTimeStatus: "nicht-zutreffend", grossEmploymentIncome: 0, pensionIncome: 24000, socialInsuranceIncome: 0, taxableIncome: 20000 }),
];

const input = { scenarioId: "scenario", populationRunId: "run", modelLevel: "langfrist" as const, horizonYears: 10, dataYear: 2025, legalYear: 2026, parameters: defaultEffectParameters };

test("erzeugt vollständige, geordnete und bandbegrenzte Wirkungsergebnisse", () => {
  const run = calculateEffectRun(input, persons, households);
  assert.equal(run.moduleResults.length, 11);
  const kita = run.moduleResults.find((item) => item.moduleId === "kita-betreuung")!;
  assert.equal(kita.affectedHouseholds, 1500);
  assert.equal(kita.timeSeries.length, 11);
  for (const point of kita.timeSeries) assert.ok(point.lower <= point.scenarioValue && point.scenarioValue <= point.upper);
  assert.ok(kita.nonMonetaryEffects.some((item) => item.label === "Zusätzliche Beschäftigung"));
});

test("statische Modellstufe unterdrückt Verhaltens- und Langfristwirkung", () => {
  const run = calculateEffectRun({ ...input, modelLevel: "statisch" }, persons, households);
  const kita = run.moduleResults.find((item) => item.moduleId === "kita-betreuung")!;
  assert.equal(kita.indirectEffect, 0);
  assert.equal(kita.longTermEffect, 0);
  assert.equal(kita.feedbackEffect, 0);
  assert.ok(kita.directEffect < 0);
});

test("nicht ausreichend belegte Bereiche bleiben ohne Punktprognose", () => {
  const run = calculateEffectRun(input, persons, households);
  const migration = run.moduleResults.find((item) => item.moduleId === "migration-integration")!;
  const demography = run.moduleResults.find((item) => item.moduleId === "geburten-demografie")!;
  assert.equal(migration.evidenceStatus, "nicht-ausreichend-belegt");
  assert.equal(migration.totalEffect, 0);
  assert.equal(demography.evidenceStatus, "nicht-berechnet");
});

test("namespaced Parameter bleiben im zentralen Szenario-Record erhalten", () => {
  const changes = mergeEffectParameters({ ust: 1.2 }, { ...defaultEffectParameters, "kita.capacityChangePct": 8 });
  assert.equal(changes.ust, 1.2);
  assert.equal(changes["effect:kita.capacityChangePct"], 8);
  assert.equal(readEffectParameters(changes)["kita.capacityChangePct"], 8);
});
