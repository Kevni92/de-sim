import assert from "node:assert/strict";
import test from "node:test";
import { defaultSgb2ScenarioReference } from "../src/lib/sgb2-policy";
import {
  getSgb2Parameter,
  resetSgb2Ui,
  resolvedSgb2UiValue,
  setSgb2UiGroupPercent,
  setSgb2UiParameter,
  sgb2UiGroupPercent,
  sgb2UiGroups,
  sgb2UiHasChanges,
  sgb2UiInputValue,
  sgb2UiModelValue,
} from "../src/lib/sgb2-ui";

test("Einfachmodus schreibt konkrete Regelbedarfs-Overrides", () => {
  const reference = setSgb2UiGroupPercent(defaultSgb2ScenarioReference, "standard-needs", 110);
  const group = sgb2UiGroups.find((item) => item.id === "standard-needs")!;
  assert.equal(reference.parameterOverrides.length, group.parameterIds.length);
  group.parameterIds.forEach((id) => {
    const baseline = getSgb2Parameter(id).value;
    assert.equal(typeof baseline, "number");
    assert.equal(resolvedSgb2UiValue(reference, id), Math.round((baseline as number) * 1.1));
  });
  assert.deepEqual(sgb2UiGroupPercent(reference, "standard-needs"), { percent: 110, mixed: false });
});

test("Einfach- und Expertenmodus erzeugen denselben kanonischen Parametersatz", () => {
  const simple = setSgb2UiGroupPercent(defaultSgb2ScenarioReference, "additional-needs", 90);
  const group = sgb2UiGroups.find((item) => item.id === "additional-needs")!;
  const expert = group.parameterIds.reduce((reference, id) => {
    const baseline = getSgb2Parameter(id).value;
    assert.equal(typeof baseline, "number");
    return setSgb2UiParameter(reference, id, (baseline as number) * 0.9);
  }, defaultSgb2ScenarioReference);
  assert.deepEqual(expert.parameterOverrides, simple.parameterOverrides);
});

test("gemischte Expertenwerte werden im Einfachmodus sichtbar", () => {
  const changed = setSgb2UiParameter(defaultSgb2ScenarioReference, "sgb2.standard-need.single", 60_000);
  const state = sgb2UiGroupPercent(changed, "standard-needs");
  assert.equal(state.mixed, true);
  assert.ok(state.percent > 100);
});

test("Euro- und Prozentfelder werden verlustfrei zwischen UI und Modell konvertiert", () => {
  const euro = getSgb2Parameter("sgb2.standard-need.single");
  const rate = getSgb2Parameter("sgb2.additional-need.pregnancy-rate");
  assert.equal(sgb2UiInputValue(euro, 56_300), 563);
  assert.equal(sgb2UiModelValue(euro, 600), 60_000);
  assert.equal(sgb2UiInputValue(rate, 0.17), 17);
  assert.equal(sgb2UiModelValue(rate, 20), 0.2);
});

test("Baseline-Wiederherstellung entfernt alle SGB-II-Overrides", () => {
  const changed = {
    ...setSgb2UiParameter(defaultSgb2ScenarioReference, "sgb2.income.base-deduction", 12_000),
    housingDatasetOverrides: [{ datasetId: "sgb2-kdu-berlin-2026", ruleId: "berlin-hh1", field: "grossColdRentLimit" as const, value: 50_000 }],
    financingOverrides: [{ component: "accommodation", payer: "bund", share: 0.8 }],
    migrationNotes: ["Altwert"],
  };
  assert.equal(sgb2UiHasChanges(changed), true);
  const reset = resetSgb2Ui(changed);
  assert.equal(sgb2UiHasChanges(reset), false);
  assert.deepEqual(reset.parameterOverrides, []);
  assert.deepEqual(reset.housingDatasetOverrides, []);
  assert.deepEqual(reset.financingOverrides, []);
  assert.deepEqual(reset.migrationNotes, []);
});

test("Unterkunftsgruppe enthält konkrete Berliner Miet- und Heizgrenzen", () => {
  const housing = sgb2UiGroups.find((item) => item.id === "housing")!;
  assert.ok(housing.parameterIds.some((id) => id.includes("gross-cold-rent.hh1")));
  assert.ok(housing.parameterIds.some((id) => id.includes("heating.natural-gas.501-1000.hh1")));
  assert.ok(housing.parameterIds.includes("sgb2.housing.grace-cap-factor"));
});
