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
