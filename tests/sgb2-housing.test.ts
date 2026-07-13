import assert from "node:assert/strict";
import test from "node:test";
import { defaultSgb2PolicyBundle, defaultSgb2ScenarioReference } from "../src/lib/sgb2-policy";
import {
  BERLIN_2026_HOUSING_DATASET_ID,
  SGB2_HOUSING_MODEL_VERSION,
  calculateSgb2HousingCosts,
  calculateSgb2HousingCostsBatch,
} from "../src/lib/sgb2-housing";
import type { Sgb2BenefitUnit } from "../src/lib/types";

function unit(size = 1, regionId = "berlin:grossstadt"): Sgb2BenefitUnit {
  const memberIds = Array.from({ length: size }, (_, index) => `p${index + 1}`);
  return {
    id: `bg-${size}`,
    runId: "run-housing-test",
    householdId: `household-${size}`,
    memberIds,
    eligibleMemberIds: memberIds,
    nonEligibleMemberIds: [],
    type: size === 1 ? "alleinstehend" : "gemischt",
    regionGroup: "stadtstaat",
    incomeBand: "kein-einkommen",
    receiptStatus: "bezug",
    benefitMonths: 12,
    entryMonth: 1,
    exitMonth: 12,
    monthlyCountableIncomeProxyCents: 0,
    monthlyNeedProxyCents: 0,
    housing: {
      regionId,
      housingStatus: "miete",
      floorAreaSquareMeters: size === 1 ? 50 : 102 + Math.max(0, size - 5) * 12,
      baseRentCents: 40_000,
      coldOperatingCostsCents: 10_000,
      grossColdRentCents: 50_000,
      heatingCostsCents: 12_000,
      sourceId: "source-sgb2-kdu-model",
      uncertainty: "hoch",
    },
    baseWeight: 1,
    weight: 1,
    derivationTrace: [],
    sourceIds: [],
    assumptionIds: [],
  };
}

const berlinHeatingFacts = {
  referenceMonth: "2026-07",
  heatingEnergySource: "natural-gas" as const,
  heatedBuildingAreaSquareMeters: 600,
};

test("Berliner Bruttokaltmiete bleibt unter, auf und über dem Richtwert getrennt nachvollziehbar", () => {
  const below = calculateSgb2HousingCosts(unit(), defaultSgb2ScenarioReference, { ...berlinHeatingFacts, actualBaseRentCents: 34_000, actualColdOperatingCostsCents: 10_000 });
  const exact = calculateSgb2HousingCosts(unit(), defaultSgb2ScenarioReference, { ...berlinHeatingFacts, actualBaseRentCents: 34_900, actualColdOperatingCostsCents: 10_000 });
  const above = calculateSgb2HousingCosts(unit(), defaultSgb2ScenarioReference, { ...berlinHeatingFacts, actualBaseRentCents: 40_000, actualColdOperatingCostsCents: 10_000 });
  assert.equal(below.recognizedGrossColdRentCents, 44_000);
  assert.equal(exact.recognizedGrossColdRentCents, 44_900);
  assert.equal(above.recognizedGrossColdRentCents, 44_900);
  assert.equal(above.unrecognizedHousingCents, 5_100);
  assert.equal(above.appliedDatasetId, BERLIN_2026_HOUSING_DATASET_ID);
  assert.equal(above.lookupLevel, "parent-region");
});

test("Heizkostengrenze wird nach Energieträger, Gebäudefläche und BG-Größe ausgewählt", () => {
  const result = calculateSgb2HousingCosts(unit(), defaultSgb2ScenarioReference, berlinHeatingFacts);
  assert.equal(result.modelVersion, SGB2_HOUSING_MODEL_VERSION);
  assert.equal(result.heatingLimitCents, 11_500);
  assert.equal(result.recognizedHeatingCostsCents, 11_500);
  assert.equal(result.unrecognizedHeatingCents, 500);
  assert.ok(result.appliedRuleIds.includes("berlin-heating-natural-gas-501-1000"));
});

test("Berliner Zuschläge für jede weitere Person werden für Miete, Fläche und Heizung angewendet", () => {
  const result = calculateSgb2HousingCosts(unit(6), defaultSgb2ScenarioReference, {
    ...berlinHeatingFacts,
    actualBaseRentCents: 90_000,
    actualColdOperatingCostsCents: 20_000,
    actualHeatingCostsCents: 30_000,
  });
  assert.equal(result.adequateFloorAreaSquareMeters, 114);
  assert.equal(result.grossColdRentLimitCents, 101_004);
  assert.equal(result.heatingLimitCents, 26_220);
  assert.equal(result.recognizedGrossColdRentCents, 101_004);
  assert.equal(result.recognizedHeatingCostsCents, 26_220);
});

