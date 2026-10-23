import assert from "node:assert/strict";
import test from "node:test";
import { compareScenarioChanges, compareScenarioFoundations, sameScenarioChangeValue } from "../src/lib/scenario-comparison";
import { statutoryIncomeTax2026 } from "../src/lib/income-tax";
import { defaultScenarioDraft, normalizeScenarioDraft } from "../src/lib/scenario-state";

function baselineScenario() {
  return normalizeScenarioDraft({
    ...defaultScenarioDraft,
    incomeTax: { ...statutoryIncomeTax2026 },
    revenueChanges: {},
    expenseChanges: {},
  });
}

test("stellt je Szenario eigene Parameterwerte dar und kann identische Werte ausblenden", () => {
  const baseline = baselineScenario();
  const current = normalizeScenarioDraft({
    ...baseline,
    incomeTax: { ...baseline.incomeTax, allowance: 13_000 },
    revenueChanges: { "param.ust.standardRate": 20 },
  });
  const alternative = normalizeScenarioDraft({
    ...baseline,
    incomeTax: { ...baseline.incomeTax, allowance: 14_000 },
    revenueChanges: { "param.ust.standardRate": 20 },
  });

  const rows = compareScenarioChanges(current, alternative);
  const allowance = rows.find((row) => row.id === "incomeTax.allowance");
  const vat = rows.find((row) => row.id === "param.ust.standardRate");
  assert.ok(allowance);
  assert.ok(vat);
  assert.equal(allowance.current, 13_000);
  assert.equal(allowance.alternative, 14_000);
  assert.equal(allowance.baselineCurrent, 12_348);
  assert.equal(allowance.baselineAlternative, 12_348);
  assert.equal(vat.current, vat.alternative);
  assert.equal(sameScenarioChangeValue(vat.current, vat.alternative), true);
  assert.equal(sameScenarioChangeValue(20, 21), false);
});

test("kennzeichnet abweichende fachliche Berechnungsgrundlagen", () => {
  const current = baselineScenario();
  const alternative = normalizeScenarioDraft({
    ...current,
    legalYear: 2025,
    dataYear: 2026,
    modelVersion: "model-other",
    modelLevel: "langfrist",
    horizonYears: 20,
    populationRunId: "population-other",
    populationModelVersion: "population-v2",
    populationBasis: { runId: "population-other", modelVersion: "population-v2", seed: "other", sampleSize: 1000, baselineId: "baseline-other" },
    sgb2: { ...current.sgb2, policyVersionId: "policy-other", modelVersion: "sgb2-other" },
  });

  const differences = compareScenarioFoundations(current, alternative);
  const ids = differences.map((difference) => difference.id);
  for (const id of ["legalYear", "dataYear", "modelLevel", "horizonYears", "modelVersion", "populationRunId", "populationModelVersion", "sgb2Policy", "sgb2Model", "sgb2PopulationRunId"]) {
    assert.ok(ids.includes(id), `expected ${id} to be visible`);
  }
  assert.deepEqual(compareScenarioFoundations(current, current), []);
});
