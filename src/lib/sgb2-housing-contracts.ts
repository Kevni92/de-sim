import type { Sgb2HeatingEnergySource, Sgb2UncertaintyClass } from "./sgb2-contracts";

export const SGB2_HOUSING_RESULT_SCHEMA_VERSION = 1;
export const SGB2_HOUSING_MODEL_VERSION = "sgb2-housing-0.1.0";

export type Sgb2HousingLookupLevel = "provider" | "region" | "parent-region" | "model-fallback";
export type Sgb2HousingRecognitionStatus = "within-limits" | "capped" | "grace-period" | "transition-period" | "hardship" | "model-fallback";

export interface Sgb2HousingRuntimeFacts {
  referenceMonth?: string;
  regionId?: string;
  providerId?: string;
  householdSize?: number;
  actualBaseRentCents?: number;
  actualColdOperatingCostsCents?: number;
  actualHeatingCostsCents?: number;
  floorAreaSquareMeters?: number;
  heatingEnergySource?: Sgb2HeatingEnergySource;
  heatedBuildingAreaSquareMeters?: number;
  benefitStartMonth?: string;
  costReductionStartMonth?: string;
  hardshipActive?: boolean;
  forceDatasetId?: string;
}

export interface Sgb2HousingValidationIssue {
  code: string;
  severity: "warning" | "info";
  path: string;
  message: string;
}

export interface Sgb2HousingCostResult {
  schemaVersion: number;
  modelVersion: string;
  runId: string;
  benefitUnitId: string;
  month: string;
  regionId: string;
  providerId?: string;
  householdSize: number;
  actualBaseRentCents: number;
  actualColdOperatingCostsCents: number;
  actualGrossColdRentCents: number;
  actualHeatingCostsCents: number;
  adequateFloorAreaSquareMeters: number | null;
  grossColdRentLimitCents: number | null;
  heatingLimitCents: number | null;
  recognizedBaseRentCents: number;
  recognizedColdOperatingCostsCents: number;
  recognizedGrossColdRentCents: number;
  recognizedHeatingCostsCents: number;
  recognizedHousingAndHeatingCents: number;
  unrecognizedHousingCents: number;
  unrecognizedHeatingCents: number;
  recognitionStatus: Sgb2HousingRecognitionStatus;
  lookupLevel: Sgb2HousingLookupLevel;
  appliedDatasetId: string;
  appliedRuleIds: string[];
  parameterIds: string[];
  sourceIds: string[];
  fallbackTrace: string[];
  uncertaintyClass: Sgb2UncertaintyClass;
  validationIssues: Sgb2HousingValidationIssue[];
}

export interface Sgb2HousingBatchResult {
  schemaVersion: number;
  modelVersion: string;
  runId: string;
  month: string;
  results: Sgb2HousingCostResult[];
}
