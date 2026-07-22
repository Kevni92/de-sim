import type { Sgb2ScenarioReference } from "./sgb2-policy";

export type Confidence = "hoch" | "mittel" | "niedrig";
export type SourceStatus = "amtlich" | "modell" | "annahme";
export type EvidenceStatus = SourceStatus | "unbekannt";
export type ModelLevel = "statisch" | "verhalten" | "langfrist";
export type TimeHorizon = 1 | 5 | 10 | 20;

export type LongTermPreset =
  | "amtliche-referenz"
  | "niedrigere-nettozuwanderung"
  | "hoehere-nettozuwanderung"
  | "frueherer-arbeitsmarktzugang"
  | "spaeteres-rentenalter"
  | "familienpolitischer-wirkungspfad";

export interface LongTermScenarioSettings {
  targetYear: number;
  preset: LongTermPreset;
  workingAgeStart: number;
  retirementAge: number;
  fertilityEffectStatus: "nicht-berechnet" | "gerichteter-zusammenhang" | "szenarioband-berechenbar";
  fertilityEffectPct: number;
  migrationNetAnnual: number;
  protectionSharePct: number;
  accessDelayYears: number;
  participationRatePct: number;
  employmentRatePct: number;
  workTimeFactorPct: number;
  contributionRatePct: number;
  averageAnnualWage: number;
  pensionBenefitRatePct: number;
  federalGrantBn: number;
}

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

export type Sgb2PersonStatus = "erwerbsfaehig" | "nicht-erwerbsfaehig-kind" | "nicht-erwerbsfaehig-erwachsen";
export type Sgb2EligibilityStatus = "potenziell-leistungsberechtigt" | "ausgeschlossen-alter" | "ausgeschlossen-modell";
export type Sgb2BenefitUnitType = "alleinstehend" | "paar-ohne-kinder" | "paar-mit-kindern" | "alleinerziehend" | "gemischt";
export type Sgb2IncomeBand = "kein-einkommen" | "niedriges-erwerbseinkommen" | "sonstiges-einkommen" | "vorrangige-leistung";
export type Sgb2ReceiptStatus = "bezug" | "kein-bezug" | "unklar";

export interface Sgb2MonthlyIncomeProfile {
  employmentGrossCents: number;
  otherIncomeCents: number;
  pensionIncomeCents: number;
  transferIncomeCents: number;
  countableIncomeProxyCents: number;
}

export interface Sgb2PersonProfile {
  id: string;
  runId: string;
  personId: string;
  householdId: string;
  benefitUnitId: string;
  status: Sgb2PersonStatus;
  eligibilityStatus: Sgb2EligibilityStatus;
  relationshipRole: HouseholdRole;
  age: number;
  income: Sgb2MonthlyIncomeProfile;
  benefitMonths: number;
  weight: number;
  benefitWeight: number;
  sourceId: string;
  assumptionIds: string[];
}

export interface Sgb2HousingProfile {
  regionId: string;
  municipalityProviderId?: string;
  housingStatus: HousingStatus;
  floorAreaSquareMeters: number;
  baseRentCents: number;
  coldOperatingCostsCents: number;
  grossColdRentCents: number;
  heatingCostsCents: number;
  sourceId: string;
  uncertainty: "mittel" | "hoch";
}

export interface Sgb2BenefitUnit {
  id: string;
  runId: string;
  householdId: string;
  memberIds: string[];
  eligibleMemberIds: string[];
  nonEligibleMemberIds: string[];
  type: Sgb2BenefitUnitType;
  regionGroup: "west" | "ost" | "sued" | "stadtstaat";
  incomeBand: Sgb2IncomeBand;
  receiptStatus: Sgb2ReceiptStatus;
  benefitMonths: number;
  entryMonth: number | null;
  exitMonth: number | null;
  monthlyCountableIncomeProxyCents: number;
  monthlyNeedProxyCents: number;
  housing: Sgb2HousingProfile;
  baseWeight: number;
  weight: number;
  derivationTrace: string[];
  sourceIds: string[];
  assumptionIds: string[];
}

export interface Sgb2PopulationSummary {
  schemaVersion: number;
  modelVersion: string;
  benefitUnitCount: number;
  weightedBenefitUnits: number;
  weightedSgb2Persons: number;
  averageBenefitMonths: number;
  receiptRateAmongHouseholds: number;
  distributions: Record<string, PopulationDistributionItem[]>;
  jointDistributionAssumptions: string[];
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
  entityType: "run" | "household" | "person" | "benefit-unit" | "sgb2-person";
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
  sgb2SchemaVersion?: number;
  sgb2ModelVersion?: string;
}

export interface PopulationRun {
  metadata: PopulationRunMetadata;
  summary: PopulationSummary;
  calibration: CalibrationEntry[];
  validation: PopulationValidationIssue[];
  sgb2Summary?: Sgb2PopulationSummary;
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
  longTerm: LongTermScenarioSettings;
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
  | { id: string; type: "population:get-sgb2-summary"; payload: { runId?: string } }
  | { id: string; type: "population:query"; payload: { runId?: string; query: PopulationQuery } }
  | { id: string; type: "population:delete-run"; payload: { runId: string } }
  | { id: string; type: "population:income-tax"; payload: { runId?: string; settings: IncomeTaxSettings; modelLevel: ModelLevel } };

export type LocalResponse =
  | { id: string; ok: true; data: unknown }
  | { id: string; ok: false; error: string };
