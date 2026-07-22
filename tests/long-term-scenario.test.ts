import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_AGE,
  createDefaultStartPopulation,
  defaultProjectionInput,
  isProjectionCurrent,
  markProjectionStatus,
  projectDemography,
  validateDemographyInput,
  calculateFamilyFertilityPath,
  calculateFamilyReformImpact,
  calculateMigrationPath,
  calculateLabourPath,
} from "../src/lib/long-term-scenario";

test("Kohorten alternieren mit stabiler 100+-Gruppe", () => {
  const input = defaultProjectionInput("test", 2028);
  input.startPopulation = { female: Array(MAX_AGE + 1).fill(0), male: Array(MAX_AGE + 1).fill(0) };
  input.startPopulation.female[0] = 100;
  input.startPopulation.female[99] = 20;
  input.startPopulation.male[100] = 30;
  for (const assumption of [input.baseline, input.scenario, ...Object.values(input.variants)]) {
    assumption.fertilityByAge.fill(0);
    assumption.immigrationByAge.fill(0);
    assumption.emigrationByAge.fill(0);
    assumption.survivalBySex.female.fill(1);
    assumption.survivalBySex.male.fill(1);
  }
  const run = projectDemography(input);
  assert.equal(run.scenario[1].byAge.female[1], 100);
  assert.equal(run.scenario[1].byAge.female[100], 20);
  assert.equal(run.scenario[1].byAge.male[100], 30);
  assert.equal(run.scenario[2].population, 150);
});

test("Geburten, Sterbefälle und Migration bleiben getrennt prüfbar", () => {
  const input = defaultProjectionInput("events", 2027);
  input.startPopulation = { female: Array(MAX_AGE + 1).fill(0), male: Array(MAX_AGE + 1).fill(0) };
  input.startPopulation.female[30] = 100;
  input.startPopulation.male[30] = 100;
  for (const assumption of [input.baseline, input.scenario, ...Object.values(input.variants)]) {
    assumption.fertilityByAge.fill(0);
    assumption.fertilityByAge[30] = 0.1;
    assumption.immigrationByAge.fill(0);
    assumption.immigrationByAge[30] = 10;
    assumption.emigrationByAge.fill(0);
    assumption.emigrationByAge[30] = 4;
    assumption.survivalBySex.female.fill(1);
    assumption.survivalBySex.male.fill(1);
    assumption.survivalBySex.female[30] = 0.9;
  }
  const point = projectDemography(input).scenario[1];
  assert.equal(point.births, 10);
  assert.equal(point.deaths, 10);
  assert.equal(point.immigration, 10);
  assert.equal(point.emigration, 4);
  assert.equal(point.migrationBalance, 6);
});

test("Signatur ist reproduzierbar und Änderungen machen den Lauf veraltet", () => {
  const input = defaultProjectionInput("signature", 2027);
  const first = projectDemography(input);
  const second = projectDemography({ ...input, startPopulation: createDefaultStartPopulation() });
  assert.equal(first.inputSignature, second.inputSignature);
  assert.equal(isProjectionCurrent(first, input), true);
  input.retirementAge = 68;
  assert.equal(markProjectionStatus(first, input).status, "veraltet");
});

test("Ungültige Kohorten und Altersgrenzen werden abgelehnt", () => {
  const input = defaultProjectionInput("invalid", 2027);
  input.retirementAge = 18;
  input.startPopulation.female[2] = -1;
  const issues = validateDemographyInput(input);
  assert.ok(issues.some((issue) => issue.code === "invalid-age-boundaries"));
  assert.ok(issues.some((issue) => issue.code === "invalid-population"));
});

test("Familienwirkung bleibt ohne Evidenz sichtbar, aber ohne Punktwert", () => {
  const path = calculateFamilyFertilityPath({
    status: "nicht-berechnet",
    effectPct: 10,
    onsetYears: 2,
    durationYears: 5,
    baseYear: 2026,
    targetYear: 2040,
    annualBirthBaseline: 700_000,
    sourceIds: ["source-family-fertility"],
    workingAgeStart: 20,
  });
  assert.equal(path.points[5].additionalBirths, null);
  assert.equal(path.points[5].earliestWorkingAgeYear, null);
  assert.deepEqual(path.additionalBirthsByVariant.central, {});
});

test("Quantifizierbarer Familienpfad hat Anlauf, Bandbreite und Kohortenübergang", () => {
  const path = calculateFamilyFertilityPath({
    status: "szenarioband-berechenbar",
    effectPct: 10,
    onsetYears: 2,
    durationYears: 4,
    baseYear: 2026,
    targetYear: 2050,
    annualBirthBaseline: 700_000,
    sourceIds: ["source-family-fertility"],
    workingAgeStart: 20,
  });
  const point = path.points.find((item) => item.year === 2030)!;
  assert.ok((point.additionalBirths ?? 0) > 0);
  assert.ok((point.lowerBirths ?? 0) < (point.additionalBirths ?? 0));
  assert.equal(point.earliestWorkingAgeYear, 2050);
  assert.equal(path.additionalBirthsByVariant.central[2030], point.additionalBirths);
});

test("Direkte Familienausgaben bleiben von der Langfristwirkung getrennt", () => {
  const impact = calculateFamilyReformImpact({
    benefitChangePct: 10,
    familyBaselineBn: 55.3,
    fertility: {
      status: "gerichteter-zusammenhang",
      effectPct: 10,
      onsetYears: 3,
      durationYears: 5,
      baseYear: 2026,
      targetYear: 2070,
      annualBirthBaseline: 700_000,
      sourceIds: ["source-family-fertility"],
      workingAgeStart: 20,
    },
  });
  assert.equal(impact.directBudgetDeltaBn, 5.53);
  assert.equal(impact.fertilityPath.points.at(-1)?.additionalBirths, null);
});

