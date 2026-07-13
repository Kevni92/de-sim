import assert from "node:assert/strict";
import test from "node:test";
import {
  SGB2_FALLBACK_HOUSING_DATASET_ID,
  SGB2_MODEL_VERSION,
  SGB2_POLICY_2026_ID,
  defaultSgb2PolicyBundle,
  defaultSgb2ScenarioReference,
  normalizeSgb2ScenarioReference,
  resolveSgb2ParameterValues,
  validateSgb2PolicyBundle,
  validateSgb2ScenarioReference,
} from "../src/lib/sgb2-policy";
import {
  SCENARIO_SCHEMA_VERSION,
  defaultScenarioDraft,
  scenarioFromJson,
  scenarioToJson,
} from "../src/lib/scenario-state";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test("Policy-Baseline ist versioniert, quellenfähig und strukturell gültig", () => {
  const issues = validateSgb2PolicyBundle(defaultSgb2PolicyBundle);
  assert.deepEqual(issues.filter((issue) => issue.severity === "error"), []);
  assert.ok(issues.some((issue) => issue.code === "housing_limits_placeholder" && issue.severity === "warning"));
  assert.equal(defaultSgb2PolicyBundle.policy.id, SGB2_POLICY_2026_ID);
  assert.equal(defaultSgb2PolicyBundle.policy.modelVersion, SGB2_MODEL_VERSION);
  assert.equal(defaultSgb2PolicyBundle.standardNeedRules.length, 6);
  assert.ok(defaultSgb2PolicyBundle.parameters.every((parameter) => parameter.sourceId && parameter.validFrom && parameter.legalStatusDate && parameter.roundingRule));
  assert.ok(defaultSgb2PolicyBundle.parameters.filter((parameter) => parameter.unit === "cent-pro-monat").every((parameter) => Number.isInteger(parameter.value)));
});

test("ungültige Quellen, Werte und überschneidende Segmente werden erkannt", () => {
  const invalid = clone(defaultSgb2PolicyBundle);
  invalid.parameters[0].sourceId = "";
  invalid.parameters[0].value = -1;
  const segmentTwoLower = invalid.parameters.find((parameter) => parameter.id === "sgb2.income.allowance-segment-2-lower");
  assert.ok(segmentTwoLower);
  segmentTwoLower.value = 40_000;
  invalid.housingDatasets[0].rules.push({
    id: "overlap",
    householdSizeMin: 1,
    householdSizeMax: 2,
    adequateFloorAreaParameterId: "sgb2.housing.floor-area.hh1",
    hardshipRuleIds: [],
  });
  const codes = new Set(validateSgb2PolicyBundle(invalid).map((issue) => issue.code));
  assert.ok(codes.has("parameter_source_missing"));
  assert.ok(codes.has("parameter_below_min"));
  assert.ok(codes.has("income_segment_overlap"));
  assert.ok(codes.has("housing_rule_overlap"));
});

test("regionale Unterkunftsdaten bleiben vom bundesweiten Parametersatz getrennt", () => {
  const dataset = defaultSgb2PolicyBundle.housingDatasets[0];
  assert.equal(dataset.id, SGB2_FALLBACK_HOUSING_DATASET_ID);
  assert.equal(dataset.regionId, "DE");
  assert.equal(dataset.status, "placeholder");
  assert.ok(dataset.rules.every((rule) => rule.adequateFloorAreaParameterId));
  assert.ok(!defaultSgb2PolicyBundle.standardNeedRules.some((rule) => rule.monthlyAmountParameterId.startsWith("sgb2.housing.")));
});

test("alte Bürgergeld-Indizes werden in benannte Overrides migriert", () => {
  const migrated = normalizeSgb2ScenarioReference(undefined, {
    "expense.param.social.benefitIndex": 110,
    "expense.param.social.recipientIndex": 95,
    "expense.param.social.housingIndex": 120,
    "expense.param.social.caseManagementIndex": 105,
  }, "population-test");
  const values = resolveSgb2ParameterValues(migrated);
  assert.equal(values.get("sgb2.standard-need.single"), 61_930);
  assert.equal(values.get("sgb2.legacy.recipient-index"), 95);
  assert.equal(values.get("sgb2.legacy.case-management-index"), 105);
  assert.deepEqual(migrated.housingDatasetOverrides, [{ datasetId: SGB2_FALLBACK_HOUSING_DATASET_ID, field: "modelCostIndex", value: 120 }]);
  assert.equal(migrated.populationRunId, "population-test");
  assert.ok(migrated.migrationNotes.length >= 4);
});

test("Szenario-JSON 4 roundtript und Schema 3 wird migriert", () => {
  const exported = JSON.parse(scenarioToJson(defaultScenarioDraft)) as { schemaVersion: number; scenario: typeof defaultScenarioDraft };
  assert.equal(exported.schemaVersion, SCENARIO_SCHEMA_VERSION);
  assert.equal(exported.scenario.sgb2.policyVersionId, SGB2_POLICY_2026_ID);
  const roundtrip = scenarioFromJson(JSON.stringify(exported));
  assert.deepEqual(roundtrip.sgb2, defaultScenarioDraft.sgb2);

  const migrated = scenarioFromJson(JSON.stringify({
    schemaVersion: 3,
    scenario: {
      name: "Altes Bürgergeld-Szenario",
      expenseChanges: {
        "expense.param.social.benefitIndex": 105,
        "expense.param.social.housingIndex": 90,
      },
    },
  }));
  assert.equal(migrated.sgb2.policyVersionId, SGB2_POLICY_2026_ID);
  assert.ok(migrated.sgb2.parameterOverrides.some((override) => override.parameterId === "sgb2.standard-need.single"));
  assert.equal(migrated.sgb2.housingDatasetOverrides[0].value, 90);
});

test("unbekannte Policy- und Modellversionen werden verständlich abgelehnt", () => {
  const invalidReference = { ...defaultSgb2ScenarioReference, policyVersionId: "sgb2-unbekannt" };
  assert.ok(validateSgb2ScenarioReference(invalidReference).some((issue) => issue.code === "scenario_policy_unsupported"));
  assert.throws(() => scenarioFromJson(JSON.stringify({
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    scenario: {
      ...defaultScenarioDraft,
      sgb2: { ...defaultSgb2ScenarioReference, modelVersion: "sgb2-unbekannt" },
    },
  })), /scenario_model_unsupported/);
});
