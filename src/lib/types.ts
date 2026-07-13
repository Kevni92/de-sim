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

export interface MetricParameter {
  name: string;
  value: string;
  sourceId?: string;
}

export interface CalculationStep {
  label: string;
  expression: string;
  note?: string;
}

export interface UncertaintyDefinition {
  kind: "band" | "range" | "not-applicable";
  lowerPercent?: number;
  upperPercent?: number;
  description: string;
}

export interface ChangeLogEntry {
  date: string;
  version: string;
  note: string;
}

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

export interface ScenarioDraft {
  name: string;
  description: string;
  legalYear: number;
  dataYear: number;
  horizonYears: TimeHorizon;
  modelLevel: ModelLevel;
  revenueChanges: Record<string, number>;
  expenseChanges: Record<string, number>;
  incomeTax: IncomeTaxSettings;
  assumptions: string[];
  modelVersion: string;
  sourceIds: string[];
}

export interface ScenarioState extends ScenarioDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveScenarioDraft {
  activeScenarioId: string | null;
  scenario: ScenarioDraft;
}

export type LocalRequest =
  | { id: string; type: "sources:list" }
  | { id: string; type: "metrics:list" }
  | { id: string; type: "scenarios:list" }
  | { id: string; type: "scenarios:save"; payload: ScenarioState }
  | { id: string; type: "scenarios:delete"; payload: { scenarioId: string } }
  | { id: string; type: "draft:get" }
  | { id: string; type: "draft:save"; payload: ActiveScenarioDraft };

export type LocalResponse =
  | { id: string; ok: true; data: SourceRecord[] | MetricRecord[] | ScenarioState[] | ScenarioState | ActiveScenarioDraft | null }
  | { id: string; ok: false; error: string };
