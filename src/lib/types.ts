import type { Sgb2ScenarioReference } from "./sgb2-policy";

export type Confidence = "hoch" | "mittel" | "niedrig";
export type SourceStatus = "amtlich" | "modell" | "annahme";
export type EvidenceStatus = SourceStatus | "unbekannt";
export type ModelLevel = "statisch" | "verhalten" | "langfrist";
export type TimeHorizon = 1 | 5 | 10 | 20;

export interface SourceRecord {
  id: string;
  title: string;
  institution: string;
  url: string;
  dataYear: number;
  legalYear: number;
  status: SourceStatus;
  confidence: Confidence;
  summary: string;
  method: string;
  limitations: string[];
  checkedAt: string;
}

export interface MetricParameter { name: string; value: string; sourceId?: string; }
export interface CalculationStep { label: string; expression: string; note?: string; }
export interface UncertaintyDefinition { kind: "band" | "range" | "not-applicable"; lowerPercent?: number; upperPercent?: number; description: string; }
export interface ChangeLogEntry { date: string; version: string; note: string; }

export interface MetricRecord {
  id: string;
  label: string;
  category: string;
  description: string;
  unit: string;
  status: EvidenceStatus;
  confidence: Confidence;
  dataYear: number;
  legalYear: number;
  sourceIds: string[];
  formula: string;
  parameters: MetricParameter[];
  calculation: CalculationStep[];
  uncertainty: UncertaintyDefinition;
  limitations: string[];
  changeLog: ChangeLogEntry[];
}

export interface IncomeTaxSettings {
  allowance: number;
  entryRate: number;
  topRate: number;
  topThreshold: number;
  richRate: number;
  childAllowance: number;
  spouseSplitting: boolean;
}

export type AgeGroup = "0-17" | "18-29" | "30-44" | "45-64" | "65-79" | "80+";
export type HouseholdRole = "kind" | "alleinlebend" | "partner" | "elternteil" | "weitere-person";
export type EmploymentStatus = "erwerbstaetig" | "arbeitslos" | "rente" | "bildung" | "nicht-erwerbstaetig";
export type WorkTimeStatus = "vollzeit" | "teilzeit" | "geringfuegig" | "nicht-zutreffend";
export type HouseholdType = "alleinlebend" | "paar-ohne-kinder" | "paar-mit-kindern" | "alleinerziehend" | "mehrpersonen" | "rentnerhaushalt";
export type CommunityType = "grossstadt" | "staedtisch" | "laendlich";
export type HousingStatus = "miete" | "eigentum";

export interface SyntheticPerson {
  id: string;
  runId: string;
  householdId: string;
  age: number;
  ageGroup: AgeGroup;
  householdRole: HouseholdRole;
  employmentStatus: EmploymentStatus;
  workTimeStatus: WorkTimeStatus;
  grossEmploymentIncome: number;
  otherTaxableIncome: number;
  pensionIncome: number;
  transferIncome: number;
  socialInsuranceIncome: number;
  taxableIncome: number;
  weight: number;
  federalState: string;
  communityType: CommunityType;
  incomeDecile: number;
}

export interface SyntheticHousehold {
  id: string;
  runId: string;
  householdType: HouseholdType;
  adultCount: number;
  childCount: number;
  childAges: number[];
  employmentConstellation: string;
  grossIncome: number;
  disposableIncome: number;
  transferComponents: Record<string, number>;
  housingStatus: HousingStatus;
  grossColdRent: number;
  housingCosts: number;
  wealth: number;
  debt: number;
  federalState: string;
  communityType: CommunityType;
  weight: number;
}

export type CalibrationStatus = "innerhalb-toleranz" | "warnung";
export interface CalibrationEntry {
  id: string;
  dimension: string;
  category: string;
  target: number;
  actual: number;
  absoluteDeviation: number;
  relativeDeviation: number;
  tolerance: number;
  status: CalibrationStatus;
  sourceId: string;
  unit: "anteil" | "anzahl";
  note?: string;
}

