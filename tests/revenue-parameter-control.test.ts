import assert from "node:assert/strict";
import test from "node:test";
import {
  expandRangeForValue,
  formatParameterValue,
  nextExpandedRange,
  parseLocalizedParameterValue,
  validateParameterValue,
} from "../src/lib/parameter-control";
import { calculateRevenueModule, defaultRevenueParameters, revenueModuleDefinitionById, revenueModuleDefinitions, revenueParameterKey } from "../src/lib/revenue-modules";
import { defaultScenarioDraft, normalizeScenarioDraft, scenarioFromJson, scenarioToJson } from "../src/lib/scenario-state";

test("parses German decimal and grouped values without converting unfinished drafts to zero", () => {
  assert.equal(parseLocalizedParameterValue(""), null);
  assert.equal(parseLocalizedParameterValue("-"), null);
  assert.equal(parseLocalizedParameterValue("25,"), null);
  assert.equal(parseLocalizedParameterValue("keine Zahl"), null);
  assert.equal(parseLocalizedParameterValue("25,5 %"), 25.5);
  assert.equal(parseLocalizedParameterValue("25.5"), 25.5);
  assert.equal(parseLocalizedParameterValue("1.234"), 1234);
  assert.equal(parseLocalizedParameterValue("1.234,5 €"), 1234.5);
});

test("separates the visible scale, validated interval, and hard input limits", () => {
  const rate = revenueModuleDefinitionById.kap.parameters.find((item) => item.key === "rate")!;
  assert.deepEqual({ min: rate.sliderMin, max: rate.sliderMax }, { min: 0, max: 50 });

  const range = expandRangeForValue({ min: rate.sliderMin, max: rate.sliderMax }, 80, rate);
  assert.deepEqual(range, { min: 0, max: 100 });
  assert.deepEqual(nextExpandedRange({ min: 0, max: 50 }, rate), { min: 0, max: 100 });

  const extendedValue = validateParameterValue(80, rate);
  assert.equal(extendedValue.valid, true);
  if (extendedValue.valid) {
    assert.equal(extendedValue.extrapolated, true);
    assert.equal(extendedValue.outsideStandardRange, true);
  }
  assert.match(formatParameterValue(80, rate), /80 %/);
  assert.equal(validateParameterValue(-1, rate).valid, false);
  assert.equal(validateParameterValue(Number.POSITIVE_INFINITY, rate).valid, false);
  assert.equal(validateParameterValue(25.5, rate).valid, false);
});

test("accepts an absolute value beyond the initial scale and labels its model boundary", () => {
  const allowance = revenueModuleDefinitionById.kap.parameters.find((item) => item.key === "saverAllowance")!;
  const validation = validateParameterValue(12_000, allowance);
  assert.equal(validation.valid, true);
  if (validation.valid) assert.equal(validation.extrapolated, true);
  assert.deepEqual(expandRangeForValue({ min: allowance.sliderMin, max: allowance.sliderMax }, 12_000, allowance), { min: 0, max: 20_000 });
  assert.equal(validateParameterValue(1_000_000_000, allowance).valid, true);
  assert.equal(validateParameterValue(allowance.hardMax! + 1, allowance).valid, false);

  const largeValueResult = calculateRevenueModule("kap", { [revenueParameterKey("kap", "saverAllowance")]: 1_000_000_000 }, "statisch");
  assert.ok(Number.isFinite(largeValueResult.value));
});

test("keeps every revenue module's existing baseline result unchanged", () => {
  for (const module of revenueModuleDefinitions) {
    const result = calculateRevenueModule(module.id, {}, "statisch");
    assert.ok(Math.abs(result.staticValue - module.baseline) < 1e-9, `${module.label} baseline changed`);
  }
});

test("uses and preserves an 80 percent capital tax scenario through calculation and JSON import", () => {
  const key = revenueParameterKey("kap", "rate");
  const scenario = normalizeScenarioDraft({
    ...defaultScenarioDraft,
    revenueChanges: { ...defaultRevenueParameters, [key]: 80 },
  });
  const result = calculateRevenueModule("kap", scenario.revenueChanges, "statisch");
  assert.equal(result.parameters.rate, 80);
  assert.equal(result.staticValue, 31.36);

  const restored = scenarioFromJson(scenarioToJson(scenario));
  assert.equal(restored.revenueChanges[key], 80);
});
