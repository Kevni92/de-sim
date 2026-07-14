import {
  DEFAULT_BASELINE_ID,
  DEFAULT_POPULATION_SAMPLE_SIZE,
  DEFAULT_POPULATION_SEED,
  POPULATION_MODEL_VERSION,
} from "./population-model";
import type { PopulationGenerationOptions, PopulationRun } from "./types";

export interface PopulationBasisReference {
  runId: string;
  modelVersion: string | null;
  seed: string | null;
  sampleSize: number | null;
  baselineId: string | null;
}

export const STANDARD_POPULATION_OPTIONS: PopulationGenerationOptions = Object.freeze({
  seed: DEFAULT_POPULATION_SEED,
  sampleSize: DEFAULT_POPULATION_SAMPLE_SIZE,
  baselineId: DEFAULT_BASELINE_ID,
});

export function populationRunIdForOptions(options: PopulationGenerationOptions) {
  const sampleSize = Math.round(Math.min(50_000, Math.max(500, options.sampleSize)));
  const seed = options.seed.trim() || DEFAULT_POPULATION_SEED;
  const baselineId = options.baselineId || DEFAULT_BASELINE_ID;
  return `population-${hashSeed(`${seed}|${sampleSize}|${baselineId}|${POPULATION_MODEL_VERSION}`).toString(16)}`;
}

export function populationBasisFromRun(run: PopulationRun): PopulationBasisReference {
  return {
    runId: run.metadata.id,
    modelVersion: run.metadata.modelVersion,
    seed: run.metadata.seed,
    sampleSize: run.metadata.sampleSize,
    baselineId: run.metadata.baselineId,
  };
}

export function populationBasisOptions(reference: PopulationBasisReference | null | undefined): PopulationGenerationOptions | null {
  if (!reference || reference.modelVersion !== POPULATION_MODEL_VERSION) return null;
  if (!reference.seed || !reference.baselineId || !reference.sampleSize || reference.sampleSize < 1) return null;
  const options = { seed: reference.seed, sampleSize: reference.sampleSize, baselineId: reference.baselineId };
  return populationRunIdForOptions(options) === reference.runId ? options : null;
}

export function canReconstructPopulationBasis(reference: PopulationBasisReference | null | undefined) {
  return populationBasisOptions(reference) !== null;
}

export function isStandardPopulationBasis(reference: PopulationBasisReference | null | undefined) {
  if (!reference) return false;
  return reference.runId === populationRunIdForOptions(STANDARD_POPULATION_OPTIONS)
    && reference.modelVersion === POPULATION_MODEL_VERSION;
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