export interface PopulationValidationIssue {
  code: string;
  severity: "error" | "warning";
  entityType: "run" | "household" | "person";
  entityId?: string;
  message: string;
}

export interface PopulationDistributionItem { id: string; label: string; value: number; share: number; }
export interface PopulationSummary {
  runId: string;
  personCount: number;
  householdCount: number;
  weightedPopulation: number;
  weightedHouseholds: number;
  calibrationStatus: CalibrationStatus;
  validationErrors: number;
  validationWarnings: number;
  distributions: Record<string, PopulationDistributionItem[]>;
}

export interface PopulationRunMetadata {
  id: string;
  schemaVersion: number;
  modelVersion: string;
  seed: string;
  createdAt: string;
  dataYear: number;
  legalYear: number;
  baselineId: string;
  sourceIds: string[];
  sampleSize: number;
  weightedPopulation: number;
  weightedHouseholds: number;
  calibrationMethod: string;
  quality: { maxRelativeDeviation: number; meanRelativeDeviation: number; status: CalibrationStatus };
  limitations: string[];
  active: boolean;
}

export interface PopulationRun {
  metadata: PopulationRunMetadata;
  summary: PopulationSummary;
  calibration: CalibrationEntry[];
  validation: PopulationValidationIssue[];
}

export interface PopulationGenerationOptions { seed: string; sampleSize: number; baselineId: string; }
export interface PopulationQuery {
  entity: "persons" | "households";
  groupBy: "ageGroup" | "householdType" | "incomeDecile" | "employmentStatus" | "federalState" | "communityType" | "housingStatus" | "transferReceipt";
  measure: "count" | "share" | "sum" | "mean" | "median";
  field?: "grossIncome" | "disposableIncome" | "wealth" | "debt" | "taxableIncome" | "grossEmploymentIncome";
}
export interface PopulationQueryResult { runId: string; query: PopulationQuery; items: PopulationDistributionItem[]; }

export interface ScenarioDraft {
  name: string;
  description: string;
  legalYear: number;
  dataYear: number;
  horizonYears: TimeHorizon;
  modelLevel: ModelLevel;
  revenueChanges: Record<string, number>;
  expenseChanges: Record<string, number>;
  effectParameters: Record<string, number>;
  incomeTax: IncomeTaxSettings;
  assumptions: string[];
  modelVersion: string;
  sourceIds: string[];
  populationRunId: string | null;
  populationModelVersion: string | null;
  sgb2: Sgb2ScenarioReference;
}

export interface ScenarioState extends ScenarioDraft { id: string; createdAt: string; updatedAt: string; }
export interface ActiveScenarioDraft { activeScenarioId: string | null; scenario: ScenarioDraft; }

export type LocalRequest =
  | { id: string; type: "sources:list" }
  | { id: string; type: "metrics:list" }
  | { id: string; type: "scenarios:list" }
  | { id: string; type: "scenarios:save"; payload: ScenarioState }
  | { id: string; type: "scenarios:delete"; payload: { scenarioId: string } }
  | { id: string; type: "draft:get" }
  | { id: string; type: "draft:save"; payload: ActiveScenarioDraft }
  | { id: string; type: "population:generate"; payload: PopulationGenerationOptions }
  | { id: string; type: "population:get-active"; payload?: undefined }
  | { id: string; type: "population:list-runs"; payload?: undefined }
  | { id: string; type: "population:activate"; payload: { runId: string } }
  | { id: string; type: "population:get-summary"; payload: { runId?: string } }
  | { id: string; type: "population:get-calibration"; payload: { runId?: string } }
  | { id: string; type: "population:query"; payload: { runId?: string; query: PopulationQuery } }
  | { id: string; type: "population:delete-run"; payload: { runId: string } }
  | { id: string; type: "population:income-tax"; payload: { runId?: string; settings: IncomeTaxSettings; modelLevel: ModelLevel } };

export type LocalResponse =
  | { id: string; ok: true; data: unknown }
  | { id: string; ok: false; error: string };
