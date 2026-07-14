import {
  DEFAULT_BASELINE_ID,
  DEFAULT_POPULATION_SAMPLE_SIZE,
  DEFAULT_POPULATION_SEED,
  POPULATION_MODEL_VERSION,
} from "./population-model";
import type { PopulationGenerationOptions, PopulationRun } from "./types";

export interface PopulationBasisReference extends PopulationGenerationOptions {
  runId: string | null;
  modelVersion: string;
}

export const DEFAULT_POPULATION_BASIS: PopulationBasisReference = {
  runId: null,
  seed: DEFAULT_POPULATION_SEED,
  sampleSize: DEFAULT_POPULATION_SAMPLE_SIZE,
  baselineId: DEFAULT_BASELINE_ID,
  modelVersion: POPULATION_MODEL_VERSION,
};

export function basisReferenceFromRun(run: PopulationRun): PopulationBasisReference {
  return {
    runId: run.metadata.id,
    seed: run.metadata.seed,
    sampleSize: run.metadata.sampleSize,
    baselineId: run.metadata.baselineId,
    modelVersion: run.metadata.modelVersion,
  };
}

export function matchesPopulationBasis(run: PopulationRun, basis: PopulationBasisReference) {
  return run.metadata.seed === basis.seed
    && run.metadata.sampleSize === basis.sampleSize
    && run.metadata.baselineId === basis.baselineId
    && run.metadata.modelVersion === basis.modelVersion;
}

export function findMatchingPopulationBasis(runs: PopulationRun[], basis: PopulationBasisReference) {
  return runs.find((run) => matchesPopulationBasis(run, basis)) ?? null;
}

export function canReconstructPopulationBasis(basis: PopulationBasisReference | null | undefined) {
  return Boolean(
    basis
    && basis.seed.trim()
    && Number.isInteger(basis.sampleSize)
    && basis.sampleSize > 0
    && basis.baselineId.trim()
    && basis.modelVersion.trim(),
  );
}

export function populationBasisOptions(basis: PopulationBasisReference): PopulationGenerationOptions {
  return { seed: basis.seed, sampleSize: basis.sampleSize, baselineId: basis.baselineId };
}
