import assert from "node:assert/strict";
import test from "node:test";
import { defaultSgb2ScenarioReference } from "../src/lib/sgb2-policy";
import { setSimpleControl, simpleControlState, typicalMonthlyDeltaCents } from "../src/lib/sgb2-simple-controls";
import { getSgb2Parameter, resolvedSgb2UiValue, setSgb2UiParameter, sgb2UiGroups } from "../src/lib/sgb2-ui";

test("Regelbedarfsänderung schreibt alle konkreten Regelbedarfe", () => {
  const changed = setSimpleControl(defaultSgb2ScenarioReference, "standard-needs", 5);
  const group = sgb2UiGroups.find((item) => item.id === "standard-needs")!;
  assert.equal(resolvedSgb2UiValue(changed, "sgb2.standard-need.single"), 59_115);
  for (const id of group.parameterIds) {
    const baseline = getSgb2Parameter(id).value as number;
    assert.equal(resolvedSgb2UiValue(changed, id), Math.round(baseline * 1.05));
  }
  assert.deepEqual(simpleControlState(changed, "standard-needs"), { value: 5, mixed: false });
});

test("anrechnungsfreier Hinzuverdienst ändert nur den konkreten Grundbetrag", () => {
  const changed = setSimpleControl(defaultSgb2ScenarioReference, "income-free-amount", 150);
  assert.equal(resolvedSgb2UiValue(changed, "sgb2.income.base-deduction"), 15_000);
  assert.equal(resolvedSgb2UiValue(changed, "sgb2.income.allowance-segment-1-rate"), getSgb2Parameter("sgb2.income.allowance-segment-1-rate").value);
  assert.deepEqual(simpleControlState(changed, "income-free-amount"), { value: 150, mixed: false });
});

test("Wohngrenzen ändern keine Karenz- oder Übergangsmonate", () => {
  const changed = setSimpleControl(defaultSgb2ScenarioReference, "housing-recognition", 10);
  assert.equal(resolvedSgb2UiValue(changed, "sgb2.housing.berlin-2026.gross-cold-rent.hh1"), Math.round((getSgb2Parameter("sgb2.housing.berlin-2026.gross-cold-rent.hh1").value as number) * 1.1));
  assert.equal(resolvedSgb2UiValue(changed, "sgb2.housing.fallback.cost-index"), 110);
  assert.equal(resolvedSgb2UiValue(changed, "sgb2.housing.grace-period-months"), 12);
  assert.equal(resolvedSgb2UiValue(changed, "sgb2.housing.cost-reduction-transition-months"), 6);
});

test("abweichende Expertenwerte bleiben im Standardmodus erkennbar", () => {
  const expert = setSgb2UiParameter(defaultSgb2ScenarioReference, "sgb2.standard-need.single", 60_000);
  const state = simpleControlState(expert, "standard-needs");
  assert.equal(state.mixed, true);
  assert.ok(state.value > 0);
});

test("typische Monatswirkung wird aus gewichteten Bezugsmonaten abgeleitet", () => {
  const preview = { deltaPaymentCents: 1_200_000, weightedPaymentMonths: 4_000 } as Parameters<typeof typicalMonthlyDeltaCents>[0];
  assert.equal(typicalMonthlyDeltaCents(preview), 300);
});
