import assert from "node:assert/strict";
import test from "node:test";
import { collectScenarioChanges, resetScenarioChange } from "../src/lib/scenario-changes";
import { statutoryIncomeTax2026 } from "../src/lib/income-tax";
import { defaultEffectParameters } from "../src/lib/long-term-effects";
import { defaultLongTermScenarioSettings } from "../src/lib/long-term-scenario";
import { createScenarioHistory, defaultScenarioDraft, normalizeScenarioDraft, scenarioFromJson, scenarioHistoryReducer } from "../src/lib/scenario-state";
import { defaultSgb2ScenarioReference } from "../src/lib/sgb2-policy";
import { setSimpleControl } from "../src/lib/sgb2-simple-controls";

function baselineScenario() {
  return normalizeScenarioDraft({
    ...defaultScenarioDraft,
    incomeTax: { ...statutoryIncomeTax2026 },
    revenueChanges: {},
    expenseChanges: {},
    effectParameters: { ...defaultEffectParameters },
    longTerm: { ...defaultLongTermScenarioSettings },
    modelLevel: defaultScenarioDraft.modelLevel,
    horizonYears: defaultScenarioDraft.horizonYears,
    sgb2: { ...defaultSgb2ScenarioReference, parameterOverrides: [], housingDatasetOverrides: [], financingOverrides: [] },
  });
}

test("listet gruppierte Bürgergeldwerte einzeln und trennt USt-Modellannahmen von Steuersätzen", () => {
  const baseline = baselineScenario();
  const scenario = normalizeScenarioDraft({
    ...baseline,
    incomeTax: { ...baseline.incomeTax, allowance: 15_000 },
    revenueChanges: {
      "param.ust.standardRate": 20,
      "param.ust.reducedShare": 35,
    },
    sgb2: setSimpleControl(baseline.sgb2, "standard-needs", 5),
  });

  const changes = collectScenarioChanges(scenario);
  const policyIds = changes.filter((item) => item.category === "policy").map((item) => item.id);
  const assumptionIds = changes.filter((item) => item.category === "assumption").map((item) => item.id);
  assert.ok(policyIds.includes("incomeTax.allowance"));
  assert.ok(policyIds.includes("param.ust.standardRate"));
  assert.ok(assumptionIds.includes("param.ust.reducedShare"));
  assert.equal(policyIds.filter((id) => id.startsWith("sgb2.standard-need.")).length, 6);
  assert.ok(changes.filter((item) => item.id.startsWith("sgb2.standard-need.")).every((item) => item.group === "Regelbedarfe"));
});

test("Einzelreset nimmt nur einen konkreten Wert zurück und behält Nachbaränderungen", () => {
  const baseline = baselineScenario();
  const scenario = normalizeScenarioDraft({
    ...baseline,
    incomeTax: { ...baseline.incomeTax, allowance: 15_000 },
    revenueChanges: { "param.ust.standardRate": 20 },
    sgb2: setSimpleControl(baseline.sgb2, "standard-needs", 5),
  });
  const selected = collectScenarioChanges(scenario).find((item) => item.id === "sgb2.standard-need.single");
  assert.ok(selected);

  const reset = resetScenarioChange(scenario, selected.target);
  const next = normalizeScenarioDraft({ ...scenario, ...reset });
  const remaining = collectScenarioChanges(next);
  assert.ok(!remaining.some((item) => item.id === selected.id));
  assert.ok(remaining.some((item) => item.id === "sgb2.standard-need.partner"));
  assert.ok(remaining.some((item) => item.id === "incomeTax.allowance"));
  assert.ok(remaining.some((item) => item.id === "param.ust.standardRate"));
});

test("Import sowie Undo und Redo zeigen den jeweils aktuellen Änderungsstand", () => {
  const base = baselineScenario();
  const imported = scenarioFromJson(JSON.stringify({
    schemaVersion: 7,
    scenario: {
      name: "Importiertes Paket",
      incomeTax: { ...base.incomeTax, allowance: 15_000 },
      revenueChanges: { "param.ust.standardRate": 21 },
    },
  }));
  assert.ok(collectScenarioChanges(imported).some((item) => item.id === "param.ust.standardRate"));

  let history = createScenarioHistory(base);
  history = scenarioHistoryReducer(history, { type: "replace", scenario: imported });
  assert.ok(collectScenarioChanges(history.present).some((item) => item.id === "param.ust.standardRate"));
  history = scenarioHistoryReducer(history, { type: "undo" });
  assert.ok(!collectScenarioChanges(history.present).some((item) => item.id === "param.ust.standardRate"));
  history = scenarioHistoryReducer(history, { type: "redo" });
  assert.ok(collectScenarioChanges(history.present).some((item) => item.id === "param.ust.standardRate"));
});

test("zeigt bei einem Szenario auf gesetzlichen Baselines eine leere Änderungsmenge", () => {
  assert.deepEqual(collectScenarioChanges(baselineScenario()), []);
});