test("Migrationspfad trennt Berechtigung, Beschäftigung und Beiträge", () => {
  const path = calculateMigrationPath({
    baseYear: 2026,
    targetYear: 2028,
    annualArrivals: 1000,
    protectionSharePct: 100,
    ageProfile: Array(MAX_AGE + 1).fill(0).map((_, age) => age === 30 ? 1 : 0),
    accessPreset: "rechtsstand-des-szenarios",
    accessDelayYears: 1,
    participationRatePct: 80,
    employmentRatePct: 50,
    workTimeFactorPct: 75,
    averageAnnualWage: 40_000,
    taxRatePct: 20,
    contributionRatePct: 18.6,
    transferRateWhenNotEmployedPct: 100,
    workingAgeStart: 20,
    retirementAge: 67,
    legalYear: 2026,
    sourceIds: ["source-migration-statistics"],
  });
  assert.equal(path.points[0].legallyEligible, 0);
  assert.equal(path.points[0].taxes, 0);
  assert.ok(path.points[1].legallyEligible > 0);
  assert.ok(path.points[1].employed > 0);
  assert.ok(path.points[1].socialContributions > 0);
});

test("Früher Zugang erhöht Berechtigung, aber nicht automatisch Beschäftigung", () => {
  const base = {
    baseYear: 2026,
    targetYear: 2026,
    annualArrivals: 1000,
    protectionSharePct: 100,
    ageProfile: Array(MAX_AGE + 1).fill(0).map((_, age) => age === 30 ? 1 : 0),
    participationRatePct: 0,
    employmentRatePct: 0,
    workTimeFactorPct: 80,
    averageAnnualWage: 40_000,
    taxRatePct: 20,
    contributionRatePct: 18.6,
    transferRateWhenNotEmployedPct: 100,
    workingAgeStart: 20,
    retirementAge: 67,
    legalYear: 2026,
    sourceIds: [],
  } as const;
  const path = calculateMigrationPath({ ...base, sourceIds: [], accessPreset: "vereinfachter-frueher-zugang", accessDelayYears: 2 });
  assert.equal(path.points[0].legallyEligible, 1000);
  assert.equal(path.points[0].employed, 0);
  assert.equal(path.points[0].socialContributions, 0);
});

test("Erwerbspfad trennt alle Übergangsstufen", () => {
  const projection = projectDemography(defaultProjectionInput("labour", 2028));
  const path = calculateLabourPath({
    population: projection.scenario,
    retirementAge: 67,
    participationRatePct: 80,
    employmentRatePct: 90,
    workTimeFactorPct: 75,
    contributionRatePct: 18.6,
    averageAnnualWage: 45_000,
    populationIncludesMigration: false,
    sourceIds: ["source-population-model"],
  });
  const point = path.points[1];
  assert.ok(point.workingAge > point.demographicPotential);
  assert.ok(point.demographicPotential >= point.availableWorkers * 0.9);
  assert.ok(point.availableWorkers >= point.employed);
  assert.ok(point.employed >= point.fullTimeEquivalents);
  assert.equal(point.contributors, point.employed);
});

test("Nullbeteiligung führt trotz Erwerbsalter zu null Erwerbspersonen", () => {
  const projection = projectDemography(defaultProjectionInput("zero", 2027));
  const point = calculateLabourPath({
    population: projection.scenario,
    retirementAge: 67,
    participationRatePct: 0,
    employmentRatePct: 100,
    workTimeFactorPct: 100,
    contributionRatePct: 18.6,
    averageAnnualWage: 45_000,
    populationIncludesMigration: false,
    sourceIds: [],
  }).points[1];
  assert.equal(point.availableWorkers, 0);
  assert.equal(point.employed, 0);
  assert.equal(point.contributors, 0);
});

test("Migrationsberechtigung ohne Beschäftigung wird nicht als Beitrag gezählt", () => {
  const projection = projectDemography(defaultProjectionInput("migration-labour", 2027));
  const migration = calculateMigrationPath({
    baseYear: 2026,
    targetYear: 2027,
    annualArrivals: 1000,
    protectionSharePct: 100,
    ageProfile: Array(MAX_AGE + 1).fill(0).map((_, age) => age === 30 ? 1 : 0),
    accessPreset: "vereinfachter-frueher-zugang",
    accessDelayYears: 0,
    participationRatePct: 0,
    employmentRatePct: 0,
    workTimeFactorPct: 80,
    averageAnnualWage: 45_000,
    taxRatePct: 20,
    contributionRatePct: 18.6,
    transferRateWhenNotEmployedPct: 100,
    workingAgeStart: 20,
    retirementAge: 67,
    legalYear: 2026,
    sourceIds: [],
  });
  const point = calculateLabourPath({
    population: projection.scenario,
    migration,
    retirementAge: 67,
    participationRatePct: 80,
    employmentRatePct: 90,
    workTimeFactorPct: 80,
    contributionRatePct: 18.6,
    averageAnnualWage: 45_000,
    populationIncludesMigration: true,
    sourceIds: [],
  }).points[0];
  assert.equal(point.components.migrationEligible, 1000);
  assert.equal(point.components.migrationEmployed, 0);
  assert.ok(Math.abs(point.taxableWageBill - point.components.nativePotential * 90 / 100 * 80 / 100 * 45_000) < 100_000);
});
