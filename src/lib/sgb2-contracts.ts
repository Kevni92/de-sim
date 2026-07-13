export const SGB2_POLICY_SCHEMA_VERSION = 1;
export const SGB2_HOUSING_SCHEMA_VERSION = 1;
export const SGB2_MODEL_VERSION = "sgb2-0.1.0";
export const SGB2_POLICY_2026_ID = "sgb2-policy-2026-07";
export const SGB2_FALLBACK_HOUSING_DATASET_ID = "sgb2-kdu-model-fallback-2026";

export const SGB2_SOURCE_IDS = {
  law: "source-sgb2-law",
  ruleRates2026: "source-sgb2-rule-rates-2026",
  statistics: "source-sgb2-statistics",
  housingModel: "source-sgb2-kdu-model",
} as const;

export type Sgb2Scalar = number | string | boolean;
export type Sgb2Terminology = "buergergeld" | "grundsicherungsgeld";
export type Sgb2EvidenceClass = "gesetz" | "amtliche-statistik" | "modell" | "annahme";
export type Sgb2UncertaintyClass = "niedrig" | "mittel" | "hoch";
export type Sgb2RoundingRule = "keine" | "kaufmaennisch-cent" | "abrunden-cent" | "aufrunden-cent";
export type Sgb2ParameterUnit = "cent-pro-monat" | "anteil" | "index" | "quadratmeter" | "monate" | "boolean";

export interface Sgb2ParameterConstraints {
  min?: number;
  max?: number;
  integer?: boolean;
  allowedValues?: string[];
}

export interface Sgb2Parameter<T extends Sgb2Scalar = Sgb2Scalar> {
  id: string;
  value: T;
  unit: Sgb2ParameterUnit;
  validFrom: string;
  validTo: string | null;
  legalStatusDate: string;
  dataStatusDate?: string;
  sourceId: string;
  evidenceClass: Sgb2EvidenceClass;
  uncertaintyClass: Sgb2UncertaintyClass;
  roundingRule: Sgb2RoundingRule;
  notes?: string;
  constraints?: Sgb2ParameterConstraints;
}

export interface Sgb2PolicyVersion {
  id: string;
  name: string;
  legalStatusDate: string;
  validFrom: string;
  validTo: string | null;
  terminology: Sgb2Terminology;
  schemaVersion: number;
  modelVersion: string;
  parameterIds: string[];
  sourceIds: string[];
  changeNotes: string[];
}

export interface Sgb2EligibilityPredicate {
  kind: "adult-single" | "adult-partner" | "adult-under-25" | "child-age-band" | "pregnancy" | "single-parent" | "disability-participation" | "legacy-model";
  description: string;
  ageMin?: number;
  ageMax?: number;
}

export interface StandardNeedRule {
  id: string;
  priority: number;
  eligibilityPredicate: Sgb2EligibilityPredicate;
  monthlyAmountParameterId: string;
  sourceId: string;
}

export interface AdditionalNeedRule {
  id: string;
  priority: number;
  eligibilityPredicate: Sgb2EligibilityPredicate;
  basis: "standard-need" | "fixed-amount";
  rateParameterId?: string;
  fixedAmountParameterId?: string;
  capGroup?: string;
  capParameterId?: string;
  sourceId: string;
  uncertaintyClass: Sgb2UncertaintyClass;
}

export interface IncomeTypeDefinition {
  id: string;
  label: string;
  countableByDefault: boolean;
  privilegedPossible: boolean;
  allocation: "person" | "child" | "benefit-unit";
  sourceId: string;
}

export interface IncomeDeductionRule {
  id: string;
  appliesToIncomeTypes: string[];
  calculationType: "fixed" | "actual" | "rate";
  parameterId?: string;
  lowerBoundParameterId?: string;
  upperBoundParameterId?: string;
  priority: number;
  sourceId: string;
}

export interface EarnedIncomeAllowanceSegment {
  id: string;
  lowerExclusiveParameterId: string;
  upperInclusiveParameterId?: string;
  childRelatedUpperInclusiveParameterId?: string;
  rateParameterId: string;
  sourceId: string;
}

export interface ReductionRule {
  id: string;
  trigger: "first-breach" | "repeated-breach" | "further-breach" | "missed-appointment";
  rateParameterId: string;
  durationMonthsParameterId?: string;
  sourceId: string;
}

export interface PriorityBenefitDefinition {
  id: string;
  label: string;
  incomeTypeId: string;
  allocation: "person" | "child" | "benefit-unit";
  sourceId: string;
}

export type HousingDatasetStatus = "active" | "model-fallback" | "placeholder";

export interface HousingAllowanceRule {
  id: string;
  householdSizeMin: number;
  householdSizeMax?: number;
  adequateFloorAreaParameterId?: string;
  grossColdRentLimitParameterId?: string;
  baseRentLimitParameterId?: string;
  coldOperatingCostLimitParameterId?: string;
  maxRentPerSquareMeterParameterId?: string;
  heatingLimitParameterId?: string;
  heatingLimitModelId?: string;
  hardshipRuleIds: string[];
}

export interface HousingAllowanceDataset {
  id: string;
  schemaVersion: number;
  regionId: string;
  providerId?: string;
  validFrom: string;
  validTo: string | null;
  publicationDate: string;
  method: string;
  sourceId: string;
  evidenceClass: Sgb2EvidenceClass;
  uncertaintyClass: Sgb2UncertaintyClass;
  status: HousingDatasetStatus;
  modelCostIndexParameterId?: string;
  rules: HousingAllowanceRule[];
}

export interface Sgb2PolicyBundle {
  policy: Sgb2PolicyVersion;
  parameters: Sgb2Parameter[];
  standardNeedRules: StandardNeedRule[];
  additionalNeedRules: AdditionalNeedRule[];
  incomeTypes: IncomeTypeDefinition[];
  incomeDeductionRules: IncomeDeductionRule[];
  earnedIncomeAllowanceSegments: EarnedIncomeAllowanceSegment[];
  reductionRules: ReductionRule[];
  priorityBenefits: PriorityBenefitDefinition[];
  housingDatasets: HousingAllowanceDataset[];
}

export interface Sgb2ParameterOverride {
  parameterId: string;
  value: Sgb2Scalar;
}

export type Sgb2HousingOverrideField =
  | "adequateFloorArea"
  | "grossColdRentLimit"
  | "baseRentLimit"
  | "coldOperatingCostLimit"
  | "maxRentPerSquareMeter"
  | "heatingLimit"
  | "modelCostIndex";

export interface Sgb2HousingDatasetOverride {
  datasetId: string;
  ruleId?: string;
  field: Sgb2HousingOverrideField;
  value: number;
}

export interface Sgb2FinancingOverride {
  component: string;
  payer: string;
  share: number;
}

export interface Sgb2ScenarioReference {
  policyVersionId: string;
  parameterOverrides: Sgb2ParameterOverride[];
  housingDatasetOverrides: Sgb2HousingDatasetOverride[];
  financingOverrides: Sgb2FinancingOverride[];
  populationRunId: string | null;
  modelVersion: string;
  migrationNotes: string[];
}

export interface Sgb2ValidationIssue {
  code: string;
  severity: "error" | "warning";
  path: string;
  message: string;
}
