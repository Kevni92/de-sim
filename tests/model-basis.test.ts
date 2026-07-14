import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_POPULATION_BASIS,
  basisReferenceFromRun,
  canReconstructPopulationBasis,
  findMatchingPopulationBasis,
  matchesPopulationBasis,
} from "../src/lib/model-basis";
import type { PopulationRun } from "../src/lib/types";

function run(overrides: Partial<PopulationRun["metadata"]> = {}): PopulationRun {
  const metadata = {
    id: "run-default",
    schemaVersion: 1,
    modelVersion: DEFAULT_POPULATION_BASIS.modelVersion,
    seed: DEFAULT_POPULATION_BASIS.seed,
    createdAt: "2026-07-14T00:00:00.000Z",
    dataYear: 2025,
    legalYear: 2026,
    baselineId: DEFAULT_POPULATION_BASIS.baselineId,
    sourceIds: [],
    sampleSize: DEFAULT_POPULATION_BASIS.sampleSize,
    weightedPopulation: 83_517_000,
    weightedHouseholds: 41_300_000,
    calibrationMethod: "raking",
    quality: { maxRelativeDeviation: 0.01, meanRelativeDeviation: 0.005, status: "innerhalb-toleranz" as const },
    limitations: [],
    active: false,
    ...overrides,
  };
  return {
    metadata,
    summary: {
      runId: metadata.id,
      personCount: metadata.sampleSize,
      householdCount: 4_500,
      weightedPopulation: metadata.weightedPopulation,
      weightedHouseholds: metadata.weightedHouseholds,
      calibrationStatus: metadata.quality.status,
      validationErrors: 0,
      validationWarnings: 0,
      distributions: {},
    },
    calibration: [],
    validation: [],
  };
}

test("erkennt und findet eine bereits vorhandene Standard-Modellbasis", () => {
  const custom = run({ id: "custom", seed: "anderer-seed" });
  const standard = run();
  assert.equal(matchesPopulationBasis(standard, DEFAULT_POPULATION_BASIS), true);
  assert.equal(matchesPopulationBasis(custom, DEFAULT_POPULATION_BASIS), false);
  assert.equal(findMatchingPopulationBasis([custom, standard], DEFAULT_POPULATION_BASIS)?.metadata.id, "run-default");
});

test("übernimmt alle Rekonstruktionsdaten aus einem Lauf", () => {
  const reference = basisReferenceFromRun(run());
  assert.deepEqual(reference, {
    runId: "run-default",
    seed: DEFAULT_POPULATION_BASIS.seed,
    sampleSize: DEFAULT_POPULATION_BASIS.sampleSize,
    baselineId: DEFAULT_POPULATION_BASIS.baselineId,
    modelVersion: DEFAULT_POPULATION_BASIS.modelVersion,
  });
  assert.equal(canReconstructPopulationBasis(reference), true);
});

test("lehnt unvollständige Rekonstruktionsdaten ab", () => {
  assert.equal(canReconstructPopulationBasis({ ...DEFAULT_POPULATION_BASIS, sampleSize: 0 }), false);
  assert.equal(canReconstructPopulationBasis({ ...DEFAULT_POPULATION_BASIS, seed: "" }), false);
  assert.equal(canReconstructPopulationBasis(null), false);
});