test("Karenzzeit nutzt ab Juli 2026 höchstens das Eineinhalbfache des örtlichen Richtwerts und prüft Heizung getrennt", () => {
  const ordinary = calculateSgb2HousingCosts(unit(), defaultSgb2ScenarioReference, {
    ...berlinHeatingFacts,
    benefitStartMonth: "2026-01",
  });
  const extreme = calculateSgb2HousingCosts(unit(), defaultSgb2ScenarioReference, {
    ...berlinHeatingFacts,
    benefitStartMonth: "2026-01",
    actualBaseRentCents: 90_000,
    actualColdOperatingCostsCents: 10_000,
  });
  assert.equal(ordinary.recognitionStatus, "grace-period");
  assert.equal(ordinary.recognizedGrossColdRentCents, 50_000);
  assert.equal(ordinary.recognizedHeatingCostsCents, 11_500);
  assert.equal(extreme.recognizedGrossColdRentCents, 67_350);
  assert.equal(extreme.unrecognizedHousingCents, 32_650);
  assert.ok(extreme.parameterIds.includes("sgb2.housing.grace-cap-factor"));
});

test("Expliziter Kostensenkungszeitraum und Härtefall verhindern vorübergehend eine Kappung", () => {
  const transition = calculateSgb2HousingCosts(unit(), defaultSgb2ScenarioReference, {
    ...berlinHeatingFacts,
    costReductionStartMonth: "2026-05",
  });
  const hardship = calculateSgb2HousingCosts(unit(), defaultSgb2ScenarioReference, {
    ...berlinHeatingFacts,
    hardshipActive: true,
  });
  assert.equal(transition.recognitionStatus, "transition-period");
  assert.equal(transition.recognizedHousingAndHeatingCents, 62_000);
  assert.equal(hardship.recognitionStatus, "hardship");
  assert.equal(hardship.recognizedHousingAndHeatingCents, 62_000);
});

test("Fehlende Regional- oder Heiztabellen führen zu sichtbarem Modell-Fallback statt Nullwert", () => {
  const regionalFallback = calculateSgb2HousingCosts(unit(1, "niedersachsen:laendlich"), defaultSgb2ScenarioReference, { referenceMonth: "2026-07" });
  assert.equal(regionalFallback.lookupLevel, "model-fallback");
  assert.equal(regionalFallback.recognitionStatus, "model-fallback");
  assert.equal(regionalFallback.recognizedHousingAndHeatingCents, 62_000);
  assert.equal(regionalFallback.uncertaintyClass, "hoch");
  assert.ok(regionalFallback.fallbackTrace.some((item) => item.includes("Modell-Fallback")));

  const heatingFallback = calculateSgb2HousingCosts(unit(), defaultSgb2ScenarioReference, { referenceMonth: "2026-07" });
  assert.equal(heatingFallback.recognizedHeatingCostsCents, 12_000);
  assert.ok(heatingFallback.validationIssues.some((issue) => issue.code === "heating_facts_missing"));
});

test("Szenario-Overrides ändern nur den adressierten Miet- oder Heizgrenzwert", () => {
  const reference = {
    ...defaultSgb2ScenarioReference,
    housingDatasetOverrides: [
      { datasetId: BERLIN_2026_HOUSING_DATASET_ID, ruleId: "berlin-hh1", field: "grossColdRentLimit" as const, value: 48_000 },
      { datasetId: BERLIN_2026_HOUSING_DATASET_ID, ruleId: "berlin-heating-natural-gas-501-1000", field: "heatingLimit" as const, value: 13_000 },
    ],
  };
  const result = calculateSgb2HousingCosts(unit(), reference, berlinHeatingFacts);
  assert.equal(result.grossColdRentLimitCents, 48_000);
  assert.equal(result.heatingLimitCents, 13_000);
  assert.equal(result.recognizedGrossColdRentCents, 48_000);
  assert.equal(result.recognizedHeatingCostsCents, 12_000);
});

test("Ohne gültigen Regionaldatensatz und ohne Fallback wird die Berechnung verständlich abgebrochen", () => {
  const bundle = { ...defaultSgb2PolicyBundle, housingDatasets: defaultSgb2PolicyBundle.housingDatasets.filter((dataset) => dataset.status === "active") };
  assert.throws(
    () => calculateSgb2HousingCosts(unit(1, "sachsen:laendlich"), defaultSgb2ScenarioReference, { referenceMonth: "2026-07" }, bundle),
    /weder ein regionaler KdU-Datensatz noch ein Modell-Fallback/,
  );
});

test("Batchberechnung ist deterministisch nach Bedarfsgemeinschafts-ID sortiert", () => {
  const first = unit(1);
  const second = { ...unit(2), id: "bg-0" };
  const result = calculateSgb2HousingCostsBatch([first, second], defaultSgb2ScenarioReference, {
    [first.id]: berlinHeatingFacts,
    [second.id]: berlinHeatingFacts,
  });
  assert.deepEqual(result.results.map((item) => item.benefitUnitId), ["bg-0", "bg-1"]);
});
